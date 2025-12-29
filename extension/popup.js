document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveSettings').addEventListener('click', saveOptions);
document.getElementById('pick-btn').addEventListener('click', startPicker);
// auto-detect-btn listener moved to startAutoDetect refactor block
document.getElementById('loginBtn').addEventListener('click', handleLogin);
document.getElementById('logoutBtn').addEventListener('click', handleLogout);
document.getElementById('showSettingsFromLogin').addEventListener('click', () => {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('settings-section').style.display = 'block';
});

const statusDiv = document.getElementById('status');
const settingsSection = document.getElementById('settings-section');
const pickerSection = document.getElementById('picker-section');
const loginSection = document.getElementById('login-section');

// Settings Toggle
document.getElementById('settings-toggle').addEventListener('click', () => {
    if (settingsSection.style.display === 'block') {
        settingsSection.style.display = 'none';
        // restoreOptions will show login or picker
        restoreOptions();
    } else {
        settingsSection.style.display = 'block';
        pickerSection.style.display = 'none';
        loginSection.style.display = 'none';
    }
});

function showStatus(msg, type = 'info') {
    statusDiv.textContent = msg;
    statusDiv.className = `status ${type}`;
    if (type !== 'info') {
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'status';
        }, 5000);
    }
}

function restoreOptions() {
    chrome.storage.sync.get({
        serverUrl: 'http://localhost:3000',
        token: null,
        userEmail: null
    }, function (items) {
        document.getElementById('serverUrl').value = items.serverUrl;

        if (items.serverUrl) {
            populateIntervals(items.serverUrl);
            if (items.token) {
                // We have a token, show picker
                pickerSection.style.display = 'block';
                loginSection.style.display = 'none';
                settingsSection.style.display = 'none';
                document.getElementById('logoutBtn').style.display = 'block'; // Show logout
            } else {
                // Connected to server but no token -> Show Login
                loginSection.style.display = 'block';
                pickerSection.style.display = 'none';
                settingsSection.style.display = 'none';
                document.getElementById('logoutBtn').style.display = 'none'; // Hide logout
            }
        } else {
            // No URL setup
            settingsSection.style.display = 'block';
            loginSection.style.display = 'none';
            pickerSection.style.display = 'none';
        }
    });
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const serverUrl = document.getElementById('serverUrl').value.replace(/\/$/, '');

    if (!email || !password) {
        showStatus('Please enter email and password', 'error');
        return;
    }

    try {
        showStatus('Logging in...', 'info');
        const res = await fetch(`${serverUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok && data.token) {
            chrome.storage.sync.set({
                token: data.token,
                userEmail: data.user.email
            }, function () {
                showStatus('Logged in successfully!', 'success');
                restoreOptions();
            });
        } else {
            showStatus(data.error || 'Login failed', 'error');
        }
    } catch (e) {
        showStatus('Network error: ' + e.message, 'error');
    }
}

function handleLogout() {
    chrome.storage.sync.remove(['token', 'userEmail'], function () {
        showStatus('Logged out', 'info');
        restoreOptions();
    });
}

async function saveOptions() {
    const url = document.getElementById('serverUrl').value.replace(/\/$/, '');
    if (!url.startsWith('http')) {
        showStatus('Invalid URL', 'error');
        return;
    }

    // Just verify connection, unauthenticated call effectively
    try {
        // We call /status to check if server is there. Monitors is protected now.
        // Or we can just assume it works and try to login?
        // Let's call /status which should be public if we implemented it, 
        // OR just save and let user try to login.

        chrome.storage.sync.set({
            serverUrl: url
        }, function () {
            showStatus('Server URL saved', 'success');
            restoreOptions(); // This will trigger login view
        });

    } catch (e) {
        showStatus('Connection Failed', 'error');
    }
}

async function startPicker() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    try {
        await chrome.tabs.sendMessage(tab.id, { action: "togglePicker" });
        window.close();
    } catch (e) {
        showStatus('Refresh page & try again', 'error');
    }
}

document.getElementById('detect-price-btn').addEventListener('click', () => startAutoDetect('Main Product Price'));
document.getElementById('auto-detect-btn').addEventListener('click', () => startAutoDetect());



async function startAutoDetect(overridePrompt = null) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // Get token first
    chrome.storage.sync.get(['serverUrl', 'token'], async function (items) {
        const token = items.token;
        const serverUrl = items.serverUrl || 'http://localhost:3000';

        if (!token) {
            showStatus('Not Logged In', 'error');
            restoreOptions();
            return;
        }

        showStatus((overridePrompt ? 'Detecting Price' : 'Analyzing') + ' at ' + serverUrl + '...', 'info');

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // Clone body to avoid modifying the actual page
                    const clone = document.body.cloneNode(true);
                    // Remove noise
                    const toRemove = clone.querySelectorAll('script, style, svg, noscript, iframe, link, meta, video, audio, canvas');
                    toRemove.forEach(el => el.remove());
                    // Remove comments (optional but good)
                    const nodeIterator = document.createNodeIterator(clone, NodeFilter.SHOW_COMMENT);
                    let currentNode;
                    while (currentNode = nodeIterator.nextNode()) {
                        currentNode.parentNode.removeChild(currentNode);
                    }
                    return clone.outerHTML;
                }
            });

            const html = results[0].result;

            try {
                const userPrompt = overridePrompt || document.getElementById('ai-prompt').value;

                console.log('Sending request to:', `${serverUrl}/api/ai/analyze-page`);
                const res = await fetch(`${serverUrl}/api/ai/analyze-page`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        url: tab.url,
                        html: html,
                        prompt: userPrompt
                    })
                });

                if (res.status === 401 || res.status === 403) {
                    showStatus('Session expired. Please login again.', 'error');
                    handleLogout();
                    return;
                }

                const text = await res.text();
                // Debug log
                console.log('Server response:', text);

                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    showStatus('Invalid JSON: ' + text.substring(0, 50) + '...', 'error');
                    return;
                }

                if (data.data) {
                    const { name, selector, type, price, currency, formatted } = data.data;

                    // DIRECT SAVE FOR PRICE MONITORS - SHOW CONFIRMATION
                    if (price !== undefined) {
                        const displayText = formatted || `${price}`;

                        // UI Updates
                        document.getElementById('result-value').textContent = displayText;
                        document.getElementById('monitor-name-input').value = name || 'My Price Monitor';

                        document.getElementById('picker-section').style.display = 'none';
                        document.getElementById('result-section').style.display = 'block';
                        showStatus('');

                        // Store draft for the confirm button
                        window.draftMonitor = {
                            name: name,
                            url: tab.url,
                            selector: selector,
                            selector_text: displayText,
                            interval: '1h',
                            type: 'price',
                            price_detection_enabled: 1,
                            ai_prompt: 'Main Product Price',
                            notify_config: { method: 'all', threshold: '' }
                        };
                        return; // Wait for user confirmation
                    }

                    let frontendBase = serverUrl;
                    if (serverUrl.includes('localhost:3000')) {
                        frontendBase = serverUrl.replace('3000', '5173');
                    }

                    let editorUrl = `${frontendBase}/new?url=${encodeURIComponent(tab.url)}&name=${encodeURIComponent(name)}&selector=${encodeURIComponent(selector)}&type=${encodeURIComponent(type || 'text')}&auto=true`;

                    chrome.tabs.create({ url: editorUrl });
                    window.close();
                } else {
                    showStatus('AI found nothing. Response: ' + JSON.stringify(data).substring(0, 50), 'error');
                }
            } catch (err) {
                showStatus('Req Error: ' + err.message, 'error');
            }

        } catch (e) {
            showStatus('Failed to capture page: ' + e.message, 'error');
        }
    });
}

document.getElementById('confirm-add-btn').addEventListener('click', confirmAddMonitor);
document.getElementById('cancel-btn').addEventListener('click', cancelAdd);

async function confirmAddMonitor() {
    if (!window.draftMonitor) return;

    // Use custom name if provided
    const customName = document.getElementById('monitor-name-input').value;
    if (customName) {
        window.draftMonitor.name = customName;
    }

    // Use selected interval
    const customInterval = document.getElementById('monitor-interval-select').value;
    if (customInterval) {
        window.draftMonitor.interval = customInterval;
    }

    showStatus('Saving...', 'info');

    chrome.storage.sync.get(['serverUrl', 'token'], async function (items) {
        try {
            const saveRes = await fetch(`${items.serverUrl}/monitors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${items.token}`
                },
                body: JSON.stringify(window.draftMonitor)
            });

            const saveData = await saveRes.json();
            if (saveData.message === 'success' || saveData.message === 'Monitor added') {
                showStatus('Monitor added successfully! ✅', 'success');
                setTimeout(() => window.close(), 1500);
            } else {
                showStatus('Save failed: ' + (saveData.error || 'Unknown'), 'error');
            }
        } catch (err) {
            showStatus('Save Error: ' + err.message, 'error');
        }
    });
}

function cancelAdd() {
    document.getElementById('result-section').style.display = 'none';
    document.getElementById('picker-section').style.display = 'block';
    window.draftMonitor = null;
    showStatus('');
}

async function populateIntervals(baseUrl) {
    try {
        const select = document.getElementById('monitor-interval-select');
        if (!select) return;

        const res = await fetch(`${baseUrl}/api/intervals`);
        if (res.ok) {
            const data = await res.json();
            if (data.intervals && Array.isArray(data.intervals)) {
                select.innerHTML = '';

                const sortOrder = ['1m', '5m', '15m', '30m', '1h', '6h', '8h', '12h', '24h', '1w'];
                const sortedIntervals = data.intervals.sort((a, b) => {
                    const idxA = sortOrder.indexOf(a);
                    const idxB = sortOrder.indexOf(b);
                    if (idxA === -1) return 1;
                    if (idxB === -1) return -1;
                    return idxA - idxB;
                });

                sortedIntervals.forEach(interval => {
                    const option = document.createElement('option');
                    option.value = interval;

                    let label = interval;
                    if (interval.endsWith('m')) label = interval.replace('m', ' Minute(s)');
                    else if (interval.endsWith('h')) label = interval.replace('h', ' Hour(s)');
                    else if (interval.endsWith('w')) label = interval.replace('w', ' Week(s)');

                    option.textContent = label;
                    if (interval === '1h') option.selected = true;
                    select.appendChild(option);
                });
            }
        }
    } catch (e) {
        console.error('Failed to fetch intervals:', e);
    }
}
