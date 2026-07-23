import { chromium } from 'playwright-extra';
import type { Browser, BrowserContext } from 'playwright-core';
import stealth from 'puppeteer-extra-plugin-stealth';
import { execFile } from 'child_process';
import { logError, logInfo, logWarn } from './logger';
import db from './db';
import type { Settings } from './types';

chromium.use(stealth());

// --- Zombie prevention ---------------------------------------------------
// browser.close() is a CDP goodbye: once the connection is gone ("disconnected
// unexpectedly") it is a no-op and the Chromium process tree lives on. Observed
// in production: 11 orphaned Chromium instances, swap thrashing, TBs of disk
// reads. Every launch is therefore tagged with a unique --dwid=<label>-<ts>
// switch (Chromium ignores unknown switches) so teardown can SIGKILL the exact
// process tree, and a sweep reaps anything tagged that outlived its purpose.

export function newDwid(label: string): string {
    return `${label}-${Date.now()}`;
}

export function killBrowserProcesses(dwid: string): void {
    // -f matches the full command line; the timestamp makes the tag unique
    execFile('pkill', ['-9', '-f', `dwid=${dwid}`], () => {});
}

const SWEEP_MAX_AGE_MS = 30 * 60 * 1000;

// Safety net: kill any tagged Chromium tree older than 30 min. Pool browsers
// are recycled after 15 min and ephemeral ones live minutes, so anything this
// old is an orphan. Untagged browsers (visible debug session) are never touched.
function sweepOrphanBrowsers(): void {
    execFile('pgrep', ['-af', 'dwid='], (err, out) => {
        if (err || !out) return; // no matches or no procps
        const seen = new Set<string>();
        for (const line of out.split('\n')) {
            const m = line.match(/dwid=([a-z]+-(\d+))/);
            if (m) seen.add(m[1]);
        }
        for (const dwid of seen) {
            const ts = parseInt(dwid.split('-').pop() || '0', 10);
            if (Date.now() - ts > SWEEP_MAX_AGE_MS) {
                logWarn('browser', `Sweeping orphaned browser process tree (dwid=${dwid})`);
                killBrowserProcesses(dwid);
            }
        }
    });
}
// -------------------------------------------------------------------------

// Ad/tracking/analytics domains blocked in lightweight mode. Only known trackers:
// functional third-party hosts (CDN app bundles like hzcdn.io, WAF token endpoints
// like awswaf.com) must stay allowed — blocking all third-party scripts breaks
// JS-driven sites (e.g. marktplaats never applies its #hash filters).
const TRACKER_DOMAINS = [
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
    'google-analytics.com', 'googletagmanager.com', 'adtrafficquality.google',
    'pubmatic.com', 'criteo.com', 'adnxs.com', 'amazon-adsystem.com',
    'rubiconproject.com', 'openx.net', 'taboola.com', 'outbrain.com',
    'hotjar.com', 'datadoghq-browser-agent.com', 'sentry.io', 'newrelic.com',
    'facebook.net', 'scorecardresearch.com', 'quantserve.com',
];

export function isTrackerUrl(url: string): boolean {
    try {
        const host = new URL(url).hostname;
        return TRACKER_DOMAINS.some(d => host === d || host.endsWith('.' + d));
    } catch (e) { return false; }
}

interface LaunchOptions {
    headless: boolean;
    args?: string[];
    proxy?: {
        server: string;
        username?: string;
        password?: string;
    };
}

interface PooledBrowser {
    browser: Browser;
    dwid: string;
    inUse: boolean;
    lastUsed: number;
    createdAt: number;
}

const MAX_BROWSERS = 2;
const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes - free Docker memory faster
const MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes - recycle browsers to prevent memory bloat
const MAX_CONSECUTIVE_ERRORS = 3; // Force reset pool after 3 consecutive errors

let browserPool: PooledBrowser[] = [];
let isShuttingDown = false;
let consecutiveErrors = 0;

/**
 * Get launch options including proxy settings
 */
