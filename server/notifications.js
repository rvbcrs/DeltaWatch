const nodemailer = require('nodemailer');
const db = require('./db');
// import fetch from 'node-fetch'; // If needed for older Node, but usually global fetch in 18+ or generic https
// We'll use standard https for fewer deps or just standard fetch if available. 
// Since we don't know node version, let's use 'https' module or stick to dynamic import if needed.
// actually, for simplicity in "node" environment without "type: module", native fetch is available in Node 18+.
// If not, we might need a library. 
// I'll assume Node 18+ for now, or use a simple https helper.

const https = require('https');

function sendRequest(url, method, headers, body) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: headers
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`[${method}] ${url} - Status: ${res.statusCode}`);
                console.log(`Response: ${data}`);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`Request failed with status ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (e) => {
            console.error(`Request Error: ${e.message}`);
            reject(e);
        });
        if (body) req.write(body);
        req.end();
    });
}

function getSettings() {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM settings WHERE id = 1", (err, row) => {
            if (err) reject(err);
            else resolve(row || {});
        });
    });
}

async function sendNotification(subject, message) {
    try {
        const settings = await getSettings();

        const promises = [];

        if (settings.email_enabled) {
            promises.push(sendEmail(settings, subject, message));
        }

        if (settings.push_enabled) {
            promises.push(sendPush(settings, message));
        }

        await Promise.allSettled(promises);

    } catch (error) {
        console.error("Notification Error:", error);
    }
}

async function sendEmail(settings, subject, text) {
    console.log(`Sending Email: ${subject}`);
    try {
        const transporter = nodemailer.createTransport({
            host: settings.email_host,
            port: settings.email_port,
            secure: settings.email_secure === 1, // true for 465, false for other ports usually
            auth: {
                user: settings.email_user,
                pass: settings.email_pass
            }
        });

        await transporter.sendMail({
            from: settings.email_user, // or specific from address
            to: settings.email_to,
            subject: subject,
            text: text
        });
        console.log("Email sent successfully");
    } catch (e) {
        console.error("Failed to send email:", e);
        throw e;
    }
}

async function sendPush(settings, message) {
    console.log(`Sending Push: ${settings.push_type}`);
    try {
        if (settings.push_type === 'pushover') {
            // https://pushover.net/api
            const body = new URLSearchParams({
                token: settings.push_key1, // App Token
                user: settings.push_key2,  // User Key
                message: message
            }).toString();

            await sendRequest('https://api.pushover.net/1/messages.json', 'POST', {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body)
            }, body);

        } else if (settings.push_type === 'telegram') {
            // https://core.telegram.org/bots/api#sendmessage
            const botToken = settings.push_key1;
            const chatId = settings.push_key2;
            const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

            const body = JSON.stringify({
                chat_id: chatId,
                text: message
            });

            await sendRequest(url, 'POST', {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }, body);
        }
    } catch (e) {
        console.error("Failed to send push:", e);
        throw e;
    }
}

module.exports = { sendNotification };
