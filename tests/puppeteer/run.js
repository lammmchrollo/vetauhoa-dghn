const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const screenshotDir = path.join(__dirname, 'screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

async function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  try {
    console.log('FLOW-01: Tìm chuyến tàu');
    await page.goto(baseUrl, { waitUntil: 'networkidle0' });
    await page.click('#heroSearchForm button[type="submit"]');
    await page.waitForSelector('.trip-card', { timeout: 10000 });
    const tripCount = await page.$$eval('.trip-card', (items) => items.length);
    await assert(tripCount >= 1, 'Danh sách phải có ít nhất một chuyến');
    await page.screenshot({ path: path.join(screenshotDir, 'flow-01-search.png'), fullPage: true });
    console.log(`  PASS: tìm thấy ${tripCount} chuyến`);

    console.log('FLOW-02: Đăng nhập và xem vé của tôi');
    await page.click('#loginButton');
    await page.click('#loginForm .btn-primary');
    await page.waitForSelector('#userMenuButton:not(.hidden)', { timeout: 5000 });
    const avatarVisible = await page.$eval('#userMenuButton', (element) => !element.classList.contains('hidden'));
    await assert(avatarVisible, 'Avatar tài khoản phải hiển thị sau đăng nhập');
    await page.click('#userMenuButton');
    await page.waitForSelector('#accountView.active');
    await page.screenshot({ path: path.join(screenshotDir, 'flow-02-account.png'), fullPage: true });
    console.log('  PASS: đăng nhập và mở trang vé thành công');

    console.log('Puppeteer: 2/2 luồng PASS');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