async function getLaunchOptions(): Promise<LaunchOptions> {
    const settings = await new Promise<Settings>((resolve) => 
        db.get("SELECT * FROM settings WHERE id = 1", (err: Error | null, row: Settings) => 
            resolve(row || {} as Settings)
        )
    );
    
    const launchOptions: LaunchOptions = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--enable-unsafe-swiftshader', // Fix for WebGL warning (crbug.com/242999)
            // Memory optimization for Docker containers
            '--renderer-process-limit=1', // Limit renderer processes (safer than --single-process)
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-default-apps',
            '--js-flags=--max-old-space-size=256' // Limit JS heap to 256MB per tab
        ]
    };
    
    if (settings.proxy_enabled && settings.proxy_server) {
        launchOptions.proxy = { server: settings.proxy_server };
        if (settings.proxy_auth) {
            const [username, password] = settings.proxy_auth.split(':');
            launchOptions.proxy.username = username;
            launchOptions.proxy.password = password;
        }
        logInfo('browser', `Browser pool using proxy: ${settings.proxy_server}`);
    }
    
    return launchOptions;
}

/**
 * Create a new browser instance
 */
async function createBrowser(): Promise<PooledBrowser> {
    const launchOptions = await getLaunchOptions();
    const dwid = newDwid('pool');
    launchOptions.args = [...(launchOptions.args || []), `--dwid=${dwid}`];
    const browser = await chromium.launch(launchOptions);

    const pooledBrowser: PooledBrowser = {
        browser,
        dwid,
        inUse: false,
        lastUsed: Date.now(),
        createdAt: Date.now()
    };

    // Handle unexpected browser close
    browser.on('disconnected', async () => {
        // Disconnected != dead: the process tree can outlive the CDP connection
        killBrowserProcesses(dwid);
        const index = browserPool.findIndex(pb => pb.browser === browser);
        if (index !== -1) {
            browserPool.splice(index, 1);
            consecutiveErrors++;
            logWarn('browser', `Browser instance disconnected unexpectedly, removed from pool (errors: ${consecutiveErrors})`);

            // Auto-reset pool if too many disconnects
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                logWarn('browser', `Too many browser disconnects (${consecutiveErrors}), forcing pool reset`);
                await forceResetPool();
            }
        }
    });
    
    logInfo('browser', `Created new browser instance (pool size: ${browserPool.length + 1})`);
    consecutiveErrors = 0; // Reset error counter on successful creation
    return pooledBrowser;
}

/**
 * Check if a browser instance is healthy
 */
async function isBrowserHealthy(pb: PooledBrowser): Promise<boolean> {
    try {
        // Quick health check - try to get contexts
        const contexts = pb.browser.contexts();
        // If browser is connected and has no errors, it's healthy
        return pb.browser.isConnected();
    } catch (e) {
        return false;
    }
}

/**
 * Acquire a browser context from the pool
 */
export async function acquireBrowser(): Promise<{ context: BrowserContext; release: (destroy?: boolean) => Promise<void> }> {
    if (isShuttingDown) {
        throw new Error('Browser pool is shutting down');
    }
    
    // Find an available browser that's not too old
    let pooledBrowser = browserPool.find(pb => !pb.inUse && (Date.now() - pb.createdAt) < MAX_AGE_MS);
    
    // If no available browser, create a new one if we have room
    if (!pooledBrowser) {
        // First, try to clean up unhealthy browsers
        for (let i = browserPool.length - 1; i >= 0; i--) {
            const pb = browserPool[i];
            if (!pb.inUse && !(await isBrowserHealthy(pb))) {
                try {
                    await pb.browser.close();
                } catch (e) {
                    // Ignore close errors
                }
                killBrowserProcesses(pb.dwid);
                browserPool.splice(i, 1);
                logWarn('browser', `Removed unhealthy browser, pool size: ${browserPool.length}`);
            }
        }
        
        if (browserPool.length < MAX_BROWSERS) {
            try {
                pooledBrowser = await createBrowser();
                browserPool.push(pooledBrowser);
            } catch (createErr: any) {
                consecutiveErrors++;
                logError('browser', `Failed to create browser: ${createErr.message}`);
                
                // If too many consecutive errors, force reset the pool
                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    logWarn('browser', `Too many consecutive errors (${consecutiveErrors}), forcing pool reset`);
                    await forceResetPool();
                }
                throw createErr;
            }
        } else {
            // Wait for a browser to become available
            logWarn('browser', 'All browsers in use, waiting for availability...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            return acquireBrowser(); // Retry
        }
    }
    
    pooledBrowser.inUse = true;
    pooledBrowser.lastUsed = Date.now();
    
    const context = await pooledBrowser.browser.newContext();
    
    const release = async (destroy: boolean = false) => {
        try {
            await context.close();
        } catch (e) {
            // Context might already be closed
        }

        if (destroy) {
            try {
                logWarn('browser', 'Destroying unhealthy browser instance requested by scheduler');
                await pooledBrowser!.browser.close();
            } catch (e) {
                // Ignore close errors
            }
            killBrowserProcesses(pooledBrowser!.dwid);
            // Remove from pool
            const idx = browserPool.indexOf(pooledBrowser!);
            if (idx !== -1) browserPool.splice(idx, 1);
        } else {
            pooledBrowser!.inUse = false;
            pooledBrowser!.lastUsed = Date.now();
        }
    };
    
    return { context, release };
}

