// selector.js
(function () {
    console.log("Wachet Selector Script Injected");

    let active = false; // Default to false, wait for Editor to enable
    let hoveredElement = null;

    // Create Breadcrumbs Container
    const breadcrumbs = document.createElement('div');
    breadcrumbs.className = 'wachet-breadcrumbs';
    document.body.appendChild(breadcrumbs);

    // Style for highlighting & UI
    const style = document.createElement('style');
    style.innerHTML = `
        .wachet-hover {
            outline: 2px solid orange !important;
            cursor: pointer !important;
            background-color: rgba(255, 165, 0, 0.2) !important;
        }
        .wachet-selected {
            outline: 2px solid green !important;
            background-color: rgba(0, 255, 0, 0.2) !important;
        }
        .wachet-breadcrumbs {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0; /* Use right:0 instead of width:100% to avoid scrollbar */
            background: rgba(22, 27, 34, 0.95);
            color: #c9d1d9;
            padding: 8px 12px;
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            font-size: 12px;
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            align-items: center;
            pointer-events: auto;
            border-top: 1px solid #30363d;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.5);
            box-sizing: border-box; /* Ensure padding doesn't add to width */
            display: none; /* Hidden by default, shown only on selection */
        }
        .wachet-crumb {
            cursor: pointer;
            padding: 2px 6px;
            background: #21262d;
            border-radius: 4px;
            border: 1px solid #30363d;
            transition: all 0.2s;
            display: flex;
            align-items: center;
        }
        .wachet-crumb:hover {
            background: #1f6feb;
            border-color: #58a6ff;
            color: white;
        }
        .wachet-crumb.active {
            background: #1f6feb;
            border-color: #58a6ff;
            color: white;
            font-weight: bold;
        }
        .wachet-crumb-separator {
            color: #8b949e;
        }
    `;
    document.head.appendChild(style);

    // Add test-specific styles
    const testStyle = document.createElement('style');
    testStyle.innerHTML = `
        .wachet-test-found {
            outline: 3px solid #22c55e !important;
            background-color: rgba(34, 197, 94, 0.3) !important;
            animation: wachet-pulse 0.5s ease-out;
        }
        .wachet-test-notfound {
            /* No element to style, but we can show a message */
        }
        @keyframes wachet-pulse {
            0% { outline-width: 6px; }
            100% { outline-width: 3px; }
        }
    `;
    document.head.appendChild(testStyle);

    // Listen for messages from parent (Editor)
    window.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'TEST_SELECTOR') {
            const selector = event.data.payload;
            console.log('[Wachet] Testing selector:', selector);

            // Remove previous test highlights
            document.querySelectorAll('.wachet-test-found').forEach(el => {
                el.classList.remove('wachet-test-found');
            });

            try {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    elements.forEach(el => el.classList.add('wachet-test-found'));
                    // Scroll first element into view
                    elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Get text and send back
                    const text = elements[0].innerText || elements[0].textContent || '';
                    window.parent.postMessage({
                        type: 'TEST_SELECTOR_RESULT',
                        payload: {
                            found: true,
                            count: elements.length,
                            text: text.substring(0, 500),
                            selector: selector
                        }
                    }, '*');
                    console.log('[Wachet] Found', elements.length, 'elements');
                } else {
                    window.parent.postMessage({
                        type: 'TEST_SELECTOR_RESULT',
                        payload: {
                            found: false,
                            count: 0,
                            text: '',
                            selector: selector
                        }
                    }, '*');
                    console.log('[Wachet] No elements found for selector');
                }
            } catch (e) {
                console.error('[Wachet] Invalid selector:', e.message);
                window.parent.postMessage({
                    type: 'TEST_SELECTOR_RESULT',
                    payload: {
                        found: false,
                        count: 0,
                        text: '',
                        selector: selector,
                        error: e.message
                    }
                }, '*');
            }
        }
    });

    function updateBreadcrumbs(el) {
        breadcrumbs.innerHTML = '';
        if (!el) return;

        let path = [];
        let curr = el;
        // Go up to body or max 5 levels to avoid clutter
        while (curr && curr.tagName !== 'HTML') {
            path.unshift(curr);
            curr = curr.parentElement;
        }

        // Limit to last 6 items for space if needed, or scroll. Flex wrap handles it.

        path.forEach((node, index) => {
            if (index > 0) {
                const sep = document.createElement('span');
                sep.className = 'wachet-crumb-separator';
                sep.innerText = '›';
                breadcrumbs.appendChild(sep);
            }

            const span = document.createElement('span');
            span.className = 'wachet-crumb';
            // Mark active if it matches the selected element
            // Note: We only show breadcrumbs for the selected element now
            if (node === el) {
                span.classList.add('active');
            }

            // Build label: tag#id.class
            let label = node.tagName.toLowerCase();
            if (node.id) label += '#' + node.id;
            else if (node.classList.length > 0) label += '.' + node.classList[0]; // Just first class

            span.innerText = label;

            span.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Click on crumb -> Select that element!
                selectElement(node);
            };

            // Highlight on hover of crumb -> Preview hover (Orange)
            span.onmouseenter = () => {
                setHoveredElement(node);
            };

            breadcrumbs.appendChild(span);
        });

        breadcrumbs.style.display = 'flex';
    }

    function setHoveredElement(el) {
        if (hoveredElement && hoveredElement !== el) {
            hoveredElement.classList.remove('wachet-hover');
        }
        hoveredElement = el;
        if (hoveredElement) {
            hoveredElement.classList.add('wachet-hover');
            // We do NOT update breadcrumbs on hover anymore
        }
    }

    function selectElement(target) {
        // Deselect others
        document.querySelectorAll('.wachet-selected').forEach(el => el.classList.remove('wachet-selected'));

        target.classList.add('wachet-selected');

        // Ensure visualized
        setHoveredElement(target);

        // NOW show breadcrumbs for this selection
        updateBreadcrumbs(target);

        sendMessage('selected', {
            selector: getUniqueSelector(target),
            text: target.innerText,
            html: target.outerHTML
        });
    }

    document.addEventListener('mouseover', (e) => {
        if (!active) return;
        if (e.target.closest('.wachet-breadcrumbs')) return;

        e.stopPropagation();
        setHoveredElement(e.target);
    });

    document.addEventListener('mouseout', (e) => {
        if (!active) return;
        if (e.relatedTarget && e.relatedTarget.closest('.wachet-breadcrumbs')) return;

        // Optional: clear hover if leaving page?
        // if (hoveredElement) hoveredElement.classList.remove('wachet-hover');
    });

    // Navigate DOM with keys
    document.addEventListener('keydown', (e) => {
        if (!active || !hoveredElement) return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            if (hoveredElement.parentElement && hoveredElement.parentElement.tagName !== 'HTML') {
                setHoveredElement(hoveredElement.parentElement);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            if (hoveredElement.firstElementChild) {
                setHoveredElement(hoveredElement.firstElementChild);
            }
        } else if (e.key === 'Enter') {
            // Allow Enter to select hovered
            e.preventDefault();
            e.stopPropagation();
            selectElement(hoveredElement);
        }
    });

    document.addEventListener('click', (e) => {
        // Modifier Key Bypass (Allow interaction)
        if (e.altKey || e.ctrlKey || e.metaKey) {
            return;
        }

        if (!active) {
            // 1. Navigation Interception (when NOT picking)
            // This allows users to browse to the login page (via Proxy) to pick elements there.
            const link = e.target.closest('a');
            if (link && link.href) {
                console.log("Intercepting navigation to:", link.href);
                e.preventDefault();
                e.stopPropagation();
                sendMessage('navigate', link.href);
                return;
            }
            return;
        }

        if (e.target.closest('.wachet-breadcrumbs')) return;

        e.preventDefault();
        e.stopPropagation();

        const target = hoveredElement || e.target;

        if (target.classList.contains('wachet-selected')) {
            target.classList.remove('wachet-selected');
            sendMessage('deselected', getUniqueSelector(target));
            // Hide Breadcrumbs on deselect
            breadcrumbs.style.display = 'none';
        } else {
            selectElement(target);
        }
    }, true);

    window.addEventListener('message', async (event) => {
        const { type, payload } = event.data;
        if (type === 'highlight') {
            const el = document.querySelector(payload);
            if (el) {
                selectElement(el); // Visually select it
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else if (type === 'set_mode') {
            active = payload.active;
            console.log(`Selector mode set to: ${active ? 'Active' : 'Inactive'}`);
            if (!active) {
                if (hoveredElement) {
                    hoveredElement.classList.remove('wachet-hover');
                    hoveredElement = null;
                }
                breadcrumbs.style.display = 'none';
            } else {
                breadcrumbs.style.display = 'flex';
            }
        } else if (type === 'clear') {
            document.querySelectorAll('.wachet-selected').forEach(el => el.classList.remove('wachet-selected'));
            breadcrumbs.style.display = 'none';
            // Also clear hover just in case
            if (hoveredElement) {
                hoveredElement.classList.remove('wachet-hover');
                hoveredElement = null;
            }
        } else if (type === 'execute_step') {
            console.log("Executing Live Step:", payload);
            const { action, selector, value } = payload;

            // Handle Wait (Time)
            // Handle Wait (Time)
            if (action === 'wait') {
                const ms = parseInt(value) || 1000;
                console.log(`[Selector] Executing Wait: ${ms}ms...`);
                try {
                    await new Promise(r => setTimeout(r, ms));
                    console.log(`[Selector] Wait done, sending success`);
                    sendMessage('execution_result', { success: true });
                } catch (e) {
                    console.error("[Selector] Wait failed", e);
                    sendMessage('execution_result', { success: false, error: e.message });
                }
                return;
            }

            // Handle Scroll
            if (action === 'scroll') {
                window.scrollBy({ top: parseInt(value) || 500, behavior: 'smooth' });
                await new Promise(r => setTimeout(r, 500)); // Wait for scroll
                sendMessage('execution_result', { success: true });
                return;
            }

            // Handle Element Actions
            let el = null;
            if (selector) {
                const timeout = (action === 'wait_selector') ? (parseInt(value) || 10000) : 5000;
                console.log(`Waiting for selector '${selector}' (timeout: ${timeout}ms)...`);

                const startTime = Date.now();
                while (Date.now() - startTime < timeout) {
                    el = document.querySelector(selector);
                    // For visible elements, we might check offsetParent, but keeping it simple for now
                    if (el) break;
                    await new Promise(r => setTimeout(r, 200));
                }
            }

            if (!el) {
                console.warn("Element not found for step:", selector);
                sendMessage('execution_result', { success: false, error: `Element '${selector}' not found within timeout` });
                return;
            }

            // Visual feedback: Flash Green
            const originalOutline = el.style.outline;
            const originalTransition = el.style.transition;
            el.style.transition = 'all 0.2s';
            el.style.outline = '4px solid #00e676';
            el.style.zIndex = '100000';
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });

            await new Promise(r => setTimeout(r, 600)); // Let user see it

            // Reset style
            el.style.outline = originalOutline;
            el.style.transition = originalTransition;

            try {
                if (action === 'click') {
                    el.click();
                    // Additional events for complex frameworks
                    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                } else if (action === 'type') {
                    let inputEl = el;
                    if (inputEl.tagName !== 'INPUT' && inputEl.tagName !== 'TEXTAREA') {
                        const found = inputEl.querySelector('input, textarea');
                        if (found) inputEl = found;
                    }
                    simulateInput(inputEl, value || '');
                } else if (action === 'wait_selector') {
                    // It was found (checked above), so success.
                } else if (action === 'key') {
                    el.focus();
                    el.dispatchEvent(new KeyboardEvent('keydown', { key: value, code: value, bubbles: true }));
                    el.dispatchEvent(new KeyboardEvent('keyup', { key: value, code: value, bubbles: true }));
                    if (value === 'Enter') {
                        // Simulate form submission if applicable? Or let keydown handle it?
                        // Many SPAs listen to keydown Enter.
                    }
                }

                sendMessage('execution_result', { success: true });
            } catch (err) {
                console.error("Execution error:", err);
                sendMessage('execution_result', { success: false, error: err.message });
            }
        }
    });

    function simulateInput(element, value) {
        element.focus();
        // React Hack for Input Change
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(element, value);
        } else {
            element.value = value;
        }

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function sendMessage(type, payload) {
        window.parent.postMessage({ type, payload }, '*');
    }

    function getUniqueSelector(el) {
        // Helper: Check if a selector uniquely identifies the element
        function isUnique(selector) {
            try {
                const matches = document.querySelectorAll(selector);
                return matches.length === 1 && matches[0] === el;
            } catch { return false; }
        }

        // Helper: Get stable classes (not dynamic/generated ones)
        function getStableClasses(element) {
            if (!element.classList || element.classList.length === 0) return [];
            return Array.from(element.classList).filter(c => {
                // Skip our own wachet classes (hover, selected, test-found)
                if (c.startsWith('wachet-')) return false;
                // Skip classes that look dynamic (contain many digits, hashes, random strings)
                if (/[0-9a-f]{8,}/i.test(c)) return false;  // Hashes
                if (/\d{4,}/.test(c)) return false;         // Long numbers
                if (/^[a-z]{1,2}\d+$/i.test(c)) return false; // Like "a1", "b23"
                if (/^_/.test(c)) return false;              // Often generated (_abc123)
                if (c.length > 50) return false;             // Too long, probably generated
                return true;
            });
        }

        const originalEl = el;

        // 1. Check ID (avoid dynamic IDs with many digits or hashes)
        if (el.id && !/\d{5,}/.test(el.id) && !/[0-9a-f]{8,}/i.test(el.id)) {
            const selector = '#' + CSS.escape(el.id);
            if (isUnique(selector)) return selector;
        }

        // 2. Check Name (stable for inputs)
        if (el.name && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) {
            const selector = `${el.tagName.toLowerCase()}[name="${el.name}"]`;
            if (isUnique(selector)) return selector;
        }

        // 3. Check for data-testid or similar stable attributes
        const stableAttrs = ['data-testid', 'data-test', 'data-qa', 'data-id', 'aria-label', 'role'];
        for (const attr of stableAttrs) {
            if (el.hasAttribute(attr)) {
                const selector = `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(el.getAttribute(attr))}"]`;
                if (isUnique(selector)) return selector;
            }
        }

        // 4. Try using stable classes on the element itself
        const classes = getStableClasses(el);
        if (classes.length > 0) {
            // Try single class first
            for (const cls of classes) {
                const selector = `${el.tagName.toLowerCase()}.${CSS.escape(cls)}`;
                if (isUnique(selector)) return selector;
            }
            // Try tag + multiple classes
            if (classes.length >= 2) {
                const selector = `${el.tagName.toLowerCase()}.${classes.slice(0, 3).map(c => CSS.escape(c)).join('.')}`;
                if (isUnique(selector)) return selector;
            }
        }

        // 5. Build path with preference for IDs/classes over nth-of-type
        let path = [];
        let current = el;
        let depth = 0;
        const maxDepth = 6; // Don't go too deep

        while (current && current.nodeType === Node.ELEMENT_NODE && depth < maxDepth) {
            let selector = current.nodeName.toLowerCase();
            let foundStable = false;

            // Check for ID (stop here if found)
            if (current.id && !/\d{5,}/.test(current.id) && !/[0-9a-f]{8,}/i.test(current.id)) {
                selector = '#' + CSS.escape(current.id);
                path.unshift(selector);
                break; // ID is unique anchor
            }

            // Check for stable classes
            const currentClasses = getStableClasses(current);
            if (currentClasses.length > 0) {
                // Use the most descriptive class
                const bestClass = currentClasses.find(c => c.length > 3) || currentClasses[0];
                selector += '.' + CSS.escape(bestClass);

                // Check if this is unique enough to stop
                const testSelector = [...path];
                testSelector.unshift(selector);
                const fullSelector = testSelector.join(' > ');
                try {
                    const matches = document.querySelectorAll(fullSelector);
                    if (matches.length === 1 && matches[0] === originalEl) {
                        path.unshift(selector);
                        return path.join(' > ');
                    }
                } catch { }
                foundStable = true;
            }

            // Only use nth-of-type if no stable class found
            if (!foundStable) {
                let sib = current, nth = 1;
                while (sib = sib.previousElementSibling) {
                    if (sib.nodeName.toLowerCase() === current.nodeName.toLowerCase())
                        nth++;
                }
                if (nth !== 1) {
                    selector += `:nth-of-type(${nth})`;
                }
            }

            path.unshift(selector);
            current = current.parentNode;
            depth++;
        }

        return path.join(' > ');
    }

    // Handshake: Tell Editor we are ready to receive mode
    setTimeout(() => {
        window.parent.postMessage({ type: 'SELECTOR_READY' }, '*');
        console.log('[Wachet] Sent SELECTOR_READY');
    }, 100);

})();
