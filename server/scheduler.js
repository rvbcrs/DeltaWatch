const cron = require('node-cron');
const { chromium } = require('playwright');
const db = require('./db');

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

async function checkSingleMonitor(monitor, context) {
    console.log(`Checking monitor ${monitor.id}: ${monitor.url}`);
    let page;
    try {
        page = await context.newPage();
        await page.goto(monitor.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Extract content
        // We use evaluate to run querySelector inside
        const text = await page.evaluate((selector) => {
            const el = document.querySelector(selector);
            return el ? el.innerText : null;
        }, monitor.selector);

        if (text === null) {
            console.warn(`Element not found for monitor ${monitor.id}`);
            return; // Don't update last_check to retry? Or update to backoff?
            // For now, let's update last_check so we don't spam if selector is broken
        }

        const { sendNotification } = require('./notifications');

        const nowStr = new Date().toISOString();
        let changed = false;

        if (monitor.last_value && text !== monitor.last_value) {
            console.log(`[ALERT] CHANGE DETECTED for Monitor ${monitor.id}!`);
            console.log(`Old: ${monitor.last_value}`);
            console.log(`New: ${text}`);
            changed = true;

            const message = `Monitor Alert: Change detected for ${monitor.url}.\n\nOld Value: ${monitor.last_value}\n\nNew Value: ${text}`;
            sendNotification(`Change Detected: Monitor ${monitor.id}`, message);

            // Log history
            db.run(`INSERT INTO check_history (monitor_id, status, response_time) VALUES (?, ?, ?)`, [monitor.id, 'changed', 0]);
        } else if (!monitor.last_value) {
            console.log(`Initial value set for Monitor ${monitor.id}: ${text}`);
            changed = true; // Treated as change for create
            // Log history
            db.run(`INSERT INTO check_history (monitor_id, status, response_time) VALUES (?, ?, ?)`, [monitor.id, 'changed', 0]);
        } else {
            console.log(`No change for Monitor ${monitor.id}`);
            // Log history
            db.run(`INSERT INTO check_history (monitor_id, status, response_time) VALUES (?, ?, ?)`, [monitor.id, 'unchanged', 0]);
        }

        // Update DB
        if (changed) {
            db.run(
                `UPDATE monitors SET last_check = ?, last_value = ?, last_change = ? WHERE id = ?`,
                [nowStr, text, nowStr, monitor.id],
                (err) => {
                    if (err) console.error("Update Error:", err);
                }
            );
        } else {
            db.run(
                `UPDATE monitors SET last_check = ? WHERE id = ?`,
                [nowStr, monitor.id],
                (err) => {
                    if (err) console.error("Update Error:", err);
                }
            );
        }

    } catch (error) {
        console.error(`Error checking monitor ${monitor.id}:`, error.message);
        // Log error history
        db.run(`INSERT INTO check_history (monitor_id, status, response_time) VALUES (?, ?, ?)`, [monitor.id, 'error', 0]);
    } finally {
        if (page) await page.close();
    }
}

function startScheduler() {
    // Run every minute
    cron.schedule('* * * * *', () => {
        checkMonitors();
    });
    console.log('Scheduler started.');
}

module.exports = { startScheduler };
