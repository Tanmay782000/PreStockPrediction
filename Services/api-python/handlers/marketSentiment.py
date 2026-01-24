import yfinance as yf

def handler(event, context):
    # Fetch data for a stock (e.g., Apple)
    ticker = yf.Ticker("AAPL")
    
    # Get historical data (last 1 month)
    hist = ticker.history(period="1mo")
    print(hist)
    
    # Get current info
    info = ticker.info
    current_price = info.get('currentPrice')
    market_cap = info.get('marketCap')
    pe_ratio = info.get('trailingPE')
    
    print("Current Price:", current_price)
    print("Market Cap:", market_cap)
    print("PE Ratio:", pe_ratio)
    
    return {
        "Current Price": current_price,
        "Market Cap": market_cap,
        "PE Ratio": pe_ratio
    }
