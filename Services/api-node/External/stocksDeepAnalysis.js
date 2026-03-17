import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../db/dynamo.client.js";
import yahooFinance from "yahoo-finance2";
import vader from "vader-sentiment";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const yf = new yahooFinance();

export const get = async (event) => {
  try {
    const Filtered_News = process.env.FilteredNews;
    const countryId = event.countryId;

    const getnewsData = await client.send(
      new ScanCommand({
        TableName: Filtered_News,
      })
    );

    const stockData = getnewsData.Items[0].stockName;
    const finalArr = [];

    // ✅ Fetch NIFTY ONCE
    const niftyData = await safeFetch(() =>
      yf.chart("^NSEI", { period1: "2024-01-01", interval: "1d" })
    );

    for (const element of stockData) {
      const stockname = element.displayName.toString();
      const stocksymbol = element.yahooFinanceFormat.toString();
      // const sectorSymbol = element.yahooFinanceSectorFormat.toString();

      const response = await generateFeatures(
        stockname,
        stocksymbol,
        // sectorSymbol,
        niftyData
      );

      if (response != null) {
        const mergedText = `${element.rawStockNews} ${element.keyCatalysts}`;

        const score =
          vader.SentimentIntensityAnalyzer.polarity_scores(mergedText)
            .compound;

        finalArr.push({
          ...response,
          keyCatalysts: element.keyCatalysts,
          rawStockNews: element.rawStockNews,
          newsDate: element.newsDate,
          sentimentscore: score,
        });
      }

      // ✅ Increased delay
      await delay(800);
    }

    const res = await callBedrock(JSON.stringify(finalArr));

    return finalArr;
  } catch (err) {
    console.log("ERROR:", err);
  }
};

// ------------------ HELPERS ------------------

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ✅ RETRY LOGIC
async function safeFetch(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fn();

      if (!res || !res.quotes || res.quotes.length === 0) {
        throw new Error("Empty data");
      }

      return res;
    } catch (err) {
      if (i === retries - 1) {
        console.log("Final failure:", err.message);
        return null;
      }

      await delay(500 * (i + 1));
    }
  }
}

// ------------------ CORE LOGIC ------------------

