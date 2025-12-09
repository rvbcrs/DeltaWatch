const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    // SVG content from client/public/favicon.svg (Lucide Radar)
    // We'll wrap it in a full page to ensure size
    // Using explicit size 128x128
    const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/>
      <path d="M4 6h.01"/>
      <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/>
      <path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/>
      <path d="M12 18h.01"/>
      <path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/>
      <circle cx="12" cy="12" r="2"/>
      <path d="m13.41 10.59 5.66-5.66"/>
    </svg>`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0; padding:0; background: transparent;">
        <div id="icon" style="width: 128px; height: 128px; display: flex; align-items: center; justify-content: center;">
            ${svgContent}
        </div>
    </body>
    </html>
    `;

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent);

    // Screenshot the element
    const element = await page.$('#icon');
    await element.screenshot({ path: path.join(__dirname, '../client/public/logo_128.png'), omitBackground: true });

    await browser.close();
    console.log('Icon generated at client/public/logo_128.png');
})();
