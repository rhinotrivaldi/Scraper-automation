const puppeteer = require('puppeteer');
const { parse } = require('csv-parse/sync');

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    browserPromise
      .then((browser) => browser.on('disconnected', () => { browserPromise = null; }))
      .catch(() => { browserPromise = null; });
  }
  return browserPromise;
}

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

  let context;
  try {
    const browser = await getBrowser();
    context = await browser.createBrowserContext();
    const page = await context.newPage();

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

    await page.type('#username', username);
    await page.type('#password', password);

    console.log('Submitting login form by pressing Enter...');
    await Promise.all([
      page.keyboard.press('Enter'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);

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

    const csvUrl = new URL(downloadUrl);
    if (filter && typeof filter === 'object') {
      for (const [key, value] of Object.entries(filter)) csvUrl.searchParams.set(key, value);
    } else if (filter) {
      csvUrl.searchParams.set('filter', filter);
    }
    if (date) csvUrl.searchParams.set('date', date);

    console.log('Fetching CSV content with session cookies...');
    const csvString = await page.evaluate(async (downloadUrl) => {
      const response = await fetch(downloadUrl, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch CSV: ' + response.status);
      }
      return await response.text();
    }, csvUrl.toString());

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
    if (context) {
      try {
        await context.close();
      } catch (err) {
        console.error('Error closing browser context:', err);
      }
    }
  }
};
