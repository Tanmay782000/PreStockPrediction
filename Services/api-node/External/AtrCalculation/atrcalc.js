import yahooFinance from "yahoo-finance2";

const yf = new yahooFinance();

const average = (arr) =>
  arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

// ================================================================
//  ATR CALCULATION
//  Uses last 20 candles to calculate Average True Range
//  TR = max(high-low, |high-prevClose|, |low-prevClose|)
// ================================================================
async function calculateIntradayATR(quotes, period = 20) {
  if (quotes.length < period + 1) return 0;
  const recent = quotes.slice(-(period + 1));
  const trs = [];
  for (let i = 1; i < recent.length; i++) {
    const tr = Math.max(
      recent[i].high - recent[i].low,
      Math.abs(recent[i].high - recent[i - 1].close),
      Math.abs(recent[i].low - recent[i - 1].close),
    );
    trs.push(tr);
  }
  return average(trs);
}

// ================================================================
//  ATR BASED RR CALCULATOR — 1:2 RATIO
//  Entry  : last candle close
//  SL     : entry - (1 × ATR)
//  Target : entry + (2 × ATR)
//  RR     : 1:2 always
// ================================================================
async function getATRBasedRR(symbol) {
  try {
    console.log(`\n📊 Fetching data for ${symbol}...`);

    // Fetch last 48 hours of 15m candles
    const intradayData = await yf.chart(`${symbol}.NS`, {
      period1: Math.floor(Date.now() / 1000) - 48 * 60 * 60,
      interval: "15m",
    });

    const quotes = intradayData.quotes.filter(
      (q) => q.close && q.volume && q.high && q.low
    );

    if (quotes.length < 21) {
      return {
        symbol,
        error: `Insufficient data — only ${quotes.length} candles available (need 21+)`
      };
    }

    // ── LAST CANDLE (current price) ───────────────────────────────
    const lastCandle  = quotes[quotes.length - 1];
    const entryPrice  = lastCandle.close;

    // ── ATR CALCULATION ───────────────────────────────────────────
    const atrValue    = await calculateIntradayATR(quotes, 20);

    if (atrValue === 0) {
      return { symbol, error: "ATR calculation failed — not enough data" };
    }

    // ── 1:2 RR LEVELS ─────────────────────────────────────────────
    // SL     = 1x ATR below entry
    // Target = 2x ATR above entry
    const stopLoss    = entryPrice - (atrValue * 1);
    const target      = entryPrice + (atrValue * 2);

    // ── ATR AS % OF PRICE ─────────────────────────────────────────
    const atrPercent  = ((atrValue / entryPrice) * 100).toFixed(3);

    // ── CANDLE INFO ───────────────────────────────────────────────
    const lastCandleTime = new Date(lastCandle.date).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata"
    });

    // ── RESULT ────────────────────────────────────────────────────
    return {
      symbol,
      lastCandleTime,
      entryPrice:   entryPrice.toFixed(2),
      atrValue:     atrValue.toFixed(2),
      atrPercent:   `${atrPercent}%`,
      stopLoss:     stopLoss.toFixed(2),
      target:       target.toFixed(2),
      riskAmount:   (entryPrice - stopLoss).toFixed(2),
      rewardAmount: (target - entryPrice).toFixed(2),
      riskReward:   "1:2",
      // ── POSITION SIZING HELPER ───────────────────────────────────
      // How many shares to buy for ₹5,000 risk per trade
      sharesFor5KRisk: Math.floor(5000 / (entryPrice - stopLoss)),
      capitalNeeded:   (Math.floor(5000 / (entryPrice - stopLoss)) * entryPrice).toFixed(2)
    };

  } catch (err) {
    return {
      symbol,
      error: err.message?.slice(0, 80) || "Unknown error"
    };
  }
}

// ================================================================
//  DISPLAY — Clean output for each stock
// ================================================================
function displayResult(result) {
  if (result.error) {
    console.log(`\n❌ ${result.symbol} — ${result.error}`);
    return;
  }

  console.log(`\n${"═".repeat(55)}`);
  console.log(`📌 ${result.symbol} — ATR Based RR (1:2)`);
  console.log(`${"─".repeat(55)}`);
  console.log(`  ⏰ Last Candle  : ${result.lastCandleTime}`);
  console.log(`  💰 Entry Price  : ₹${result.entryPrice}`);
  console.log(`  📊 ATR Value    : ₹${result.atrValue} (${result.atrPercent} of price)`);
  console.log(`${"─".repeat(55)}`);
  console.log(`  🎯 Target       : ₹${result.target}  (+₹${result.rewardAmount})`);
  console.log(`  🛑 Stop Loss    : ₹${result.stopLoss}  (-₹${result.riskAmount})`);
  console.log(`  ⚖️  Risk/Reward  : ${result.riskReward}`);
  console.log(`${"─".repeat(55)}`);
  console.log(`  📦 For ₹5K Risk : ${result.sharesFor5KRisk} shares`);
  console.log(`  💵 Capital Needed: ₹${result.capitalNeeded}`);
  console.log(`${"═".repeat(55)}`);
}

// ================================================================
//  MAIN — Run for multiple stocks
// ================================================================
async function main() {
  // ── ADD YOUR STOCKS HERE ─────────────────────────────────────
  const stocks = [
    "SBIN",
    "ICICIBANK",
    "TATAMOTORS",
    "INFY",
    "HDFCBANK",
    "WIPRO",
    "TCS",
    "AXISBANK"
  ];
  // ─────────────────────────────────────────────────────────────

  console.log("🚀 ATR Based RR Calculator — 1:2 Ratio");
  console.log(`📅 ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`);
  console.log(`📊 Scanning ${stocks.length} stocks...\n`);

  for (const symbol of stocks) {
    const result = await getATRBasedRR(symbol);
    displayResult(result);

    // Rate limit — be gentle with Yahoo Finance
    await new Promise(r => setTimeout(r, 300));
  }

  console.log("\n✅ Scan Complete");
}

await main();