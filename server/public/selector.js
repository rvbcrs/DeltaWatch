// selector.js
(function () {
    console.log("Wachet Selector Script Injected");

    let active = true;
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
        if (!active) return;
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
    });

    window.addEventListener('message', (event) => {
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
        }
    });

    function sendMessage(type, payload) {
        window.parent.postMessage({ type, payload }, '*');
    }

    function getUniqueSelector(el) {
        if (el.id) return '#' + el.id;

        let path = [];
        while (el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.nodeName.toLowerCase();
            if (el.id) {
                selector += '#' + el.id;
                path.unshift(selector);
                break;
            } else {
                let sib = el, nth = 1;
                while (sib = sib.previousElementSibling) {
                    if (sib.nodeName.toLowerCase() == selector)
                        nth++;
                }
                if (nth != 1)
                    selector += ":nth-of-type(" + nth + ")";
            }
            path.unshift(selector);
            el = el.parentNode;
        }
        return path.join(" > ");
    }
})();
