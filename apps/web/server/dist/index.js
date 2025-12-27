"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const playwright_extra_1 = require("playwright-extra");
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_1 = __importDefault(require("./db"));
const auth = __importStar(require("./auth"));
const ai_1 = require("./ai");
const scheduler_1 = require("./scheduler");
const notifications_1 = require("./notifications");
const logger_1 = require("./logger");
const env_1 = require("./env");
// Validate environment at startup
const envConfig = (0, env_1.enforceEnv)();
playwright_extra_1.chromium.use((0, puppeteer_extra_plugin_stealth_1.default)());
const app = (0, express_1.default)();
const PORT = envConfig.PORT;
// Trust reverse proxy (nginx, Cloudflare, etc.)
// This is required for express-rate-limit to work correctly behind a proxy
app.set('trust proxy', 1);
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
// Helper to resolve public folder path (works in both dev and Docker/production)
// In dev: __dirname is the source folder, public is at ./public
// In Docker: __dirname is dist/, public is at ../public
const getPublicPath = (...subpaths) => {
    // Try direct path first (dev mode)
    const directPath = path_1.default.join(__dirname, 'public', ...subpaths);
    if (fs_1.default.existsSync(directPath))
        return directPath;
    // Try parent path (Docker/production mode)
    return path_1.default.join(__dirname, '..', 'public', ...subpaths);
};
// Helper to get user label for logging: "email (ID: X)"
const getUserLabel = (userId) => {
    return new Promise((resolve) => {
        if (!userId) {
            resolve('unknown');
            return;
        }
        db_1.default.get('SELECT email FROM users WHERE id = ?', [userId], (err, row) => {
            if (err || !row) {
                resolve(`User ${userId}`);
            }
            else {
                resolve(`${row.email} (ID: ${userId})`);
            }
        });
    });
};
// Rate Limiting
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 login attempts per minute
    message: { error: 'Too many login attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
const checkLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 manual checks per minute
    message: { error: 'Too many check requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
// Apply general rate limit to all API routes
app.use('/api/', generalLimiter);
// Apply stricter limit to auth routes
app.use('/auth/', authLimiter);
app.use('/api/auth/', authLimiter);
// Scalar API Documentation
const express_api_reference_1 = require("@scalar/express-api-reference");
const openApiSpec = JSON.parse(fs_1.default.readFileSync(path_1.default.join(__dirname, 'openapi.json'), 'utf-8'));
app.use('/api/docs', (0, express_api_reference_1.apiReference)({
    spec: {
        content: openApiSpec,
    },
    theme: 'deepSpace',
    layout: 'modern',
}));
// Serve OpenAPI spec as JSON
app.get('/api/openapi.json', (req, res) => {
    res.json(openApiSpec);
});
// Global Request Logger
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
});
// Extended Health Check
app.get('/api/health', async (req, res) => {
    const startTime = Date.now();
    const { getPoolStats } = await Promise.resolve().then(() => __importStar(require('./browserPool')));
    const checks = {
        server: 'ok',
        database: 'unknown',
        browser: 'unknown',
        browserPool: getPoolStats(),
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    };
    // Check database connectivity
    try {
        await new Promise((resolve, reject) => {
            db_1.default.get('SELECT 1', (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        checks.database = 'ok';
    }
    catch (e) {
        checks.database = 'error';
        (0, logger_1.logError)('api', `Health check database failed: ${e.message}`);
    }
    // Check browser availability (quick test)
    try {
        const browser = await playwright_extra_1.chromium.launch({ headless: true });
        await browser.close();
        checks.browser = 'ok';
    }
    catch (e) {
        checks.browser = 'error';
        (0, logger_1.logError)('browser', `Health check browser failed: ${e.message}`);
    }
    checks.responseTime = Date.now() - startTime;
    const allOk = checks.database === 'ok' && checks.browser === 'ok';
    res.status(allOk ? 200 : 503).json(checks);
});
// Deep Health Check - includes scheduler and browser pool health
// Use this endpoint for Docker/Kubernetes liveness probes
app.get('/api/health/deep', async (req, res) => {
    const { getPoolStats, forceResetPool } = await Promise.resolve().then(() => __importStar(require('./browserPool')));
    const { getSchedulerHealth } = await Promise.resolve().then(() => __importStar(require('./scheduler')));
    const poolStats = getPoolStats();
    const schedulerHealth = getSchedulerHealth();
    const checks = {
        timestamp: new Date().toISOString(),
        server: 'ok',
        database: 'unknown',
        scheduler: {
            healthy: schedulerHealth.healthy,
            lastSuccessfulCheck: new Date(schedulerHealth.lastSuccessfulCheck).toISOString(),
            errors: schedulerHealth.schedulerErrors
        },
        browserPool: {
            ...poolStats,
            status: poolStats.healthy ? 'ok' : 'degraded'
        }
    };
    // Check database connectivity
    try {
        await new Promise((resolve, reject) => {
            db_1.default.get('SELECT 1', (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        checks.database = 'ok';
    }
    catch (e) {
        checks.database = 'error';
    }
    // Determine overall health
    const isHealthy = checks.database === 'ok' &&
        schedulerHealth.healthy &&
        poolStats.healthy;
    // If browser pool is unhealthy, try to recover
    if (!poolStats.healthy) {
        (0, logger_1.logWarn)('api', 'Health check detected unhealthy browser pool, attempting recovery...');
        try {
            await forceResetPool();
        }
        catch (e) {
            // Recovery failed, but we'll report the status
        }
    }
    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        ...checks
    });
});
// AI Analyze Page endpoint (for browser extension and Editor auto-detect)
app.post('/api/ai/analyze-page', auth.authenticateToken, async (req, res) => {
    const { url, html, prompt } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }
    try {
        let htmlContent = html;
        // If HTML is not provided, fetch it server-side using Playwright
        if (!htmlContent) {
            console.log('[AI Analyze] Fetching HTML server-side for:', url);
            const browser = await playwright_extra_1.chromium.launch({
                headless: true,
                args: ['--disable-blink-features=AutomationControlled']
            });
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });
            const page = await context.newPage();
            try {
                // Use load event (don't wait for networkidle - it times out on YouTube embeds)
                await page.goto(url, { waitUntil: 'load', timeout: 30000 });
                // Wait for common price/content selectors to appear
                try {
                    await page.waitForSelector('[class*="price"], [class*="Price"], .product, .price, [data-price]', {
                        timeout: 5000
                    });
                }
                catch (e) {
                    // Selector not found, continue anyway
                }
                // Additional wait for any JS rendering
                await page.waitForTimeout(3000);
                htmlContent = await page.content();
                console.log('[AI Analyze] HTML captured, length:', htmlContent.length);
            }
            catch (e) {
                console.log('[AI Analyze] Navigation error:', e.message);
                try {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await page.waitForTimeout(5000);
                    htmlContent = await page.content();
                }
                catch (e2) {
                    console.log('[AI Analyze] Fallback also failed:', e2.message);
                    htmlContent = '';
                }
            }
            finally {
                await browser.close();
            }
        }
        const result = await (0, ai_1.analyzePage)(url, htmlContent, prompt);
        res.json({ message: 'success', data: result });
    }
    catch (e) {
        console.error('AI Analyze Error:', e);
        res.status(500).json({ error: e.message });
    }
});
// AI Models endpoint
app.get('/api/ai/models', auth.authenticateToken, async (req, res) => {
    const { provider, apiKey, baseUrl } = req.query;
    try {
        const models = await (0, ai_1.getModels)(provider || 'openai', apiKey, baseUrl);
        res.json({ message: 'success', data: models });
    }
    catch (e) {
        console.error('AI Models Error:', e);
        res.status(500).json({ error: e.message });
    }
});
// Serve static files
app.use('/static', express_1.default.static(getPublicPath()));
let globalBrowser = null;
const sessionContexts = new Map();
// Cleanup interval
setInterval(async () => {
    const now = Date.now();
    for (const [id, session] of sessionContexts.entries()) {
        if (now - session.lastAccess > 10 * 60 * 1000) {
            console.log(`[Proxy] Cleaning up stale session ${id}`);
            try {
                await session.context.close();
            }
            catch (e) { }
            sessionContexts.delete(id);
        }
    }
}, 60000);
// Analytics Endpoint
app.get('/api/stats', auth.authenticateToken, async (req, res) => {
    const userId = req.user?.userId;
    const userLabel = await getUserLabel(userId);
    console.log(`[API] Stats requested by ${userLabel}`);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const queries = {
        totalMonitors: new Promise((resolve, reject) => {
            db_1.default.get("SELECT COUNT(*) as count FROM monitors WHERE user_id = ?", [userId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row.count);
            });
        }),
        activeMonitors: new Promise((resolve, reject) => {
            db_1.default.get("SELECT COUNT(*) as count FROM monitors WHERE user_id = ? AND active = 1", [userId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row.count);
            });
        }),
        stats24h: new Promise((resolve, reject) => {
            db_1.default.get(`
                SELECT 
                    COUNT(*) as total_checks,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
                    SUM(CASE WHEN status = 'changed' THEN 1 ELSE 0 END) as changes
                FROM check_history 
                JOIN monitors ON check_history.monitor_id = monitors.id
                WHERE monitors.user_id = ? AND check_history.created_at > ?
            `, [userId, oneDayAgo], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        })
    };
    Promise.all([queries.totalMonitors, queries.activeMonitors, queries.stats24h])
        .then(([totalMonitors, activeMonitors, stats]) => {
        res.json({
            message: 'success',
            data: {
                total_monitors: totalMonitors,
                active_monitors: activeMonitors,
                checks_24h: stats.total_checks || 0,
                errors_24h: stats.errors || 0,
                changes_24h: stats.changes || 0
            }
        });
    })
        .catch(err => {
        console.error("Stats Error:", err);
        res.status(500).json({ error: err.message });
    });
});
// Status endpoint (public)
app.get('/status', (req, res) => {
    db_1.default.all("SELECT id, name, url, active, last_check, last_change, type, tags FROM monitors WHERE active = 1 ORDER BY name ASC", [], async (err, monitors) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        const statusData = await Promise.all(monitors.map(async (m) => {
            return new Promise((resolve) => {
                db_1.default.get("SELECT status, http_status, created_at FROM check_history WHERE monitor_id = ? ORDER BY created_at DESC LIMIT 1", [m.id], (err, row) => {
                    resolve({
                        id: m.id,
                        name: m.name || m.url,
                        url: m.url,
                        last_check: m.last_check,
                        last_change: m.last_change,
                        status: row ? row.status : 'unknown',
                        http_status: row ? row.http_status : null,
                        type: m.type,
                        tags: m.tags ? JSON.parse(m.tags) : []
                    });
                });
            });
        }));
        res.json({
            "message": "success",
            "data": statusData
        });
    });
});
// Get single monitor
app.get('/monitors/:id', (req, res) => {
    db_1.default.get('SELECT * FROM monitors WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": row
        });
    });
});
// Delete history item
app.delete('/monitors/:id/history/:historyId', (req, res) => {
    const { id, historyId } = req.params;
    console.log(`Received DELETE request for monitor ${id}, history ${historyId}`);
    db_1.default.run("DELETE FROM check_history WHERE id = ? AND monitor_id = ?", [historyId, id], function (err) {
        if (err) {
            console.error("Delete error:", err);
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            console.warn(`No history item found with id ${historyId} for monitor ${id}`);
        }
        res.json({ message: "History item deleted", changes: this.changes });
    });
});
// Delete monitor (unprotected - legacy)
app.delete('/monitors/:id', (req, res) => {
    db_1.default.run('DELETE FROM monitors WHERE id = ?', req.params.id, function (err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({ "message": "deleted", changes: this.changes });
    });
});
// Update monitor tags
app.patch('/monitors/:id/tags', (req, res) => {
    const { tags } = req.body;
    const tagsJson = JSON.stringify(tags || []);
    db_1.default.run('UPDATE monitors SET tags = ? WHERE id = ?', [tagsJson, req.params.id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, tags: tags || [] });
    });
});
// Update monitor keywords
app.patch('/monitors/:id/keywords', (req, res) => {
    const { keywords } = req.body;
    const keywordsJson = JSON.stringify(keywords || []);
    db_1.default.run('UPDATE monitors SET keywords = ? WHERE id = ?', [keywordsJson, req.params.id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, keywords: keywords || [] });
    });
});
// Manual check (unprotected - legacy)
app.post('/monitors/:id/check', (req, res) => {
    const { id } = req.params;
    console.log(`[API] Received Manual Check Request for Monitor ${id}`);
    db_1.default.get('SELECT * FROM monitors WHERE id = ?', [id], async (err, monitor) => {
        if (err || !monitor) {
            return res.status(404).json({ error: 'Monitor not found' });
        }
        try {
            await (0, scheduler_1.checkSingleMonitor)(monitor);
            res.json({ message: 'Check completed' });
        }
        catch (e) {
            console.error("Check Error:", e);
            res.status(500).json({ error: e.message });
        }
    });
});
// Mark monitor as read
app.post('/monitors/:id/read', (req, res) => {
    const id = req.params.id;
    db_1.default.run("UPDATE monitors SET unread_count = 0 WHERE id = ?", [id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: "Monitor marked as read" });
    });
});
// Export monitor history as JSON
app.get('/monitors/:id/export/json', (req, res) => {
    const id = req.params.id;
    db_1.default.get("SELECT * FROM monitors WHERE id = ?", [id], (err, monitor) => {
        if (err || !monitor) {
            return res.status(404).json({ error: 'Monitor not found' });
        }
        db_1.default.all("SELECT id, status, created_at, value, ai_summary FROM check_history WHERE monitor_id = ? ORDER BY created_at DESC", [id], (err, history) => {
            if (err)
                return res.status(500).json({ error: err.message });
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="monitor-${id}-export.json"`);
            res.json({
                monitor: {
                    id: monitor.id,
                    name: monitor.name,
                    url: monitor.url,
                    type: monitor.type,
                    selector: monitor.selector,
                    interval: monitor.interval
                },
                history: history
            });
        });
    });
});
// Export monitor history as CSV
app.get('/monitors/:id/export/csv', (req, res) => {
    const id = req.params.id;
    db_1.default.get("SELECT * FROM monitors WHERE id = ?", [id], (err, monitor) => {
        if (err || !monitor) {
            return res.status(404).json({ error: 'Monitor not found' });
        }
        db_1.default.all("SELECT id, status, created_at, value, ai_summary FROM check_history WHERE monitor_id = ? ORDER BY created_at DESC", [id], (err, history) => {
            if (err)
                return res.status(500).json({ error: err.message });
            const escapeCSV = (str) => {
                if (!str)
                    return '';
                str = String(str);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
            };
            let csv = 'Date,Status,Value,AI Summary\n';
            history.forEach(h => {
                csv += `${escapeCSV(h.created_at)},${escapeCSV(h.status)},${escapeCSV(h.value)},${escapeCSV(h.ai_summary)}\n`;
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="monitor-${id}-export.csv"`);
            res.send(csv);
        });
    });
});
// Preview scenario
app.post('/preview-scenario', async (req, res) => {
    const { url, scenario } = req.body;
    try {
        const settings = await new Promise((resolve) => db_1.default.get("SELECT * FROM settings WHERE id = 1", (err, row) => resolve(row || {})));
        let proxySettings = null;
        if (settings.proxy_enabled && settings.proxy_server) {
            proxySettings = {
                server: settings.proxy_server,
                auth: settings.proxy_auth
            };
        }
        const screenshot = await (0, scheduler_1.previewScenario)(url, scenario, proxySettings);
        res.json({ message: 'success', screenshot: screenshot });
    }
    catch (e) {
        console.error("Preview scenario error:", e);
        res.status(500).json({ error: e.message });
    }
});
// Proxy endpoint - with concurrency limit to prevent blocking
let proxyRequestsInFlight = 0;
const MAX_CONCURRENT_PROXY = 1; // Only 1 proxy request at a time to avoid blocking scheduler
app.get('/proxy', async (req, res) => {
    // Check if too many proxy requests are in flight
    if (proxyRequestsInFlight >= MAX_CONCURRENT_PROXY) {
        console.log(`[Proxy] Too many requests (${proxyRequestsInFlight}/${MAX_CONCURRENT_PROXY}), returning busy`);
        return res.status(503).send('Server busy, please try again');
    }
    proxyRequestsInFlight++;
    console.log(`[Proxy] Request started (${proxyRequestsInFlight}/${MAX_CONCURRENT_PROXY} active)`);
    const url = req.query.url;
    const session_id = req.query.session_id;
    if (!url) {
        proxyRequestsInFlight--;
        return res.status(400).send('Missing URL parameter');
    }
    try {
        const launchBrowser = async () => {
            console.log("[Server] Launching Persistent Browser Profile...");
            const userDataDir = path_1.default.join(__dirname, 'chrome_user_data');
            if (!fs_1.default.existsSync(userDataDir)) {
                try {
                    fs_1.default.mkdirSync(userDataDir);
                }
                catch (e) { }
            }
            const ctx = await playwright_extra_1.chromium.launchPersistentContext(userDataDir, {
                headless: true,
                ignoreDefaultArgs: ['--enable-automation'],
                args: [
                    '--disable-gpu',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled',
                    '--mute-audio'
                ],
                viewport: { width: 1280, height: 800 },
                locale: 'nl-NL',
                timezoneId: 'Europe/Amsterdam',
                permissions: ['geolocation', 'notifications'],
                ignoreHTTPSErrors: true
            });
            await ctx.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });
            return ctx;
        };
        if (!globalBrowser) {
            globalBrowser = await launchBrowser();
        }
        else {
            try {
                globalBrowser.pages();
            }
            catch (e) {
                console.log("[Server] Browser context was closed, relaunching...");
                globalBrowser = await launchBrowser();
            }
        }
        const context = globalBrowser;
        if (session_id) {
            if (!sessionContexts.has(session_id)) {
                console.log(`[Proxy] New logical session ${session_id} on persistent profile`);
                sessionContexts.set(session_id, { context, lastAccess: Date.now() });
            }
            else {
                console.log(`[Proxy] Continuing session ${session_id}`);
                const session = sessionContexts.get(session_id);
                session.lastAccess = Date.now();
            }
        }
        const page = await context.newPage();
        page.on('console', (msg) => {
            if (msg.type() === 'error' || msg.type() === 'warning') {
                console.log(`[Browser ${msg.type().toUpperCase()}] ${msg.text()}`);
            }
        });
        page.on('requestfailed', (request) => {
            if (request.url().includes('google') || request.url().includes('doubleclick'))
                return;
            console.log(`[Browser Network Error] ${request.url()} : ${request.failure()?.errorText}`);
        });
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            try {
                await page.waitForSelector('div[class*="fixed"][class*="inset-0"]', { state: 'detached', timeout: 3000 });
            }
            catch (waitErr) {
                console.log("Loader wait timeout or not found, proceeding...");
            }
            await page.waitForTimeout(500);
            // Auto-dismiss cookie banners
            // First: Try to handle Sourcepoint/eBay consent iframes (used by Marktplaats, eBay, etc.)
            try {
                const consentFrame = page.frameLocator('iframe[title="SP Consent Message"], iframe[id^="sp_message_iframe_"]');
                const acceptButton = consentFrame.locator('button:has-text("Accepteren"), button:has-text("Accept"), button:has-text("Akkoord"), button[title="Accepteren"]');
                // Try clicking the accept button in the iframe with a short timeout
                await acceptButton.first().click({ timeout: 3000 });
                console.log('[Proxy] Dismissed Sourcepoint cookie banner in iframe');
                await page.waitForTimeout(500);
            }
            catch (e) {
                // Sourcepoint iframe not found or click failed, try generic selectors
                console.log('[Proxy] No Sourcepoint iframe found, trying generic selectors...');
                const cookieSelectors = [
                    'button[id*="accept"]',
                    'button[id*="Accept"]',
                    'button[class*="accept"]',
                    'button:has-text("Accepteren")',
                    'button:has-text("Akkoord")',
                    'button:has-text("Accept")',
                    '#gdpr-consent-accept-button',
                    'button[data-consent="accept"]',
                    'a:has-text("Doorgaan zonder")',
                ];
                for (const selector of cookieSelectors) {
                    try {
                        const button = await page.$(selector);
                        if (button) {
                            console.log(`[Proxy] Found cookie button: ${selector}`);
                            await button.click();
                            await page.waitForTimeout(500);
                            break;
                        }
                    }
                    catch (err) {
                        // Selector didn't match or click failed, continue
                    }
                }
            }
            await page.waitForTimeout(500);
        }
        catch (e) {
            console.log("Navigation error (likely timeout), proceeding:", e.message);
        }
        const selectorScript = fs_1.default.readFileSync(getPublicPath('selector.js'), 'utf8');
        const injectScripts = async () => {
            await page.evaluate((scriptContent) => {
                const script = document.createElement('script');
                script.textContent = scriptContent;
                document.body.appendChild(script);
                if (!document.querySelector('base')) {
                    const base = document.createElement('base');
                    base.href = window.location.href;
                    document.head.prepend(base);
                }
                const existingViewport = document.querySelector('meta[name="viewport"]');
                if (existingViewport)
                    existingViewport.remove();
                const meta = document.createElement('meta');
                meta.name = 'viewport';
                meta.content = 'width=device-width, initial-scale=1.0';
                document.head.prepend(meta);
                const style = document.createElement('style');
                style.innerHTML = 'html, body { min-height: 100%; width: 100%; margin: 0; padding: 0; overflow: auto !important; position: static !important; }';
                document.head.appendChild(style);
            }, selectorScript);
        };
        try {
            await injectScripts();
        }
        catch (e) {
            if (e.message.includes('Execution context was destroyed')) {
                console.log("Navigation detected during injection, waiting and retrying...");
                try {
                    await page.waitForLoadState('domcontentloaded');
                    await injectScripts();
                }
                catch (retryErr) {
                    console.error("Retry failed:", retryErr.message);
                }
            }
            else {
                throw e;
            }
        }
        const content = await page.content();
        // Set headers to allow iframe embedding
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.removeHeader('X-Frame-Options');
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(content);
    }
    catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).send('Error fetching page: ' + error.message);
    }
    finally {
        proxyRequestsInFlight--;
        console.log(`[Proxy] Request completed (${proxyRequestsInFlight}/${MAX_CONCURRENT_PROXY} active)`);
    }
});
// Server-Side Scenario Execution (VISIBLE)
app.post('/run-scenario-live', async (req, res) => {
    const { url, scenario } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'Missing URL' });
    }
    console.log(`[RunScenarioLive] Starting VISIBLE execution on ${url}`);
    let visibleContext = null;
    try {
        if (globalBrowser) {
            console.log(`[RunScenarioLive] Closing headless browser to use persistent profile...`);
            try {
                await globalBrowser.close();
            }
            catch (e) { }
            globalBrowser = null;
        }
        const userDataDir = path_1.default.join(__dirname, 'chrome_user_data');
        if (!fs_1.default.existsSync(userDataDir)) {
            try {
                fs_1.default.mkdirSync(userDataDir);
            }
            catch (e) { }
        }
        visibleContext = await playwright_extra_1.chromium.launchPersistentContext(userDataDir, {
            headless: false,
            ignoreDefaultArgs: ['--enable-automation'],
            args: [
                '--disable-gpu',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--start-maximized'
            ],
            viewport: { width: 1280, height: 900 },
            locale: 'nl-NL',
            timezoneId: 'Europe/Amsterdam',
            ignoreHTTPSErrors: true
        });
        await visibleContext.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
        const page = await visibleContext.newPage();
        console.log(`[RunScenarioLive] Navigating to ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        try {
            await page.waitForSelector('div[class*="fixed"][class*="inset-0"]', { state: 'detached', timeout: 5000 });
        }
        catch (e) { }
        await page.waitForTimeout(1000);
        if (scenario && Array.isArray(scenario) && scenario.length > 0) {
            console.log(`[RunScenarioLive] Executing ${scenario.length} steps...`);
            for (const step of scenario) {
                console.log(`[RunScenarioLive] Step: ${step.action} ${step.selector || ''} ${step.value || ''}`);
                try {
                    switch (step.action) {
                        case 'wait':
                            await page.waitForTimeout(parseInt(step.value) || 1000);
                            break;
                        case 'click':
                            if (step.selector) {
                                await page.waitForSelector(step.selector, { state: 'visible', timeout: 5000 });
                                await page.click(step.selector);
                            }
                            break;
                        case 'type':
                            if (step.selector) {
                                await page.waitForSelector(step.selector, { state: 'visible', timeout: 5000 });
                                await page.fill(step.selector, step.value || '');
                            }
                            break;
                        case 'wait_selector':
                            if (step.selector) {
                                await page.waitForSelector(step.selector, { state: 'visible', timeout: 10000 });
                            }
                            break;
                    }
                }
                catch (stepErr) {
                    console.error(`[RunScenarioLive] Step failed: ${stepErr.message}`);
                }
                await page.waitForTimeout(500);
            }
        }
        console.log(`[RunScenarioLive] Waiting for page to settle...`);
        await page.waitForTimeout(3000);
        const filename = `live-run-${Date.now()}.png`;
        const filepath = getPublicPath('screenshots', filename);
        await page.screenshot({ path: filepath, fullPage: true });
        console.log(`[RunScenarioLive] Done! Browser stays open for 5s...`);
        await page.waitForTimeout(5000);
        await visibleContext.close();
        visibleContext = null;
        console.log(`[RunScenarioLive] Completed. Screenshot: ${filename}`);
        res.json({ success: true, screenshot: filename });
    }
    catch (error) {
        console.error('[RunScenarioLive] Error:', error);
        if (visibleContext) {
            try {
                await visibleContext.close();
            }
            catch (e) { }
        }
        res.status(500).json({ error: error.message });
    }
});
// Get all monitors (Protected)
app.get('/monitors', auth.authenticateToken, (req, res) => {
    const { tag } = req.query;
    let sql = "SELECT * FROM monitors WHERE user_id = ? ORDER BY created_at DESC";
    let params = [req.user?.userId];
    if (tag) {
        sql = "SELECT * FROM monitors WHERE user_id = ? AND tags LIKE ? ORDER BY created_at DESC";
        params = [req.user?.userId, `%"${tag}"%`];
    }
    db_1.default.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        const monitors = rows;
        let pending = monitors.length;
        if (pending === 0)
            return res.json({ message: "success", data: [] });
        monitors.forEach(monitor => {
            db_1.default.all("SELECT * FROM check_history WHERE monitor_id = ? ORDER BY created_at DESC LIMIT 50", [monitor.id], (err, history) => {
                if (err) {
                    monitor.history = [];
                }
                else {
                    monitor.history = history;
                }
                pending--;
                if (pending === 0) {
                    res.json({ message: "success", data: monitors });
                }
            });
        });
    });
});
// ==================== GROUPS API ====================
// Get all groups for user
app.get('/groups', auth.authenticateToken, (req, res) => {
    const userId = req.user?.userId;
    db_1.default.all("SELECT * FROM groups WHERE user_id = ? ORDER BY sort_order ASC, name ASC", [userId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'success', data: rows || [] });
    });
});
// Create a group
app.post('/groups', auth.authenticateToken, (req, res) => {
    const { name, color, icon } = req.body;
    const userId = req.user?.userId;
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    db_1.default.run(`INSERT INTO groups (user_id, name, color, icon) VALUES (?, ?, ?, ?)`, [userId, name, color || '#6366f1', icon || 'folder'], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'success', data: { id: this.lastID, name, color, icon } });
    });
});
// Update a group
app.put('/groups/:id', auth.authenticateToken, (req, res) => {
    const { name, color, icon, sort_order } = req.body;
    const userId = req.user?.userId;
    const groupId = req.params.id;
    db_1.default.run(`UPDATE groups SET name = COALESCE(?, name), color = COALESCE(?, color), icon = COALESCE(?, icon), sort_order = COALESCE(?, sort_order) WHERE id = ? AND user_id = ?`, [name, color, icon, sort_order, groupId, userId], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Group updated' });
    });
});
// Delete a group
app.delete('/groups/:id', auth.authenticateToken, (req, res) => {
    const userId = req.user?.userId;
    const groupId = req.params.id;
    // First, unassign all monitors from this group
    db_1.default.run("UPDATE monitors SET group_id = NULL WHERE group_id = ? AND user_id = ?", [groupId, userId], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // Then delete the group
        db_1.default.run("DELETE FROM groups WHERE id = ? AND user_id = ?", [groupId, userId], function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Group deleted' });
        });
    });
});
// Reorder monitors (drag & drop)
app.patch('/monitors/reorder', auth.authenticateToken, (req, res) => {
    const { items } = req.body; // Array of { id, sort_order, group_id? }
    const userId = req.user?.userId;
    if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Items array is required' });
    }
    const stmt = db_1.default.prepare("UPDATE monitors SET sort_order = ?, group_id = ? WHERE id = ? AND user_id = ?");
    let errors = 0;
    items.forEach((item) => {
        stmt.run(item.sort_order, item.group_id ?? null, item.id, userId, (err) => {
            if (err)
                errors++;
        });
    });
    stmt.finalize((err) => {
        if (err || errors > 0) {
            res.status(500).json({ error: 'Some items failed to update' });
        }
        else {
            res.json({ message: 'Order updated' });
        }
    });
});
// ==================== MONITORS API ====================
// Add a new monitor
app.post('/monitors', auth.authenticateToken, (req, res) => {
    const { url, selector, selector_text, interval, type, name, notify_config, ai_prompt, tags, keywords, ai_only_visual, group_id } = req.body;
    const userId = req.user?.userId;
    db_1.default.run(`INSERT INTO monitors (user_id, url, selector, selector_text, interval, type, name, notify_config, ai_prompt, tags, keywords, ai_only_visual, group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [userId, url, selector, selector_text || '', interval || '30m', type || 'text', name, JSON.stringify(notify_config), ai_prompt, JSON.stringify(tags), JSON.stringify(keywords), ai_only_visual ? 1 : 0, group_id || null], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            message: "Monitor added",
            data: { id: this.lastID, ...req.body }
        });
    });
});
// Update a monitor
app.put('/monitors/:id', auth.authenticateToken, (req, res) => {
    const { url, selector, selector_text, interval, type, name, active, notify_config, ai_prompt, scenario_config, tags, keywords, ai_only_visual, retry_count, retry_delay } = req.body;
    db_1.default.run(`UPDATE monitors SET url = COALESCE(?, url), selector = COALESCE(?, selector), selector_text = COALESCE(?, selector_text), interval = COALESCE(?, interval), type = COALESCE(?, type), name = COALESCE(?, name), active = COALESCE(?, active), notify_config = COALESCE(?, notify_config), ai_prompt = COALESCE(?, ai_prompt), scenario_config = COALESCE(?, scenario_config), tags = COALESCE(?, tags), keywords = COALESCE(?, keywords), ai_only_visual = COALESCE(?, ai_only_visual), retry_count = COALESCE(?, retry_count), retry_delay = COALESCE(?, retry_delay) WHERE id = ? AND user_id = ?`, [url, selector, selector_text, interval, type, name, active, notify_config ? JSON.stringify(notify_config) : null, ai_prompt, scenario_config, tags ? JSON.stringify(tags) : null, keywords ? JSON.stringify(keywords) : null, ai_only_visual, retry_count, retry_delay, req.params.id, req.user?.userId], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Monitor updated" });
    });
});
// Accept Suggested Selector
app.post('/monitors/:id/suggestion/accept', auth.authenticateToken, async (req, res) => {
    const userId = req.user?.userId;
    const monitorId = req.params.id;
    const userLabel = await getUserLabel(userId);
    console.log(`[Suggestion Accept] ${userLabel} accepting suggestion for monitor ${monitorId}`);
    db_1.default.get('SELECT suggested_selector FROM monitors WHERE id = ? AND user_id = ?', [monitorId, userId], (err, row) => {
        if (err) {
            console.error('[Suggestion Accept] DB Error:', err.message);
            return res.status(500).json({ error: 'Database error', details: err.message });
        }
        if (!row) {
            console.warn(`[Suggestion Accept] Monitor ${monitorId} not found for ${userLabel}`);
            return res.status(404).json({ error: 'Monitor not found or access denied' });
        }
        if (!row.suggested_selector) {
            console.warn(`[Suggestion Accept] No suggestion for monitor ${monitorId}`);
            return res.status(400).json({ error: 'No suggestion to accept' });
        }
        console.log(`[Suggestion Accept] Applying selector: ${row.suggested_selector}`);
        db_1.default.run(`UPDATE monitors SET selector = suggested_selector, suggested_selector = NULL, last_healed = ? WHERE id = ?`, [new Date().toISOString(), monitorId], (updateErr) => {
            if (updateErr) {
                console.error('[Suggestion Accept] Update Error:', updateErr.message);
                return res.status(500).json({ error: 'Update failed', details: updateErr.message });
            }
            console.log(`[Suggestion Accept] Success for monitor ${monitorId}`);
            res.json({ message: 'Suggestion accepted', success: true });
        });
    });
});
// Reject Suggested Selector
app.post('/monitors/:id/suggestion/reject', auth.authenticateToken, (req, res) => {
    const userId = req.user?.userId;
    const monitorId = req.params.id;
    db_1.default.run(`UPDATE monitors SET suggested_selector = NULL WHERE id = ? AND user_id = ?`, [monitorId, userId], (updateErr) => {
        if (updateErr)
            return res.status(500).send(updateErr.message);
        res.json({ message: 'Suggestion rejected' });
    });
});
// Admin: Reset all cooldowns
app.post('/api/admin/reset-cooldowns', auth.authenticateToken, (req, res) => {
    const userId = req.user?.userId;
    // Check if user is admin and get their email
    db_1.default.get('SELECT role, email FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        // Reset all cooldowns
        db_1.default.run('UPDATE monitors SET consecutive_failures = 0', [], (updateErr) => {
            if (updateErr) {
                console.error('[Admin] Reset cooldowns failed:', updateErr.message);
                return res.status(500).json({ error: 'Failed to reset cooldowns' });
            }
            console.log(`[Admin] ${user.email} (ID: ${userId}) reset all cooldowns`);
            res.json({ success: true, message: 'All cooldowns have been reset' });
        });
    });
});
// Test a selector against a URL
app.post('/api/test-selector', auth.authenticateToken, async (req, res) => {
    const { url, selector } = req.body;
    if (!url || !selector) {
        return res.status(400).json({ success: false, error: 'URL and selector are required' });
    }
    let release = null;
    let page = null;
    try {
        const { acquireBrowser } = await Promise.resolve().then(() => __importStar(require('./browserPool')));
        const browser = await acquireBrowser();
        release = browser.release;
        page = await browser.context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1000);
        // Try to dismiss cookie banners first
        try {
            const consentFrame = page.frameLocator('iframe[title="SP Consent Message"], iframe[id^="sp_message_iframe_"]');
            const acceptButton = consentFrame.locator('button:has-text("Accepteren"), button:has-text("Accept"), button:has-text("Akkoord")');
            await acceptButton.first().click({ timeout: 2000 });
            await page.waitForTimeout(500);
        }
        catch (e) {
            // No consent iframe, try generic buttons
            const cookieSelectors = [
                'button[id*="accept"]',
                'button:has-text("Accepteren")',
                'button:has-text("Accept")',
                '#gdpr-consent-accept-button',
            ];
            for (const cookieSelector of cookieSelectors) {
                try {
                    const button = await page.$(cookieSelector);
                    if (button) {
                        await button.click();
                        await page.waitForTimeout(500);
                        break;
                    }
                }
                catch (err) { /* ignore */ }
            }
        }
        // Test the selector
        const elements = await page.$$(selector);
        const count = elements.length;
        if (count === 0) {
            await page.close();
            if (release)
                await release();
            return res.json({ success: false, error: 'No elements match this selector' });
        }
        // Get text content from first element
        const text = await elements[0].textContent() || '';
        const cleanedText = text.trim().substring(0, 500); // Limit preview length
        await page.close();
        if (release)
            await release();
        res.json({
            success: true,
            count,
            text: cleanedText
        });
    }
    catch (e) {
        console.error('[test-selector] Error:', e.message);
        try {
            if (page)
                await page.close();
            if (release)
                await release();
        }
        catch (cleanupErr) { /* ignore */ }
        res.status(500).json({ success: false, error: e.message });
    }
});
// Delete a monitor (Protected)
app.delete('/monitors/:id', auth.authenticateToken, (req, res) => {
    db_1.default.run("DELETE FROM check_history WHERE monitor_id IN (SELECT id FROM monitors WHERE id = ? AND user_id = ?)", [req.params.id, req.user?.userId], function (err) {
        if (!err) {
            db_1.default.run("DELETE FROM monitors WHERE id = ? AND user_id = ?", [req.params.id, req.user?.userId], function (err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ message: "Monitor deleted" });
            });
        }
    });
});
// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await auth.registerUser(email, password);
        res.json(result);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
