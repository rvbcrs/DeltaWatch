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
                    "SELECT status FROM check_history WHERE monitor_id = ? ORDER BY created_at DESC LIMIT 20",
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
    const { url, selector, selector_text, interval } = req.body;
    if (!url || !selector || !interval) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = 'INSERT INTO monitors (url, selector, selector_text, interval) VALUES (?,?,?,?)';
    const params = [url, selector, selector_text, interval];

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

app.put('/monitors/:id', (req, res) => {
    const { url, selector, selector_text, interval, last_value } = req.body;
    db.run(
        `UPDATE monitors set 
           url = COALESCE(?, url), 
           selector = COALESCE(?, selector), 
           selector_text = COALESCE(?, selector_text), 
           interval = COALESCE(?, interval),
           last_value = COALESCE(?, last_value)
           WHERE id = ?`,
        [url, selector, selector_text, interval, last_value, req.params.id],
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
        // waitUntil: 'networkidle' might be too slow for some heavy sites, 'domcontentloaded' might be safer
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Base tag injection to fix relative links
        // We'll also inject our custom script.
        const selectorScript = fs.readFileSync(path.join(__dirname, 'public', 'selector.js'), 'utf8');

        await page.evaluate((scriptContent) => {
            // Create script element
            const script = document.createElement('script');
            script.textContent = scriptContent;
            document.body.appendChild(script);

            // Add base tag if not present
            if (!document.querySelector('base')) {
                const base = document.createElement('base');
                base.href = window.location.href; // This works because we are inside the page context before we serialize
                document.head.prepend(base);
            }
        }, selectorScript);

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

const { startScheduler } = require('./scheduler');
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

// API to test notification
app.post('/test-notification', async (req, res) => {
    try {
        await sendNotification("Test Notification", "This is a test notification from Website Change Monitor.");
        res.json({ message: 'success' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startScheduler();
});