async function generateFeatures(
  stockname,
  stocksymbol,
  // sectorSymbol,
  niftyData
) {
  try {
    const res = await yf.search(stockname);
    const stock = res.quotes.find((q) => q.exchange === "NSI");
    const finalStockSymbol = stock?.symbol ?? stocksymbol;

    const now = Math.floor(Date.now() / 1000);
    const twoDaysAgo = now - 60 * 60 * 48;

    // ✅ Sequential calls
    const stockData = await fetchStockWithFallback(finalStockSymbol);

    await delay(200);

    // const sectorData = await safeFetch(() =>
    //   yf.chart(sectorSymbol, {
    //     period1: "2024-01-01",
    //     interval: "1d",
    //   })
    // );

    await delay(200);

    const intradayData = await safeFetch(() =>
      yf.chart(finalStockSymbol, {
        period1: twoDaysAgo,
        period2: now,
        interval: "5m",
      })
    );

    // ✅ Validate
    if (!stockData || !niftyData) {
      console.log("Skipping:", stockname);
      return null;
    }

    const quotes = stockData.quotes.filter((q) => q.close != null);
    const niftyQuotes = niftyData.quotes.filter((q) => q.close != null);
    // const sectorQuotes = sectorData.quotes.filter((q) => q.close != null);

    const closes = quotes.map((q) => q.close);
    const volumes = quotes.map((q) => q.volume);
    const highs = quotes.map((q) => q.high);
    const lows = quotes.map((q) => q.low);

    const last = closes.length - 1;
    const nLast = niftyQuotes.length - 1;
    // const sLast = sectorQuotes.length - 1;

    if (last < 120) throw new Error("Not enough data");

    // ✅ Price fallback
    let currentPrice = closes[last];

    if (intradayData && intradayData.quotes.length > 0) {
      const intradayQuotes = intradayData.quotes.filter(
        (q) => q.close != null
      );
      if (intradayQuotes.length > 0) {
        currentPrice =
          intradayQuotes[intradayQuotes.length - 1].close;
      }
    }

    closes[last] = currentPrice;

    const pctChange = (a, b) => (a - b) / b;

    const std = (arr) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return Math.sqrt(
        arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length
      );
    };

    // -------- RETURNS --------
    const return_1d = pctChange(currentPrice, closes[last - 1]);
    const return_5d = pctChange(currentPrice, closes[last - 5]);
    const return_20d = pctChange(currentPrice, closes[last - 20]);

    const momentum_60 = pctChange(currentPrice, closes[last - 60]);
    const momentum_120 = pctChange(currentPrice, closes[last - 120]);

    // -------- SUPPORT / RESISTANCE --------
    const support_20 = Math.min(...lows.slice(-20));
    const resistance_20 = Math.max(...highs.slice(-20));

    const support_50 = Math.min(...lows.slice(-50));
    const resistance_50 = Math.max(...highs.slice(-50));

    const support_80 = Math.min(...lows.slice(-80));
    const resistance_80 = Math.max(...highs.slice(-80));

    const distance_support_20 =
      (currentPrice - support_20) / support_20;

    const distance_resistance_20 =
      (resistance_20 - currentPrice) / resistance_20;

    const breakout_20 = currentPrice > resistance_20 ? 1 : 0;

    // -------- VOLUME --------
    const avgVolume20 =
      volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;

    const volume_today = volumes[last];
    const volume_ratio = volume_today / avgVolume20;

    const avgVolume5 =
      volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;

    const volume_trend_5d = avgVolume5 / avgVolume20;

    const volume_spike_flag = volume_ratio > 1.5 ? 1 : 0;

    // -------- MARKET --------
    const nifty_return_1d = pctChange(
      niftyQuotes[nLast].close,
      niftyQuotes[nLast - 1].close
    );

    // const sector_return = pctChange(
    //   sectorQuotes[sLast].close,
    //   sectorQuotes[sLast - 1].close
    // );

    const nifty_20d = pctChange(
      niftyQuotes[nLast].close,
      niftyQuotes[nLast - 20].close
    );

    const relative_strength = return_20d - nifty_20d;

    const market_volatility = std(
      niftyQuotes.slice(-20).map((q, i, arr) =>
        i > 0 ? pctChange(q.close, arr[i - 1].close) : 0
      )
    );

    return {
      stockname,
      price: currentPrice,
      return_1d,
      return_5d,
      return_20d,
      momentum_20: return_20d,
      momentum_60,
      momentum_120,
      volatility_20: std(closes.slice(-20)),
      volatility_60: std(closes.slice(-60)),
      volume_today,
      avg_volume_20d: avgVolume20,
      volume_ratio,
      volume_trend_5d,
      volume_spike_flag,
      support_20,
      resistance_20,
      support_50,
      resistance_50,
      support_80,
      resistance_80,
      distance_support_20,
      distance_resistance_20,
      breakout_20,
      nifty_return_1d,
      // sector_return,
      relative_strength,
      market_volatility,
    };
  } catch (err) {
    console.log(`Error in ${stockname}:`, err.message);
    return null;
  }
}

async function fetchStockWithFallback(symbol) {
  const now = Math.floor(Date.now() / 1000);

  // primary: ~6 months
  const sixMonthsAgo = now - (60 * 60 * 24 * 180);

  console.log("going...",symbol)
  let data = await safeFetch(() =>
    yf.chart(symbol, {
      period1: sixMonthsAgo,
      period2: now,
      interval: "1d",
    })
  );
    console.log("finish...",symbol)

  // ✅ if insufficient → retry with 100 days
  if (!data || !data.quotes || data.quotes.length < 40) {
    console.log("Retrying with 100 days:", symbol);

    const hundredDaysAgo = now - (60 * 60 * 24 * 100);

    await delay(800);

    data = await safeFetch(() =>
      yf.chart(symbol, {
        period1: hundredDaysAgo,
        period2: now,
        interval: "1d",
      })
    );
  }

  return data;
}