/**
 * Clean up idle browsers
 */
async function cleanupIdleBrowsers(): Promise<void> {
    const now = Date.now();
    
    for (let i = browserPool.length - 1; i >= 0; i--) {
        const pb = browserPool[i];
        
        // Skip if in use
        if (pb.inUse) continue;
        
        // Close if idle too long or too old
        const isIdle = (now - pb.lastUsed) > IDLE_TIMEOUT_MS;
        const isTooOld = (now - pb.createdAt) > MAX_AGE_MS;
        
        if ((isIdle || isTooOld) && browserPool.length > 1) {
            try {
                await pb.browser.close();
                browserPool.splice(i, 1);
                logInfo('browser', `Closed idle browser (${isIdle ? 'idle timeout' : 'max age'}), pool size: ${browserPool.length}`);
            } catch (e: any) {
                logWarn('browser', `Failed to close browser: ${e.message}`);
                browserPool.splice(i, 1);
            }
            killBrowserProcesses(pb.dwid);
        }
    }

    sweepOrphanBrowsers();
}

/**
 * Shutdown the browser pool
 */
export async function shutdownPool(): Promise<void> {
    isShuttingDown = true;
    logInfo('browser', 'Shutting down browser pool...');
    
    // Wait for all browsers to be released
    let waitAttempts = 0;
    while (browserPool.some(pb => pb.inUse) && waitAttempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        waitAttempts++;
    }
    
    // Close all browsers
    for (const pb of browserPool) {
        try {
            await pb.browser.close();
        } catch (e) {
            // Ignore close errors during shutdown
        }
        killBrowserProcesses(pb.dwid);
    }

    browserPool = [];
    logInfo('browser', 'Browser pool shut down complete');
}

/**
 * Get pool statistics
 */
export function getPoolStats(): { total: number; inUse: number; available: number; consecutiveErrors: number; healthy: boolean } {
    return {
        total: browserPool.length,
        inUse: browserPool.filter(pb => pb.inUse).length,
        available: browserPool.filter(pb => !pb.inUse).length,
        consecutiveErrors,
        healthy: consecutiveErrors < MAX_CONSECUTIVE_ERRORS && !isShuttingDown
    };
}

/**
 * Force reset the entire browser pool (emergency recovery)
 */
export async function forceResetPool(): Promise<void> {
    logWarn('browser', 'Force resetting browser pool...');
    
    // Force close all browsers without waiting
    for (const pb of browserPool) {
        try {
            // Don't wait for graceful close
            pb.browser.close().catch(() => {});
        } catch (e) {
            // Ignore errors
        }
        killBrowserProcesses(pb.dwid);
    }

    browserPool = [];
    consecutiveErrors = 0;
    logInfo('browser', 'Browser pool force reset complete');
}

// Start cleanup interval
setInterval(cleanupIdleBrowsers, 60000);

// Handle process exit
process.on('SIGINT', async () => {
    await shutdownPool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await shutdownPool();
    process.exit(0);
});
