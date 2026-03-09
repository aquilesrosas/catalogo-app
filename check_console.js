const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        headless: true
    });
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('requestfailed', request =>
        console.log('REQUEST FAILED:', request.url(), request.failure().errorText)
    );

    console.log('Navigating to http://localhost:8081...');
    await page.goto('http://localhost:53151', { waitUntil: 'domcontentloaded', timeout: 10000 });

    console.log('Page loaded. Waiting 5s for hydration...');
    await new Promise(r => setTimeout(r, 5000));

    await page.screenshot({ path: 'test_screen.png' });
    console.log('Screenshot saved to test_screen.png');

    await browser.close();
})();
