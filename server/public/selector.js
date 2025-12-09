// selector.js
(function () {
    console.log("Wachet Selector Script Injected");

    let active = true;
    let hoveredElement = null;

    // Style for highlighting
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
    `;
    document.head.appendChild(style);

    document.addEventListener('mouseover', (e) => {
        if (!active) return;
        e.stopPropagation();

        if (hoveredElement && hoveredElement !== e.target) {
            hoveredElement.classList.remove('wachet-hover');
        }

        hoveredElement = e.target;
        hoveredElement.classList.add('wachet-hover');
    });

    document.addEventListener('mouseout', (e) => {
        if (!active) return;
        if (hoveredElement) {
            hoveredElement.classList.remove('wachet-hover');
            hoveredElement = null;
        }
    });

    document.addEventListener('click', (e) => {
        if (!active) return;
        e.preventDefault();
        e.stopPropagation();

        const target = e.target;

        if (target.classList.contains('wachet-selected')) {
            target.classList.remove('wachet-selected');
            sendMessage('deselected', getSelector(target));
        } else {
            // Deselect others if single selection mode (optional, but good for now)
            document.querySelectorAll('.wachet-selected').forEach(el => el.classList.remove('wachet-selected'));

            target.classList.add('wachet-selected');
            sendMessage('selected', {
                selector: getUniqueSelector(target),
                text: target.innerText,
                html: target.outerHTML
            });
        }
    });

    window.addEventListener('message', (event) => {
        const { type, payload } = event.data;
        if (type === 'highlight') {
            const el = document.querySelector(payload);
            if (el) {
                el.classList.add('wachet-selected');
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });

    function sendMessage(type, payload) {
        // Send to parent window (the Wachet app)
        window.parent.postMessage({ type, payload }, '*');
    }

    // Helper to generate a unique selector (simplified)
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
