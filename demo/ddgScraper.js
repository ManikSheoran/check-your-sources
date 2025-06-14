import fetch from 'node-fetch';
import { load } from 'cheerio';

export default async function ddgScraper(query) {
  const url    = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res    = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html   = await res.text();
  const $      = load(html);
  const links  = [];

  $('.result__title').slice(0, 5).each((i, el) => {
    const anchor = $(el).find('a.result__a');
    const title  = anchor.text().trim();
    const href   = anchor.attr('href');
    if (title && href) {
      links.push({ title, url: href });
    }
  });

  return links;
}
