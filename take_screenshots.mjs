import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const outDir = path.join('C:\\Users\\jaiy9\\.gemini\\antigravity\\brain\\2ddfe252-73ff-4b7b-8716-c2d203cc0c64\\artifacts');
if (!fs.existsSync(outDir)){
    fs.mkdirSync(outDir, { recursive: true });
}

(async () => {
    console.log("Starting Puppeteer...");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1000 });

    try {
        console.log("Navigating to http://localhost:5173...");
        await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        console.log("Waiting 15 seconds for network requests to finish visually...");
        await new Promise(r => setTimeout(r, 15000));
        
        console.log("Taking Dashboard screenshot...");
        await page.screenshot({ path: path.join(outDir, 'dashboard.png') });

        // Scroll down to earthquake simulator
        await page.mouse.wheel({ deltaY: 800 });
        await new Promise(r => setTimeout(r, 2000));
        console.log("Taking Map section screenshot...");
        await page.screenshot({ path: path.join(outDir, 'earthquake_simulator.png') });

        // Scroll down further
        await page.mouse.wheel({ deltaY: 800 });
        await new Promise(r => setTimeout(r, 2000));
        console.log("Taking Copilot/Features screenshot...");
        await page.screenshot({ path: path.join(outDir, 'ai_copilot.png') });

    } catch (e) {
        console.error("Error during screenshot:", e);
    } finally {
        await browser.close();
        console.log("Done.");
        process.exit(0);
    }
})();
