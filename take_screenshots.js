const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const outDir = path.join('C:\\Users\\jaiy9\\.gemini\\antigravity\\brain\\2ddfe252-73ff-4b7b-8716-c2d203cc0c64\\artifacts');
if (!fs.existsSync(outDir)){
    fs.mkdirSync(outDir, { recursive: true });
}

(async () => {
    console.log("Starting Puppeteer...");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        console.log("Navigating to http://localhost:5173...");
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Let it load fully
        await new Promise(r => setTimeout(r, 5000));
        
        console.log("Taking Dashboard screenshot...");
        await page.screenshot({ path: path.join(outDir, 'dashboard_main.png') });

        // Let's click on "Earthquake Simulator" if we can find it
        // Or we can just take a few more screenshots after scrolling
        await page.mouse.wheel({ deltaY: 800 });
        await new Promise(r => setTimeout(r, 2000));
        console.log("Taking Map section screenshot...");
        await page.screenshot({ path: path.join(outDir, 'map_heatmaps.png') });

        await page.mouse.wheel({ deltaY: 800 });
        await new Promise(r => setTimeout(r, 2000));
        console.log("Taking lower section screenshot...");
        await page.screenshot({ path: path.join(outDir, 'features_modules.png') });

    } catch (e) {
        console.error("Error during screenshot:", e);
    } finally {
        await browser.close();
        console.log("Done.");
    }
})();
