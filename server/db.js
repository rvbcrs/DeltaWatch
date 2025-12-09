const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'monitors.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the monitors database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS monitors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            selector TEXT NOT NULL,
            selector_text TEXT,
            interval TEXT NOT NULL,
            last_check DATETIME,
            last_value TEXT,
            last_change DATETIME,
            active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error("Error creating monitors table:", err);
        });

        // Migration: Add active column if it doesn't exist
        db.all("PRAGMA table_info(monitors)", (err, rows) => {
            if (!err) {
                const hasActive = rows.some(r => r.name === 'active');
                if (!hasActive) {
                    console.log('Migrating: Adding active column to monitors table...');
                    db.run("ALTER TABLE monitors ADD COLUMN active BOOLEAN DEFAULT 1");
                }
            } else {
                console.error("Error checking table info:", err);
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            email_enabled BOOLEAN DEFAULT 0,
            email_host TEXT,
            email_port INTEGER,
            email_secure BOOLEAN DEFAULT 0,
            email_user TEXT,
            email_pass TEXT,
            email_to TEXT,
            
            push_enabled BOOLEAN DEFAULT 0,
            push_type TEXT,
            push_key1 TEXT,
            push_key2 TEXT,
            
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error("Error creating settings table:", err);
        });

        db.run(`CREATE TABLE IF NOT EXISTS check_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            monitor_id INTEGER,
            status TEXT, -- 'unchanged', 'changed', 'error'
            response_time INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(monitor_id) REFERENCES monitors(id)
        )`, (err) => {
            if (err) console.error("Error creating check_history table:", err);
        });

        // Insert default row if not exists
        db.run(`INSERT OR IGNORE INTO settings (id, email_enabled, push_enabled) VALUES (1, 0, 0)`, (err) => {
            if (err) console.error("Error inserting default settings:", err);
        });
    });
}

module.exports = db;