app.post('/api/auth/login', async (req, res) => {
    console.log('[Auth] Login attempt for:', req.body?.email);
    try {
        const { email, password } = req.body;
        const result = await auth.loginUser(email, password);
        console.log('[Auth] Login successful for:', email);
        res.json(result);
    }
    catch (e) {
        console.log('[Auth] Login failed for:', req.body?.email, '- Reason:', e.message);
        res.status(401).json({ error: e.message });
    }
});
app.post('/api/auth/verify', async (req, res) => {
    const { token } = req.body;
    if (!token)
        return res.status(400).json({ error: 'Token is required' });
    try {
        const email = await auth.verifyEmail(token);
        res.json({ message: 'Email verified successfully', email });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
app.post('/api/auth/resend-verification', async (req, res) => {
    const { email } = req.body;
    if (!email)
        return res.status(400).json({ error: 'Email is required' });
    try {
        const result = await auth.resendVerification(email);
        if (result === 'already_verified') {
            res.status(400).json({ error: 'Email already verified' });
        }
        else {
            res.json({ message: 'Verification email sent' });
        }
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/auth/setup-status', async (req, res) => {
    const isComplete = await auth.isSetupComplete();
    res.json({ needs_setup: !isComplete });
});
// Admin Middleware
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    }
    else {
        res.status(403).json({ error: 'Access denied: Admin only' });
    }
};
// Admin: Get Users
app.get('/api/admin/users', auth.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await auth.getUsers();
        res.json({ message: 'success', data: users });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Admin: Delete User
app.delete('/api/admin/users/:id', auth.authenticateToken, requireAdmin, (req, res) => {
    auth.deleteUser(parseInt(req.params.id))
        .then(result => res.json({ message: 'success', data: result }))
        .catch(err => res.status(500).json({ error: err.message }));
});
app.put('/api/admin/users/:id/block', auth.authenticateToken, requireAdmin, (req, res) => {
    const { blocked } = req.body;
    auth.toggleUserBlock(parseInt(req.params.id), blocked)
        .then(result => res.json({ message: 'success', data: result }))
        .catch(err => res.status(500).json({ error: err.message }));
});
// Logs API (Admin only)
app.get('/api/admin/logs', auth.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const level = req.query.level;
        const source = req.query.source;
        const monitorId = req.query.monitor_id ? parseInt(req.query.monitor_id) : undefined;
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;
        const result = await (0, logger_1.getLogs)({ level, source, monitorId, limit, offset });
        res.json({ message: 'success', data: result });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.delete('/api/admin/logs/:id', auth.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const deleted = await (0, logger_1.deleteLog)(parseInt(req.params.id));
        res.json({ message: deleted ? 'success' : 'not found' });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.delete('/api/admin/logs', auth.authenticateToken, requireAdmin, async (req, res) => {
    try {
        const daysOld = req.query.days_old ? parseInt(req.query.days_old) : undefined;
        let deleted;
        if (daysOld !== undefined) {
            deleted = await (0, logger_1.cleanupLogs)(daysOld);
        }
        else {
            deleted = await (0, logger_1.clearAllLogs)();
        }
        res.json({ message: 'success', deleted });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;
    if (!token)
        return res.status(400).json({ error: 'Token is required' });
    try {
        const result = await auth.verifyGoogleToken(token);
        res.json(result);
    }
    catch (e) {
        console.error("Google Auth Error:", e);
        res.status(401).json({ error: 'Google authentication failed' });
    }
});
// Trigger a manual check (Protected)
app.post('/monitors/:id/check', auth.authenticateToken, checkLimiter, async (req, res) => {
    db_1.default.get("SELECT * FROM monitors WHERE id = ? AND user_id = ?", [req.params.id, req.user?.userId], async (err, monitor) => {
        if (err || !monitor)
            return res.status(404).json({ error: "Monitor not found" });
        try {
            await (0, scheduler_1.checkSingleMonitor)(monitor);
            res.json({ message: "Check initiated" });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
});
// Settings
app.get('/settings', auth.authenticateToken, (req, res) => {
    db_1.default.get("SELECT * FROM settings WHERE id = 1", [], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "success", data: row });
    });
});
app.put('/settings', auth.authenticateToken, (req, res) => {
    const { email_enabled, email_host, email_port, email_secure, email_user, email_pass, email_to, email_from, push_enabled, push_type, push_key1, push_key2, ai_enabled, ai_provider, ai_api_key, ai_model, ai_base_url, proxy_enabled, proxy_server, proxy_auth, webhook_enabled, webhook_url } = req.body;
    db_1.default.run(`UPDATE settings SET 
        email_enabled = ?, email_host = ?, email_port = ?, email_secure = ?, email_user = ?, email_pass = ?, email_to = ?, email_from = ?,
        push_enabled = ?, push_type = ?, push_key1 = ?, push_key2 = ?,
        ai_enabled = ?, ai_provider = ?, ai_api_key = ?, ai_model = ?, ai_base_url = ?,
        proxy_enabled = ?, proxy_server = ?, proxy_auth = ?,
        webhook_enabled = ?, webhook_url = ?
        WHERE id = 1`, [
        email_enabled, email_host, email_port, email_secure, email_user, email_pass, email_to, email_from,
        push_enabled, push_type, push_key1, push_key2,
        ai_enabled, ai_provider, ai_api_key, ai_model, ai_base_url,
        proxy_enabled, proxy_server, proxy_auth,
        webhook_enabled, webhook_url
    ], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Settings updated" });
    });
});
// Test notification
app.post('/test-notification', auth.authenticateToken, async (req, res) => {
    const { type } = req.body;
    try {
        await (0, notifications_1.sendNotification)('Test Notification', 'This is a test notification from DeltaWatch.', '<h2>Test Notification</h2><p>This is an <strong>HTML</strong> test notification from <a href="#">DeltaWatch</a>.</p>', { type });
        res.json({ message: 'success' });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Export/Import
app.get('/api/export', auth.authenticateToken, (req, res) => {
    db_1.default.all("SELECT * FROM monitors WHERE user_id = ?", [req.user?.userId], (err, rows) => {
        if (err)
            return res.status(500).json({ error: err.message });
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="monitors.json"');
        res.send(JSON.stringify(rows, null, 2));
    });
});
app.post('/api/import', auth.authenticateToken, (req, res) => {
    const monitors = req.body;
    if (!Array.isArray(monitors)) {
        return res.status(400).json({ error: 'Invalid data format. Expected an array of monitors.' });
    }
    let importedCount = 0;
    let errorCount = 0;
    const userId = req.user?.userId;
    const insertMonitor = (monitor) => {
        return new Promise((resolve) => {
            const { url, selector, selector_text, interval, type, name } = monitor;
            db_1.default.get("SELECT id FROM monitors WHERE url = ? AND selector = ? AND user_id = ?", [url, selector, userId], (err, row) => {
                if (err) {
                    errorCount++;
                    resolve();
                }
                else if (row) {
                    resolve();
                }
                else {
                    db_1.default.run("INSERT INTO monitors (user_id, url, selector, selector_text, interval, type, name) VALUES (?,?,?,?,?,?,?)", [userId, url, selector, selector_text, interval, type || 'text', name || ''], (err) => {
                        if (!err)
                            importedCount++;
                        else
                            errorCount++;
                        resolve();
                    });
                }
            });
        });
    };
    Promise.all(monitors.map(insertMonitor)).then(() => {
        res.json({ message: 'success', imported: importedCount, errors: errorCount });
    });
});
// Serve static files from React app
app.use(express_1.default.static(path_1.default.join(__dirname, '../client/dist')));
// Catchall handler
app.get(/.*/, (req, res) => {
    if (fs_1.default.existsSync(path_1.default.join(__dirname, '../client/dist/index.html'))) {
        res.sendFile(path_1.default.join(__dirname, '../client/dist/index.html'));
    }
    else {
        res.status(404).send('Client not built or in development mode. Use Vite dev server.');
    }
});
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    (0, scheduler_1.startScheduler)();
});
// Graceful Shutdown
async function gracefulShutdown(signal) {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    (0, logger_1.logInfo)('api', `Graceful shutdown initiated by ${signal}`);
    // Stop accepting new connections
    server.close(() => {
        console.log('HTTP server closed');
    });
    // Shutdown browser pool
    try {
        const { shutdownPool } = await Promise.resolve().then(() => __importStar(require('./browserPool')));
        await shutdownPool();
        console.log('Browser pool shut down');
    }
    catch (e) {
        console.error('Error shutting down browser pool:', e.message);
    }
    // Close database connection
    try {
        await new Promise((resolve, reject) => {
            db_1.default.close((err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        console.log('Database connection closed');
    }
    catch (e) {
        console.error('Error closing database:', e.message);
    }
    console.log('Graceful shutdown complete');
    process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
//# sourceMappingURL=index.js.map