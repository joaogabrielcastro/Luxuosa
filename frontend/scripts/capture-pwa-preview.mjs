import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
});
const page = await context.newPage();
await page.goto("http://127.0.0.1:4173/login", { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "Instale a Luxuosa" }).waitFor();
await page.screenshot({ path: "pwa-install-preview.png", fullPage: true });
await browser.close();
