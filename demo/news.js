import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

async function scrapper(claim) {
  if (!claim || typeof claim !== 'string' || !claim.trim()) {
    console.warn("Scrapper received an empty or invalid claim. Returning empty list.");
    return [];
  }

  const headlines = [];
  const query = encodeURIComponent(claim);
  const url = `https://www.google.com/search?q=${query}&hl=en&gl=US`;

  // ✅ Define Chrome options manually for headless mode
  const options = new chrome.Options();
  options.addArguments('--headless=new'); // Or just '--headless' for older versions
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    await driver.get(url);
    await driver.wait(until.elementsLocated(By.css('div.tF2Cxc h3')), 5000);

    const elements = await driver.findElements(By.css('div.tF2Cxc h3'));

    for (let i = 0; i < Math.min(3, elements.length); i++) {
      const text = await elements[i].getText();
      if (text) headlines.push(text);
    }
  } catch (err) {
    console.error(`Error scraping Google Search for claim "${claim}":`, err);
  } finally {
    await driver.quit();
  }

  return headlines;
}

export default scrapper;
