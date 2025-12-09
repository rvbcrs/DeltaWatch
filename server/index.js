const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Serve static files (like the selector script)
app.use('/static', express.static(path.join(__dirname, 'public')));

const db = require('./db');
// Serve static files (like the selector script)
app.use('/static', express.static(path.join(__dirname, 'public')));

app.get('/monitors', (req, res) => {
    db.all("SELECT * FROM monitors ORDER BY created_at DESC", [], async (err, monitors) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }

        // Fetch history for each monitor
        const monitorsWithHistory = await Promise.all(monitors.map(async (monitor) => {
            return new Promise((resolve, reject) => {
                db.all(
                    "SELECT id, status, created_at, value, screenshot_path, prev_screenshot_path, diff_screenshot_path FROM check_history WHERE monitor_id = ? ORDER BY created_at DESC LIMIT 20",
                    [monitor.id],
                    (err, history) => {
                        if (err) resolve({ ...monitor, history: [] }); // Fail gracefully
                        else resolve({ ...monitor, history: history.reverse() }); // Reverse to show oldest -> newest
                    }
                );
            });
        }));

        res.json({
            "message": "success",
            "data": monitorsWithHistory
        })
    });
});

app.post('/monitors', (req, res) => {
    const { url, selector, selector_text, interval, type, name } = req.body;
    if (!url || !interval) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    // For visual type, selector might be empty or default
    const finalSelector = selector || (type === 'visual' ? 'body' : '');

    if (type !== 'visual' && !finalSelector) {
        return res.status(400).json({ error: 'Missing selector for text monitor' });
    }

    const sql = 'INSERT INTO monitors (url, selector, selector_text, interval, type, name) VALUES (?,?,?,?,?,?)';
    const params = [url, finalSelector, selector_text, interval, type || 'text', name || ''];

    db.run(sql, params, function (err, result) {
        if (err) {
            res.status(400).json({ "error": err.message })
            return;
        }
        res.json({
            "message": "success",
            "data": { id: this.lastID, ...req.body },
            "id": this.lastID
        })
    });
});

app.get('/monitors/:id', (req, res) => {
    db.get('SELECT * FROM monitors WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": row
        })
    });
});

