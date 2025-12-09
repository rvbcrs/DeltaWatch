const cron = require('node-cron');
const { chromium } = require('playwright');
const db = require('./db');
const { sendNotification } = require('./notifications');
const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;
// pixelmatch is ESM, imported dynamically in checkMonitor
const Diff = require('diff');

let hasChanges = false;
// Map intervals to specific cron schedules or check logic
// We'll run a check every minute and filter based on 'interval' field
const INTERVAL_MINUTES = {
    '1m': 1,
    '5m': 5,
    '30m': 30,
    '1h': 60,
    '8h': 480,
    '24h': 1440,
    '1w': 10080
};

async function checkMonitors() {
    console.log('Running monitor check...');
    console.log('Running monitor check...');
    db.all("SELECT * FROM monitors WHERE active = 1", [], async (err, monitors) => {
        if (err) {
            console.error("DB Error:", err);
            return;
        }

        const now = new Date();
        const dueMonitors = monitors.filter(m => {
            if (!m.last_check) return true; // Never checked, do it now
            const lastCheck = new Date(m.last_check);
            const intervalMins = INTERVAL_MINUTES[m.interval] || 60;
            const nextCheck = new Date(lastCheck.getTime() + intervalMins * 60000);
            return now >= nextCheck;
        });

        console.log(`Found ${dueMonitors.length} monitors due for check.`);

        if (dueMonitors.length === 0) return;

        // Launch browser once for batch
        let browser;
        try {
            browser = await chromium.launch({ headless: true });
            const context = await browser.newContext();

            for (const monitor of dueMonitors) {
                await checkSingleMonitor(monitor, context);
            }
        } catch (e) {
            console.error("Browser Error:", e);
        } finally {
            if (browser) await browser.close();
        }
    });
}

