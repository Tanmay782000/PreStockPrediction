const API_KEY = "Sb43A6sTJNxxMHvtuVOtYAbDr91lbX2cts5JHRvY"; 

const BullStocks = {
TATASTEEL: { token: "", symbol: "TATASTEEL.NS", exchange: "NSE" }, // Metal tailwind but weaker
TATAPOWER:     { token: "", symbol: "TATAPOWER.NS",     exchange: "NSE" }, // Tata Power
ADANIPORTS:    { token: "", symbol: "ADANIPORTS.NS",    exchange: "NSE" }, // Adani Ports & SEZ
ADANIENT:      { token: "", symbol: "ADANIENT.NS",      exchange: "NSE" }, // Adani Enterprises
COALINDIA:     { token: "", symbol: "COALINDIA.NS",     exchange: "NSE" }, // Coal India
NESTLEIND:     { token: "", symbol: "NESTLEIND.NS",     exchange: "NSE" }, // Nestle India
MARICO:        { token: "", symbol: "MARICO.NS",        exchange: "NSE" }, // Marico
JSWSTEEL:      { token: "", symbol: "JSWSTEEL.NS",      exchange: "NSE" }, // JSW Steel
BANDHANBNK:    { token: "", symbol: "BANDHANBNK.NS",    exchange: "NSE" }, // Bandhan Bank
DIVISLAB:      { token: "", symbol: "DIVISLAB.NS",      exchange: "NSE" }, // Divi's Laboratories
TITAN:         { token: "", symbol: "TITAN.NS",         exchange: "NSE" }, // Titan Company
  HAVELLS:       { token: "", symbol: "HAVELLS.NS",       exchange: "NSE" }, // Havells India
  DMART:         { token: "", symbol: "DMART.NS",         exchange: "NSE" }, // Avenue Supermarts (DMart)
  TRENT:         { token: "", symbol: "TRENT.NS",         exchange: "NSE" }, // Trent
 TATASTEEL:     { token: "", symbol: "TATASTEEL.NS",     exchange: "NSE" }, // Tata Steel
  HINDALCO:      { token: "", symbol: "HINDALCO.NS",      exchange: "NSE" }, // Hindalco Industries
  JSWSTEEL:      { token: "", symbol: "JSWSTEEL.NS",      exchange: "NSE" }, // JSW Steel
  VEDL:          { token: "", symbol: "VEDL.NS",          exchange: "NSE" }, // Vedanta
  SAIL:          { token: "", symbol: "SAIL.NS",          exchange: "NSE" }, // Steel Authority of India
   MARUTI:        { token: "", symbol: "MARUTI.NS",        exchange: "NSE" }, // Maruti Suzuki
  TATAMOTORS:    { token: "", symbol: "TMPV.NS",          exchange: "NSE" }, // Tata Motors
  M_M:           { token: "", symbol: "M&M.NS",           exchange: "NSE" }, // Mahindra & Mahindra
  BAJAJ_AUTO:    { token: "", symbol: "BAJAJ-AUTO.NS",    exchange: "NSE" }, // Bajaj Auto
  HEROMOTOCO:    { token: "", symbol: "HEROMOTOCO.NS",    exchange: "NSE" }, // Hero MotoCorp
  EICHERMOT:     { token: "", symbol: "EICHERMOT.NS",     exchange: "NSE" }, // Eicher Motors
  TVSMOTORS:     { token: "", symbol: "TVSMOTOR.NS",      exchange: "NSE" }, // TVS Motor
  BOSCHLTD:      { token: "", symbol: "BOSCHLTD.NS",      exchange: "NSE" }, // Bosch Ltd
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