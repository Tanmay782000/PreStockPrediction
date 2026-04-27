const API_KEY = "Sb43A6sTJNxxMHvtuVOtYAbDr91lbX2cts5JHRvY"; 

const BullStocks = {
 BAJFINANCE:    { token: "", symbol: "BAJFINANCE.NS",    exchange: "NSE" }, // Bajaj Finance
  BAJAJFINSV:    { token: "", symbol: "BAJAJFINSV.NS",    exchange: "NSE" }, // Bajaj Finserv
  LICI:          { token: "", symbol: "LICI.NS",          exchange: "NSE" }, // Life Insurance Corporation
  HDFCLIFE:      { token: "", symbol: "HDFCLIFE.NS",      exchange: "NSE" }, // HDFC Life Insurance
  SBILIFE:       { token: "", symbol: "SBILIFE.NS",       exchange: "NSE" }, // SBI Life Insurance
  ICICIPRULI:    { token: "", symbol: "ICICIPRULI.NS",    exchange: "NSE" }, // ICICI Prudential Life
  ICICIGI:       { token: "", symbol: "ICICIGI.NS",       exchange: "NSE" }, // ICICI Lombard General Insurance
  SBICARD:       { token: "", symbol: "SBICARD.NS",       exchange: "NSE" }, // SBI Cards
  CHOLAFIN:      { token: "", symbol: "CHOLAFIN.NS",      exchange: "NSE" }, // Cholamandalam Investment
  MUTHOOTFIN:    { token: "", symbol: "MUTHOOTFIN.NS",    exchange: "NSE" }, // Muthoot Finance
  SHRIRAMFIN:    { token: "", symbol: "SHRIRAMFIN.NS",    exchange: "NSE" }, // Shriram Finance
  PFC:           { token: "", symbol: "PFC.NS",           exchange: "NSE" }, // Power Finance Corporation
  RECLTD:        { token: "", symbol: "RECLTD.NS",        exchange: "NSE" }, // REC Limited
  IRFC:          { token: "", symbol: "IRFC.NS",          exchange: "NSE" }, // Indian Railway Finance Corp
  JIOFIN:        { token: "", symbol: "JIOFIN.NS",        exchange: "NSE" }, // Jio Financial Services
  BAJAJHLDNG:    { token: "", symbol: "BAJAJHLDNG.NS",    exchange: "NSE" }, // Bajaj Holdings
};

async function fetchNewsForStock(symbol) {
  const url = `https://api.marketaux.com/v1/news/all?symbols=${symbol}&filter_entities=true&language=en&api_token=${API_KEY}`;

  const res  = await fetch(url);
  const json = await res.json();

  if (json.error) {
    return [{ stockSymbol: symbol, news: `API Error: ${json.error.message}` }];
  }

  if (!json.data || json.data.length === 0) {
    return [{ stockSymbol: symbol, news: "No recent news found" }];
  }

  // Iterate through the entire data array instead of just index [0]
  const articles = json.data.map(article => ({
    stockSymbol: symbol,
    news:        article.title,
    description: article.description,
    url:         article.url,
    publishedAt: article.published_at,
    source:      article.source,
    // Marketaux often provides sentiment data, useful for your "Assassin" logic
    sentiment:   article.entities?.[0]?.sentiment_score || "N/A" 
  }));

  return articles;
}

async function fetchAllStockNews() {
  console.log("⏳ Fetching all available news for stocks...\n");

  const results = [];

  for (const [, stock] of Object.entries(BullStocks)) {
    try {
      const stockArticles = await fetchNewsForStock(stock.symbol);
      
      // Flattening the array into our final results
      results.push(...stockArticles);

      // Better logging: show how many articles were found for this symbol
      const firstItem = stockArticles[0].news;
      if (firstItem === "No recent news found" || firstItem.startsWith("API Error")) {
        console.log(`⚠️ ${stock.symbol}: ${firstItem}`);
      } else {
        console.log(`✅ ${stock.symbol}: Found ${stockArticles.length} articles (Latest: ${firstItem.substring(0, 50)}...)`);
      }

    } catch (err) {
      console.error(`❌ ${stock.symbol}: ${err.message}`);
      results.push({ stockSymbol: stock.symbol, news: `Error: ${err.message}` });
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n─── Final Result ────────────────────────────────────\n");
  console.log(JSON.stringify(results, null, 2));

  return results;
}

fetchAllStockNews();