// Delete history item
app.delete('/monitors/:id/history/:historyId', (req, res) => {
    const { id, historyId } = req.params;
    console.log(`Received DELETE request for monitor ${id}, history ${historyId}`);
    db.run("DELETE FROM check_history WHERE id = ? AND monitor_id = ?", [historyId, id], function (err) {
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

app.delete('/monitors/:id', (req, res) => {
    db.run(
        'DELETE FROM monitors WHERE id = ?',
        req.params.id,
        function (err, result) {
            if (err) {
                res.status(400).json({ "error": res.message })
                return;
            }
            res.json({ "message": "deleted", changes: this.changes })
        });
});

app.post('/monitors/:id/check', (req, res) => {
    const { id } = req.params;
    console.log(`[API] Received Manual Check Request for Monitor ${id}`);
    db.get('SELECT * FROM monitors WHERE id = ?', [id], async (err, monitor) => {
        if (err || !monitor) {
            return res.status(404).json({ error: 'Monitor not found' });
        }
        try {
            await checkSingleMonitor(monitor);
            res.json({ message: 'Check completed' });
        } catch (e) {
            console.error("Check Error:", e);
            res.status(500).json({ error: e.message });
        }
    });
});

app.put('/monitors/:id', (req, res) => {
    const { url, selector, selector_text, interval, last_value, type, name } = req.body;
    db.run(
        `UPDATE monitors set 
           url = COALESCE(?, url), 
           selector = COALESCE(?, selector), 
           selector_text = COALESCE(?, selector_text), 
           interval = COALESCE(?, interval),
           last_value = COALESCE(?, last_value),
           type = COALESCE(?, type),
           name = COALESCE(?, name)
           WHERE id = ?`,
        [url, selector, selector_text, interval, last_value, type, name, req.params.id],
        function (err, result) {
            if (err) {
                res.status(400).json({ "error": res.message })
                return;
            }
            res.json({
                message: "success",
                data: req.body,
                changes: this.changes
            })
        });
});


app.get('/proxy', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send('Missing URL parameter');
    }

    try {
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        // Navigate to the target URL
        // Using 'networkidle' is better for SPAs with loaders, but might timeout on chatty sites.
        // We'll try networkidle first, falling back to domcontentloaded if needed? 
        // Or just use networkidle with a reasonable timeout.
        try {
            // 'domcontentloaded' is fast.
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Smart Wait: Try to wait for the full-screen loader to disappear.
            // Heuristic: Looking for a fixed overlay that covers the screen.
            try {
                // Wait up to 10s for any fixed inset-0 overlay to DETACH (be removed/hidden).
                // This targets the specific loader structure we saw: <div class="fixed inset-0 ...">
                // If it doesn't exist or doesn't detach, we proceed (timeout).
                await page.waitForSelector('div[class*="fixed"][class*="inset-0"]', { state: 'detached', timeout: 10000 });
                console.log("Loader detached or not present.");
            } catch (waitErr) {
                console.log("Loader wait timeout or not found, proceeding...");
            }

            // Just a small safety buffer for animations to finish
            await page.waitForTimeout(1000);

        } catch (e) {
            console.log("Navigation error (likely timeout), proceeding:", e.message);
        }

        // Base tag injection to fix relative links
        // We'll also inject our custom script.
        const selectorScript = fs.readFileSync(path.join(__dirname, 'public', 'selector.js'), 'utf8');

        // Helper to inject scripts
        const injectScripts = async () => {
            await page.evaluate((scriptContent) => {
                // Create script element
                const script = document.createElement('script');
                script.textContent = scriptContent;
                document.body.appendChild(script);

                // Add base tag if not present
                if (!document.querySelector('base')) {
                    const base = document.createElement('base');
                    base.href = window.location.href;
                    document.head.prepend(base);
                }

                // Force viewport for responsiveness
                const existingViewport = document.querySelector('meta[name="viewport"]');
                if (existingViewport) existingViewport.remove();

                const meta = document.createElement('meta');
                meta.name = 'viewport';
                meta.content = 'width=device-width, initial-scale=1.0';
                document.head.prepend(meta);

                // Force full height to prevent cutoff inside the iframe
                const style = document.createElement('style');
                style.innerHTML = 'html, body { min-height: 100%; height: auto; width: 100%; margin: 0; padding: 0; }';
                document.head.appendChild(style);

                // NOTE: We used to strip scripts here to ensure a static snapshot.
                // However, users need scripts to interact with cookie banners etc.
                // We now rely on iframe sandbox to prevent navigation/malicious actions.
                // 
                // PREVIOUSLY REMOVED: All other script tags.

                // PREVIOUSLY REMOVED: Known overlays. 
                // We now let the user manually close them via "Interact Mode".

                // Specific fallback for the user's site structure found in debug
                const root = document.getElementById('root');
                if (root && root.firstElementChild && root.firstElementChild.classList.contains('fixed') && root.firstElementChild.classList.contains('inset-0')) {
                    root.firstElementChild.remove();
                }

            }, selectorScript);
        };

        try {
            await injectScripts();
        } catch (e) {
            if (e.message.includes('Execution context was destroyed')) {
                console.log("Navigation detected during injection, waiting and retrying...");
                try {
                    await page.waitForLoadState('domcontentloaded');
                    await injectScripts();
                } catch (retryErr) {
                    console.error("Retry failed:", retryErr.message);
                }
            } else {
                throw e;
            }
        }

        let content = await page.content();

        // Cleanup
        await browser.close();

        // Security headers might prevent iframe usage?
        // We might need to strip X-Frame-Options if we were proxying the raw request, 
        // but since we are sending HTML content, it's mostly fine locally.
        // However, fetching resources (images/css) from the original domain might run into CORS or hotlinking protection.
        // For now, let's see how much breaks.

        res.send(content);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).send('Error fetching page: ' + error.message);
    }
});

const { startScheduler, checkSingleMonitor } = require('./scheduler');
const { sendNotification } = require('./notifications');

// ... existing code ...

// API to get settings
app.get('/settings', (req, res) => {
    db.get("SELECT * FROM settings WHERE id = 1", (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'success', data: row });
    });
});

// API to update settings
app.put('/settings', (req, res) => {
    const {
        email_enabled, email_host, email_port, email_secure, email_user, email_pass, email_to,
        push_enabled, push_type, push_key1, push_key2
    } = req.body;

    db.run(
        `UPDATE settings SET 
            email_enabled = ?, email_host = ?, email_port = ?, email_secure = ?, email_user = ?, email_pass = ?, email_to = ?,
            push_enabled = ?, push_type = ?, push_key1 = ?, push_key2 = ?
        WHERE id = 1`,
        [
            email_enabled, email_host, email_port, email_secure, email_user, email_pass, email_to,
            push_enabled, push_type, push_key1, push_key2
        ],
        (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'success' });
        }
    );
});

// Test notification endpoint
app.post('/test-notification', async (req, res) => {
    const { sendNotification } = require('./notifications');
    try {
        await sendNotification(
            'Test Notification',
            'This is a test notification from your Website Change Monitor.',
            '<h2>Test Notification</h2><p>This is a <strong>HTML</strong> test notification from your <a href="#">Website Change Monitor</a>.</p>'
        );
        res.json({ message: 'success' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startScheduler();
});