async function checkSingleMonitor(monitor, context = null) {
    console.log(`Checking monitor ${monitor.id}: ${monitor.url}`);

    let internalBrowser = null;
    if (!context) {
        try {
            // If no context provided (manual check), launch a new browser instance
            internalBrowser = await chromium.launch({ headless: true });
            context = await internalBrowser.newContext();
        } catch (e) {
            console.error("Browser Launch Error:", e);
            return;
        }
    }

    let page;
    try {
        page = await context.newPage();
        await page.goto(monitor.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        let pageTitle = await page.title();

        // Smart Wait: Try to wait for the full-screen loader to disappear (same as proxy)
        try {
            await page.waitForSelector('div[class*="fixed"][class*="inset-0"]', { state: 'detached', timeout: 10000 });
        } catch (waitErr) {
            // console.log("Loader wait timeout or not found in scheduler, proceeding...");
        }

        // Remove known full-screen loaders/overlays that might persist
        await page.evaluate(() => {
            const overlays = document.querySelectorAll('div[class*="fixed"][class*="inset-0"], div[style*="position: fixed"][style*="mk-upper-overlay"]');
            overlays.forEach(overlay => {
                const style = window.getComputedStyle(overlay);
                if (style.zIndex > 10 || style.className.includes('z-50')) {
                    overlay.remove();
                }
            });
            const root = document.getElementById('root');
            if (root && root.firstElementChild && root.firstElementChild.classList.contains('fixed') && root.firstElementChild.classList.contains('inset-0')) {
                root.firstElementChild.remove();
            }
        });

        // Just a small safety buffer 
        await page.waitForTimeout(1000);

        // Extract content
        let text = null;
        if (monitor.selector) {
            text = await page.evaluate((selector) => {
                try {
                    const el = document.querySelector(selector);
                    return el ? el.innerText : null;
                } catch (e) { return null; }
            }, monitor.selector);

            if (text === null) {
                console.warn(`Element not found for monitor ${monitor.id}`);
                // If text monitor and element missing, maybe error? 
                // But for now continuing to allow visual check
            }
        }

        const { sendNotification } = require('./notifications');

        const nowStr = new Date().toISOString();
        let changed = false;
        let status = 'unchanged';

        // Visual Check
        screenshotPath = path.join(__dirname, 'public', 'screenshots', `monitor-${monitor.id}-${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        // Compare with last screenshot if exists
        let visualChange = false;
        let diffFilename = null;

        if (monitor.last_screenshot && fs.existsSync(monitor.last_screenshot)) {
            try {
                // Dynamic import for ESM module
                const { default: pixelmatch } = await import('pixelmatch');

                const img1 = PNG.sync.read(fs.readFileSync(monitor.last_screenshot));
                const img2 = PNG.sync.read(fs.readFileSync(screenshotPath));
                const { width, height } = img1;
                const diff = new PNG({ width, height });

                const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
                if (numDiffPixels > 0) { // Consider any pixel difference as a change
                    visualChange = true;
                    diffFilename = `diff-${monitor.id}-${Date.now()}.png`;
                    const diffPath = path.join(__dirname, 'public', 'screenshots', diffFilename);
                    fs.writeFileSync(diffPath, PNG.sync.write(diff));
                }
            } catch (e) {
                console.error(`Error comparing screenshots for monitor ${monitor.id}:`, e);
                // If comparison fails, treat as no visual change or handle as an error
            }
        }

        // Logic combining text and visual
        // For now, let's treat visual change as a change trigger too? 
        // Or keep them separate notifications? User asked to "check if there are changes" using AI/Screenshot.
        // Let's OR them together for "change status" but specific notification message.

        if (text !== monitor.last_value || visualChange) {
            let changeMsg = "";
            if (text !== monitor.last_value) changeMsg += "Text Content Changed. ";
            if (visualChange) changeMsg += "Visual Appearance Changed. ";

            const isFirstRun = !monitor.last_check;

            if (!isFirstRun) {
                changed = true;
                status = 'changed';

                console.log(`Change detected for Monitor ${monitor.id}`);

                // Generate HTML Diff
                let diffHtml = '';
                if (text !== monitor.last_value) {
                    const diff = Diff.diffLines(monitor.last_value || '', text || '');
                    diffHtml = '<div style="font-family: monospace; background: #f6f8fa; padding: 10px; border-radius: 5px;">';
                    diff.forEach(part => {
                        // green for additions, red for deletions
                        // grey for common parts
                        const color = part.added ? '#e6ffec' :
                            part.removed ? '#ffebe9' : 'transparent';
                        const textColor = part.added ? '#1a7f37' :
                            part.removed ? '#cf222e' : '#24292f';

                        if (part.added || part.removed) {
                            diffHtml += `<span style="background-color: ${color}; color: ${textColor}; display: block; white-space: pre-wrap;">${part.value}</span>`;
                        }
                    });
                    diffHtml += '</div>';
                }

                const identifier = monitor.name || pageTitle || `Monitor ${monitor.id}`;
                const subject = `Change Detected: ${identifier}`;
                const message = `Change detected for ${identifier}.\n\n${changeMsg}\n\nURL: ${monitor.url}`;

                const htmlMessage = `
                    <h2>Change Detected: ${identifier}</h2>
                    <p><strong>URL:</strong> <a href="${monitor.url}">${monitor.url}</a></p>
                    <p>${changeMsg}</p>
                    ${diffHtml ? `<h3>Text Changes:</h3>${diffHtml}` : ''}
                    <p><small>Sent by DeltaWatch</small></p>
                `;

                sendNotification(subject, message, htmlMessage);
            } else {
                console.log(`First run for Monitor ${monitor.id} - Saving initial value without alert.`);
                // Treat as changed for DB update (to save values), but status 'unchanged' for history/UI
                changed = true;
                status = 'unchanged';
            }

            // Log history with screenshot paths
            // Note: screenshotPath and monitor.last_screenshot are absolute paths.
            // diffFilename is just the filename (or null).
            // We'll store them as-is. Frontend extracts filename.
            db.run(
                `INSERT INTO check_history (monitor_id, status, value, created_at, screenshot_path, prev_screenshot_path, diff_screenshot_path) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [monitor.id, status, text, nowStr, screenshotPath, monitor.last_screenshot, diffFilename ? path.join(__dirname, 'public', 'screenshots', diffFilename) : null]
            );
        } else {
            console.log(`No change for Monitor ${monitor.id}`);
            // Log history without screenshot paths for unchanged status to save space
            db.run(
                `INSERT INTO check_history (monitor_id, status, value, created_at) VALUES (?, ?, ?, ?)`,
                [monitor.id, status, text, nowStr]
            );
        }

        // Cleanup OLD screenshot to save space (since we track 'last_screenshot')
        if (monitor.last_screenshot && fs.existsSync(monitor.last_screenshot)) {
            try {
                fs.unlinkSync(monitor.last_screenshot);
            } catch (err) {
                console.error("Error deleting old screenshot:", err);
            }
        }

        if (changed) {
            if (monitor.type === 'visual') {
                db.run(
                    `UPDATE monitors SET last_check = ?, last_value = ?, last_screenshot = ?, last_change = ? WHERE id = ?`,
                    [nowStr, text, screenshotPath, nowStr, monitor.id],
                    (err) => { if (err) console.error("Update Error:", err); }
                );
            } else {
                db.run(
                    `UPDATE monitors SET last_check = ?, last_value = ?, last_change = ? WHERE id = ?`,
                    [nowStr, text, nowStr, monitor.id],
                    (err) => { if (err) console.error("Update Error:", err); }
                );
                // Delete the unused screenshot for text monitor
                fs.unlink(screenshotPath, (delErr) => { if (delErr) console.error("Error deleting unused screenshot:", delErr) });
            }
        } else {
            if (monitor.type === 'visual') {
                db.run(
                    `UPDATE monitors SET last_check = ?, last_screenshot = ? WHERE id = ?`,
                    [nowStr, screenshotPath, monitor.id],
                    (err) => { if (err) console.error("Update Error:", err); }
                );
            } else {
                db.run(
                    `UPDATE monitors SET last_check = ? WHERE id = ?`,
                    [nowStr, monitor.id],
                    (err) => { if (err) console.error("Update Error:", err); }
                );
                // Delete the unused screenshot for text monitor
                fs.unlink(screenshotPath, (delErr) => { if (delErr) console.error("Error deleting unused screenshot:", delErr) });
            }
        }

    } catch (error) {
        console.error(`Error checking monitor ${monitor.id}:`, error.message);
        // Log error history
        db.run(`INSERT INTO check_history (monitor_id, status, response_time, created_at, value) VALUES (?, ?, ?, ?, ?)`, [monitor.id, 'error', 0, new Date().toISOString(), error.message]);
    } finally {
        if (page) await page.close();
        if (internalBrowser) await internalBrowser.close();
    }
}

function startScheduler() {
    // Run every minute
    cron.schedule('* * * * *', () => {
        checkMonitors();
    });
    console.log('Scheduler started.');
}

module.exports = { startScheduler, checkSingleMonitor };