async function callBedrock(inputData) {
  const now_d = new Date();
  const todaydate = now_d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
  console.log("IN PROMPT");
  const prompt = `
INSTRUCTION :- You are a quantitative swing trading analysis engine.

Input:- 
->Stocks data:${inputData}
->Current Date and time:${todaydate}

Goal:
Estimate the probability of a profitable swing trade over the next 5 trading days.

Input contains:
• Current market indicators
• Stock momentum and volatility
• Volume activity
• Sector and market performance
• News sentiment and catalysts
• Support and resistance levels
• Timestamp of the news article (newsDate)
• Current system time

Important reasoning rule:

Use the difference between current time and newsDate to determine how relevant the news is.

If the news is very recent → it may still influence price.

If the news is several hours old and the stock price has already moved → assume the market has partially absorbed the information.

If the news is older and momentum contradicts sentiment → prioritize price behavior over sentiment.

Primary signals (highest importance):

1. Momentum acceleration
Compare momentum_20 vs momentum_60 vs momentum_120 to detect strengthening or weakening trends.

2. Sector and market alignment
Use sector_return, nifty_return_1d, and relative_strength to determine whether the stock is outperforming its sector and the broader market.

3. Volume confirmation
Use volume_ratio, volume_today, avg_volume_20d, and volume_trend_5d to detect institutional participation or accumulation.

4. Event impact
Evaluate keyCatalysts to determine whether there is a meaningful corporate catalyst.

5. Sentiment change
Use sentimentscore as a supporting signal rather than a primary driver.

Support and Resistance analysis:

Use support_20, support_50, support_60, support_80 and resistance_20, resistance_50, resistance_60, resistance_80 to evaluate price positioning.

Support interpretation rules:

If the current price is close to a support level and momentum is turning positive → potential bounce setup.

If price is significantly above support → reduced downside risk.

If price breaks below major support → bearish signal and reduce probability.

Resistance interpretation rules:

If price is approaching resistance with weak volume → risk of rejection.

If price is approaching resistance with strong volume_ratio (>1.5) → possible breakout.

If breakout_20 = 1 → strong continuation signal.

Distance interpretation:

Use distance_support_20 and distance_resistance_20 to evaluate proximity to key levels.

If price is very close to resistance and momentum weakens → reduce probability.

If price recently broke resistance and volume confirms → increase probability.

Volume interpretation rules:

If volume_ratio > 1.5 → strong participation or institutional activity.

If volume_trend_5d > 1 → possible accumulation.

If momentum is positive but volume_ratio < 1 → weak breakout.

If volume_spike_flag = 1 and momentum is positive → strong continuation signal.

Risk reduction rules:

Reduce probability when:

• volatility_20 or volatility_60 is significantly higher than market_volatility
• the stock underperforms its sector
• sentiment contradicts the price trend
• volume confirmation is missing
• price is near strong resistance without breakout confirmation

Analysis horizon:
Evaluate the probability of a profitable swing trade over the next 5 trading days.

Output requirements:

Return a JSON array containing:

Stock  
Sentiment Score  
Key Catalyst  
Probability of Profit  
Expected Growth  
5-Day Return  
Volume Ratio  
Volatility (20D)
TechnicalAnalysis

Output format:
[
{
"Stock": "ABC",
"Sentiment Score": 0.42,
"Key Catalyst": "Strong earnings guidance",
"Probability of Profit": 68,
"Expected Growth": "3% - 6%",
"5-Day Return": 0.021,
"Volume Ratio": 1.8,
"Volatility (20D)": 0.034,
"TechnicalAnalysis":"Generate summery & conclusion based on volumn, chart patterns, movementum, support-resistance and avg returns"
}
]

##Output Rules
Return strictly valid JSON.
Do not include explanations, markdown, or text outside the JSON structure.
`;

  // const command = new InvokeModelCommand({
  //   modelId: "anthropic.claude-3-sonnet-20240229-v1:0", // example
  //   contentType: "application/json",
  //   accept: "application/json",
  //   body: JSON.stringify({
  //     anthropic_version: "bedrock-2023-05-31",
  //     max_tokens: 2500,
  //     messages: [
  //       {
  //         role: "user",
  //         content: [{ type: "text", text: prompt }],
  //       },
  //     ],
  //   }),
  // });
  // console.log("Completed");
  // const response = await bedrockClient.send(command);
  // const responseBody = JSON.parse(Buffer.from(response.body).toString());
  // var text = responseBody.content[0].text;
  // console.log("kind of format", text);

  return {
    statusCode: "200",
    body: "Good to go",
  };
}
