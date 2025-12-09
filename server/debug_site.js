const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
        console.log("Navigating...");
        await page.goto('http://www.interpretersoftware.nl/', { waitUntil: 'networkidle', timeout: 60000 });
        console.log("Navigation done (networkidle). Waiting extra 5s...");
        await page.waitForTimeout(5000); // Strict wait to ensure loader finishes


        // Simulate script stripping
        await page.evaluate(() => {
            const scripts = document.querySelectorAll('script');
            scripts.forEach(s => s.remove());
        });

        const content = await page.content();
        fs.writeFileSync('debug_output_stripped.html', content);
        console.log("Saved content to debug_output_stripped.html");


        await page.screenshot({ path: 'debug_screenshot.png' });
        console.log("Saved screenshot to debug_screenshot.png");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
})();
