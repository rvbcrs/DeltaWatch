const cron = require('node-cron');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const db = require('./db');
const { sendNotification } = require('./notifications');
const { summarizeChange, summarizeVisualChange, getModels } = require('./ai');
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
            const settings = await new Promise((resolve) => db.get("SELECT * FROM settings WHERE id = 1", (err, row) => resolve(row || {})));
            const launchOptions = { headless: true };
            if (settings.proxy_enabled && settings.proxy_server) {
                launchOptions.proxy = { server: settings.proxy_server };
                if (settings.proxy_auth) {
                    const [username, password] = settings.proxy_auth.split(':');
                    launchOptions.proxy.username = username;
                    launchOptions.proxy.password = password;
                }
                console.log(`Using Proxy: ${settings.proxy_server}`);
            }

            browser = await chromium.launch(launchOptions);
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
            const settings = await new Promise((resolve) => db.get("SELECT * FROM settings WHERE id = 1", (err, row) => resolve(row || {})));
            const launchOptions = { headless: true };
            if (settings.proxy_enabled && settings.proxy_server) {
                launchOptions.proxy = { server: settings.proxy_server };
                if (settings.proxy_auth) {
                    const [username, password] = settings.proxy_auth.split(':');
                    launchOptions.proxy.username = username;
                    launchOptions.proxy.password = password;
                }
            }
            // If no context provided (manual check), launch a new browser instance
            internalBrowser = await chromium.launch(launchOptions);
            context = await internalBrowser.newContext();
        } catch (e) {
            console.error("Browser Launch Error:", e);
            return;
        }
    }

    let page;
    try {
        page = await context.newPage();
        // Use networkidle to wait for fetches (filters) to complete
        await page.goto(monitor.url, { waitUntil: 'networkidle', timeout: 60000 });
        let pageTitle = await page.title();

        // Smart Wait: Try to wait for the full-screen loader to disappear (same as proxy)
        try {
            await page.waitForSelector('div[class*="fixed"][class*="inset-0"]', { state: 'detached', timeout: 10000 });
        } catch (waitErr) {
            // console.log("Loader wait timeout or not found in scheduler, proceeding...");
        }

        // Wait for specific selector if applicable
        if (monitor.selector && monitor.type === 'text') {
            try {
                await page.waitForSelector(monitor.selector, { state: 'visible', timeout: 5000 });
            } catch (e) {
                console.log(`Waited for selector ${monitor.selector} but it did not appear visible.`);
            }
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

        // Safety buffer for animations/renders after network idle
        await page.waitForTimeout(3000);

        // Extract content with Retry Logic
        let text = null;
        if (monitor.selector) {
            for (let attempt = 1; attempt <= 3; attempt++) {
                text = await page.evaluate((selector) => {
                    try {
                        const el = document.querySelector(selector);
                        return el ? el.innerText : null;
                    } catch (e) { return null; }
                }, monitor.selector);

                // If we got text and it's not empty, break
                if (text && text.trim().length > 0) break;

                // If it's the last attempt, don't wait
                if (attempt === 3) break;

                console.log(`Attempt ${attempt}: Text empty or null for monitor ${monitor.id}. Retrying in 2s...`);
                await page.waitForTimeout(2000);
            }

            if (text === null) {
                console.warn(`Element not found for monitor ${monitor.id} after 3 attempts`);
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
        let aiSummary = null;

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

                // Generate HTML Diff AND Text Diff for Push
                let diffHtml = '';
                let diffText = '';

                if (text !== monitor.last_value) {
                    const diff = Diff.diffLines(monitor.last_value || '', text || '');

                    // HTML Diff setup
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

                            // Text Diff Construction
                            // Add prefix + or -
                            const prefix = part.added ? '+ ' : '- ';
                            // Split by lines to prefix each line
                            const lines = part.value.split('\n');
                            lines.forEach(line => {
                                if (line.trim() !== '') {
                                    diffText += `${prefix}${line}\n`;
                                }
                            });
                        }
                    });
                    diffHtml += '</div>';
                }

                const identifier = monitor.name || pageTitle || `Monitor ${monitor.id}`;
                let aiSummary = null;
                let finalChangeMsg = changeMsg;
                // AI Prompt from monitor specific settings
                const aiPrompt = monitor.ai_prompt || null;

                if (monitor.type === 'visual') {
                    // Visual Check AI
                    if (monitor.last_screenshot && fs.existsSync(monitor.last_screenshot) && fs.existsSync(screenshotPath)) {
                        aiSummary = await summarizeVisualChange(monitor.last_screenshot, screenshotPath, aiPrompt);
                    }
                } else {
                    // Text Check AI
                    aiSummary = await summarizeChange(monitor.last_value, text, aiPrompt);
                }

                console.log(`AI Summary Result: '${aiSummary}'`); // DEBUG LOG

                if (aiSummary) {
                    finalChangeMsg = `🤖 AI Summary: ${aiSummary}`;
                }

                const subject = `DW: ${identifier}`;

                const message = `Change detected for ${identifier}.\n\n${finalChangeMsg}\n\nURL: ${monitor.url}`;

                const htmlMessage = `
                    <h2>DW: ${identifier}</h2>
                    <p><strong>URL:</strong> <a href="${monitor.url}">${monitor.url}</a></p>
                    <p>${finalChangeMsg}</p>
                    ${diffHtml ? `<h3>Text Changes:</h3>${diffHtml}` : ''}
                    <p><small>Sent by DeltaWatch</small></p>
                `;

                // Render Diff Image for Pushover
                let diffImagePath = null;
                // Fetch settings for push config
                const renderSettings = await new Promise((resolve) => db.get("SELECT * FROM settings WHERE id = 1", (err, row) => resolve(row || {})));

                console.log(`Render Debug: Enabled=${renderSettings.push_enabled}, Type=${renderSettings.push_type}, HasDiffHTML=${!!diffHtml}, HasContext=${!!context}`); // DEBUG LOG

                if (renderSettings.push_enabled && renderSettings.push_type === 'pushover' && diffHtml && context) {
                    try {
                        const page = await context.newPage();
                        const htmlContent = `
                            <html>
                            <body style="background-color: #0d1117; color: #c9d1d9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; padding: 20px;">
                                <h3 style="color: #fff; border-bottom: 1px solid #30363d; padding-bottom: 10px;">${identifier}</h3>
                                <div style="font-family: monospace; white-space: pre-wrap; font-size: 14px;">
                                ${diffHtml}
                                </div>
                            </body>
                            </html>
                        `;
                        await page.setContent(htmlContent);
                        const boundingBox = await page.evaluate(() => {
                            const body = document.body;
                            return { height: body.scrollHeight };
                        });
                        await page.setViewportSize({ width: 600, height: Math.ceil(boundingBox.height) + 50 });

                        const filename = `diff_render_${monitor.id}_${Date.now()}.png`;
                        diffImagePath = path.join(__dirname, 'public', 'screenshots', filename);

                        await page.screenshot({ path: diffImagePath });
                        await page.close();
                        console.log("Generated diff image:", diffImagePath);
                    } catch (err) {
                        console.error("Failed to render diff image:", err);
                    }
                }

                // Smart Notification Logic
                let shouldNotify = true;
                if (monitor.notify_config) {
                    try {
                        const rules = JSON.parse(monitor.notify_config);
                        const currentText = (text || '').toLowerCase();

                        for (const rule of rules) {
                            if (!rule.value) continue;
                            const threshold = rule.value.toLowerCase();
                            const method = rule.method || 'contains'; // contains, not_contains, starts_with, ends_with

                            if (method === 'contains') {
                                shouldNotify = currentText.includes(threshold);
                                console.log(`Rule Check (Contains): "${currentText}" includes "${threshold}" ? ${shouldNotify}`);
                            } else if (method === 'not_contains') {
                                shouldNotify = !currentText.includes(threshold);
                                console.log(`Rule Check (Not Contains): "${currentText}" !includes "${threshold}" ? ${shouldNotify}`);
                            }
                        }
                    } catch (e) {
                        console.error("Error parsing notify_config:", e);
                    }
                }

                if (shouldNotify) {
                    sendNotification(subject, message, htmlMessage, diffText, diffImagePath);
                } else {
                    console.log(`Notification suppressed by rule for Monitor ${monitor.id}`);
                }
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
                `INSERT INTO check_history (monitor_id, status, value, created_at, screenshot_path, prev_screenshot_path, diff_screenshot_path, ai_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [monitor.id, status, text, nowStr, screenshotPath, monitor.last_screenshot, diffFilename ? path.join(__dirname, 'public', 'screenshots', diffFilename) : null, aiSummary],
                (err) => {
                    if (err) console.error("DB Insert Error (History):", err.message);
                    else console.log(`DB Insert Success (History) for Monitor ${monitor.id}`);
                }
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
