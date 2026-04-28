/**
 * ┌──────────────────────────────────────────────────────────┐
 * │       Groww Multi-Index Top Gainers Scraper              │
 * │  Combines NIFTY 100 + NIFTY MIDCAP 100, deduplicates,   │
 * │  detects "In news" / label tags, saves JSON output.      │
 * └──────────────────────────────────────────────────────────┘
 *
 * Setup:
 *   npm install puppeteer-extra puppeteer-extra-plugin-stealth
 *
 * Run:
 *   node groww_scraper.js
 */

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";

puppeteer.use(StealthPlugin());

// ── Config ────────────────────────────────────────────────────────────────────
const URLS = [
  { label: "NIFTY 100",        url: "https://groww.in/markets/top-gainers?index=GIDXNIFTY100" },
  { label: "NIFTY MIDCAP 100", url: "https://groww.in/markets/top-gainers?index=GIDXNIFMDCP100" },
];

const SCROLL_STEP  = 400;   // px per scroll tick
const SCROLL_DELAY = 200;   // ms between ticks
const RENDER_WAIT  = 3000;  // ms after scroll completes
const PAGE_TIMEOUT = 60000;
const ROW_WAIT     = 25000;

// ── Auto-scroll: triggers virtualised/lazy-loaded rows ────────────────────────
async function autoScroll(page) {
  await page.evaluate(async (step, delay) => {
    await new Promise((resolve) => {
      let total = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        if (total >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, delay);
    });
  }, SCROLL_STEP, SCROLL_DELAY);
}

// ── Scrape one Groww page ─────────────────────────────────────────────────────
async function scrapePage(browser, { label, url }) {
  console.log(`\n🌐  [${label}]`);
  console.log(`    ${url}`);

  const page = await browser.newPage();

  // Mimic a real Windows Chrome browser
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1440, height: 900 });
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "sec-ch-ua": '"Chromium";v="124","Google Chrome";v="124","Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
  });

  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
  console.log(`    HTTP ${response.status()}`);

  if (response.status() === 403) {
    console.error("    ❌ 403 Forbidden – Groww blocked this request.");
    await page.close();
    return [];
  }

  // Wait for React to hydrate: look for any leaf element starting with ₹
  try {
    await page.waitForFunction(
      () => [...document.querySelectorAll("*")].some(
        (el) => el.children.length === 0 && el.innerText?.startsWith("₹")
      ),
      { timeout: ROW_WAIT }
    );
    console.log("    ✅ Page hydrated – prices found.");
  } catch {
    console.warn("    ⚠️  Timed out waiting for prices. Scraping what is rendered.");
  }

  // Scroll to trigger any lazy-loaded rows
  await autoScroll(page);
  await new Promise((r) => setTimeout(r, RENDER_WAIT));

  // ── DOM extraction ─────────────────────────────────────────────────────────
  // Groww does NOT use a <table>. It renders custom React div rows.
  // We anchor on price elements (₹…) and walk up to the row container.
  const stocks = await page.evaluate((sourceLabel) => {
    const results = [];
    const seen    = new Set();
    const clean   = (s) => (s || "").replace(/\s+/g, " ").trim();

    // Find all leaf text nodes that start with ₹ (price cells)
    const priceLeaves = [...document.querySelectorAll("*")].filter(
      (el) => el.children.length === 0 && /^₹[\d,]+/.test(el.innerText?.trim())
    );

    priceLeaves.forEach((priceEl) => {
      // Walk up up to 8 levels to find the full row container
      let row = priceEl;
      for (let i = 0; i < 8; i++) {
        if (!row.parentElement) break;
        row = row.parentElement;
        const t = row.innerText || "";
        // Row must contain letters (name) + price (₹) + percentage (%)
        if (/[A-Za-z]{4,}/.test(t) && /₹[\d,]+/.test(t) && /%\)/.test(t)) break;
      }

      const fullText = clean(row.innerText);
      const key = fullText.slice(0, 30);
      if (!fullText || seen.has(key)) return;
      seen.add(key);

      const lines = fullText.split("\n").map(clean).filter(Boolean);

      // Company name: first line that looks like a proper noun (letters, not ₹, not digits)
      const nameLine = lines.find(
        (l) => /^[A-Z][A-Za-z &.()'-]{2,}/.test(l) && !l.startsWith("₹") && !/^\d/.test(l)
      ) || "";

      // Tag: short label that is NOT the name, NOT a number, NOT a price
      // e.g. "In news", "Results yesterday", "52W high", "Bonus"
      const tagLine = lines.find(
        (l) =>
          l !== nameLine &&
          l.length > 0 && l.length < 50 &&
          !l.startsWith("₹") &&
          !/^\d/.test(l) &&
          /^[A-Za-z]/.test(l)
      ) || "NA";

      // Price: first line starting with ₹
      const priceLine = lines.find((l) => /^₹[\d,]+/.test(l)) || "";

      // Change: line with +/- and (%)
      const changeLine = lines.find((l) => /[+\-][\d.]+.*%/.test(l)) || "";

      // Volume: standalone numeric line (commas allowed)
      const volLine = lines.find((l) => /^[\d,]+$/.test(l.replace(/\s/g, ""))) || "";

      if (nameLine) {
        results.push({ name: nameLine, tag: tagLine, price: priceLine, change: changeLine, volume: volLine, source: sourceLabel });
      }
    });

    // Fallback: standard <table> in case Groww reverts to one
    if (results.length === 0) {
      document.querySelectorAll("table tbody tr").forEach((row) => {
        const cells = [...row.querySelectorAll("td")];
        if (cells.length < 2) return;
        const lines = (cells[0]?.innerText || "").split("\n").map(clean).filter(Boolean);
        const name   = lines[0] || "";
        const tag    = lines.slice(1).find((l) => l.length < 50) || "NA";
        const price  = cells[1]?.innerText?.trim() || "";
        const change = cells[2]?.innerText?.trim() || "";
        const volume = cells[cells.length - 1]?.innerText?.trim() || "";
        if (name) results.push({ name, tag, price, change, volume, source: sourceLabel });
      });
    }

    return results;
  }, label);

  await page.close();
  console.log(`    📦 ${stocks.length} stocks extracted`);
  return stocks;
}

