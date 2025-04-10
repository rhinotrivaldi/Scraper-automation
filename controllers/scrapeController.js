const puppeteer = require('puppeteer');
const { parse } = require('csv-parse/sync');

exports.scrapeAndParse = async (req, res) => {
  const {
    loginUrl,
    targetUrl,
    downloadUrl,
    username,
    password,
    filter,
    date
  } = req.body || {};

  if (!loginUrl || !targetUrl || !downloadUrl || !username || !password) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Blokir resource tidak perlu
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log('Navigating to login page...');
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });

    // Login (ganti selector input sesuai website)
    await page.type('#username', username);
    await page.type('#password', password);

    console.log('Submitting login form by pressing Enter...');
    await Promise.all([
      page.keyboard.press('Enter'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);

    // Verifikasi login berhasil
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('Login failed: still on login page');
    }

    const dashboardElement = await page.$('#home-page > div.d-flex.px-2 > a:nth-child(2)');
    if (!dashboardElement) {
      throw new Error('Login failed: dashboard element not found');
    }
    console.log('Login successful.');

    console.log('Navigating to target page...');
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });

    console.log('Fetching CSV content with session cookies...');
    const csvString = await page.evaluate(async (downloadUrl) => {
      const response = await fetch(downloadUrl, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch CSV: ' + response.status);
      }
      return await response.text();
    }, downloadUrl);

    if (csvString.trim().startsWith('<!DOCTYPE html') || csvString.includes('<html')) {
      throw new Error('Downloaded content is HTML, not CSV');
    }

    const records = parse(csvString, {
      columns: true,
      skip_empty_lines: true
    });

    console.log('CSV parsed successfully. Sending JSON response.');
    res.json(records);
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Scraping failed', details: error.message });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (err) {
        console.error('Error closing browser:', err);
      }
    }
  }
};