// ── Deduplicate by normalised company name ────────────────────────────────────
function deduplicate(stocks) {
  const seen = new Set();
  return stocks.filter(({ name }) => {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Console table printer ─────────────────────────────────────────────────────
function printTable(stocks) {
  const W    = { i: 4, name: 38, tag: 22, price: 13, change: 18, vol: 16, src: 20 };
  const LINE = "─".repeat(Object.values(W).reduce((a, b) => a + b + 1, 0));
  const p    = (s, w) => String(s ?? "").slice(0, w).padEnd(w);

  console.log("\n" + LINE);
  console.log(
    p("#", W.i)       + " " + p("Company", W.name)   + " " +
    p("Tag", W.tag)   + " " + p("Price", W.price)    + " " +
    p("Change", W.change) + " " + p("Volume", W.vol) + " " +
    p("Source", W.src)
  );
  console.log(LINE);
  stocks.forEach((s, i) => {
    console.log(
      p(i + 1, W.i)    + " " + p(s.name, W.name)     + " " +
      p(s.tag, W.tag)  + " " + p(s.price, W.price)   + " " +
      p(s.change, W.change) + " " + p(s.volume, W.vol) + " " +
      p(s.source, W.src)
    );
  });
  console.log(LINE);
}

// ── Save JSON output ──────────────────────────────────────────────────────────
function saveJSON(stocks) {
  const file = `groww_gainers_${Date.now()}.json`;
  fs.writeFileSync(
    file,
    JSON.stringify({ scrapedAt: new Date().toISOString(), count: stocks.length, stocks }, null, 2)
  );
  console.log(`\n💾  Saved → ${file}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log("═".repeat(65));
  console.log("  📈  Groww Multi-Index Top Gainers Scraper");
  console.log(`  🕐  ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`);
  console.log("═".repeat(65));

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1440,900",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  let all = [];
  for (const src of URLS) {
    try {
      const stocks = await scrapePage(browser, src);
      all = all.concat(stocks);
    } catch (err) {
      console.error(`❌  [${src.label}] ${err.message}`);
    }
  }

  await browser.close();

  if (!all.length) {
    console.log("\n❌  No data scraped. Check network or if Groww changed its layout.");
    process.exit(1);
  }

  const unique   = deduplicate(all);
  const dupes    = all.length - unique.length;
  const tagged   = unique.filter((s) => s.tag !== "NA");
  const untagged = unique.filter((s) => s.tag === "NA");

  console.log(`\n${"─".repeat(65)}`);
  console.log(`  📊 Summary`);
  console.log(`  Total scraped          : ${all.length}  (${dupes} duplicates removed)`);
  console.log(`  Unique stocks          : ${unique.length}`);
  console.log(`  With label tag         : ${tagged.length}`);
  console.log(`  No tag (NA)            : ${untagged.length}`);

  if (tagged.length) {
    console.log(`\n  🏷️  Tagged stocks:`);
    tagged.forEach((s) => console.log(`     • ${s.name.padEnd(38)} [${s.tag}]  (${s.source})`));
  }

  printTable(unique);
  saveJSON(unique);
})();