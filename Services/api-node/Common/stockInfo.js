// Nifty 200 = Nifty 100 (Largecap) + Nifty Midcap 100
// Categories: "Nifty50" | "NiftyNext50" | "NiftyMidcap100"
// stockNameCategory: "Largecap" (Nifty 100 stocks) | "Midcap" (Nifty Midcap 100 stocks)
// Source: NSE Indices / smart-investing.in — April 2026

export const STOCKS = [

  // ============================================================
  // ==================== NIFTY 100 (LARGECAP) ==================
  // ============================================================

  // ================= FINANCIALS =================
  { symbol: "HDFCBANK.NS", sectorId: 2, sector: "Financials", category: "Nifty50", displayName: "HDFC Bank", stockNameCategory: "Largecap" },
  { symbol: "ICICIBANK.NS", sectorId: 2, sector: "Financials", category: "Nifty50", displayName: "ICICI Bank", stockNameCategory: "Largecap" },
  { symbol: "SBIN.NS", sectorId: 2, sector: "Financials", category: "Nifty50", displayName: "State Bank of India", stockNameCategory: "Largecap" },
  { symbol: "KOTAKBANK.NS", sectorId: 2, sector: "Financials", category: "Nifty50", displayName: "Kotak Mahindra Bank", stockNameCategory: "Largecap" },
  { symbol: "AXISBANK.NS", sectorId: 2, sector: "Financials", category: "Nifty50", displayName: "Axis Bank", stockNameCategory: "Largecap" },
  { symbol: "BAJFINANCE.NS", sectorId: 2, sector: "Financials", category: "Nifty50", displayName: "Bajaj Finance", stockNameCategory: "Largecap" },
  { symbol: "BAJAJFINSV.NS", sectorId: 2, sector: "Financials", category: "Nifty50", displayName: "Bajaj Finserv", stockNameCategory: "Largecap" },
  { symbol: "LICI.NS", sectorId: 2, sector: "Financials", category: "Nifty50", displayName: "Life Insurance Corporation of India", stockNameCategory: "Largecap" },
  { symbol: "INDUSINDBK.NS", sectorId: 2, sector: "Financials", category: "Nifty50", displayName: "IndusInd Bank", stockNameCategory: "Largecap" },
  { symbol: "HDFCLIFE.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "HDFC Life Insurance Company", stockNameCategory: "Largecap" },
  { symbol: "SBILIFE.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "SBI Life Insurance Company", stockNameCategory: "Largecap" },
  { symbol: "ICICIGI.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "ICICI Lombard General Insurance Company", stockNameCategory: "Largecap" },
  { symbol: "BANKBARODA.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "Bank of Baroda", stockNameCategory: "Largecap" },
  { symbol: "PFC.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "Power Finance Corporation", stockNameCategory: "Largecap" },
  { symbol: "RECLTD.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "REC", stockNameCategory: "Largecap" },
  { symbol: "HDFCAMC.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "HDFC Asset Management Company", stockNameCategory: "Largecap" },
  { symbol: "CHOLAFIN.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "Cholamandalam Investment and Finance Company", stockNameCategory: "Largecap" },
  { symbol: "MUTHOOTFIN.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "Muthoot Finance", stockNameCategory: "Largecap" },
  { symbol: "JIOFIN.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "Jio Financial Services", stockNameCategory: "Largecap" },
  { symbol: "SHRIRAMFIN.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "Shriram Finance", stockNameCategory: "Largecap" },
  { symbol: "BSE.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "BSE", stockNameCategory: "Largecap" },

  // ================= INFORMATION TECHNOLOGY =================
  { symbol: "TCS.NS", sectorId: 1, sector: "Information Technology", category: "Nifty50", displayName: "Tata Consultancy Services", stockNameCategory: "Largecap" },
  { symbol: "INFY.NS", sectorId: 1, sector: "Information Technology", category: "Nifty50", displayName: "Infosys", stockNameCategory: "Largecap" },
  { symbol: "HCLTECH.NS", sectorId: 1, sector: "Information Technology", category: "Nifty50", displayName: "HCL Technologies", stockNameCategory: "Largecap" },
  { symbol: "WIPRO.NS", sectorId: 1, sector: "Information Technology", category: "Nifty50", displayName: "Wipro", stockNameCategory: "Largecap" },
  { symbol: "TECHM.NS", sectorId: 1, sector: "Information Technology", category: "Nifty50", displayName: "Tech Mahindra", stockNameCategory: "Largecap" },
  { symbol: "LTIM.NS", sectorId: 1, sector: "Information Technology", category: "NiftyNext50", displayName: "LTIMindtree", stockNameCategory: "Largecap" },
  { symbol: "PERSISTENT.NS", sectorId: 1, sector: "Information Technology", category: "NiftyNext50", displayName: "Persistent Systems", stockNameCategory: "Largecap" },
  { symbol: "MPHASIS.NS", sectorId: 1, sector: "Information Technology", category: "NiftyNext50", displayName: "Mphasis", stockNameCategory: "Largecap" },

  // ================= ENERGY =================
  { symbol: "RELIANCE.NS", sectorId: 7, sector: "Energy", category: "Nifty50", displayName: "Reliance Industries", stockNameCategory: "Largecap" },
  { symbol: "ONGC.NS", sectorId: 7, sector: "Energy", category: "Nifty50", displayName: "Oil and Natural Gas Corporation", stockNameCategory: "Largecap" },
  { symbol: "NTPC.NS", sectorId: 7, sector: "Energy", category: "Nifty50", displayName: "NTPC", stockNameCategory: "Largecap" },
  { symbol: "POWERGRID.NS", sectorId: 7, sector: "Energy", category: "Nifty50", displayName: "Power Grid Corporation of India", stockNameCategory: "Largecap" },
  { symbol: "BPCL.NS", sectorId: 7, sector: "Energy", category: "Nifty50", displayName: "Bharat Petroleum Corporation", stockNameCategory: "Largecap" },
  { symbol: "ADANIPORTS.NS", sectorId: 7, sector: "Energy", category: "Nifty50", displayName: "Adani Ports and Special Economic Zone", stockNameCategory: "Largecap" },
  { symbol: "ADANIENT.NS", sectorId: 7, sector: "Energy", category: "Nifty50", displayName: "Adani Enterprises", stockNameCategory: "Largecap" },
  { symbol: "ADANIPOWER.NS", sectorId: 7, sector: "Energy", category: "NiftyNext50", displayName: "Adani Power", stockNameCategory: "Largecap" },
  { symbol: "ADANIGREEN.NS", sectorId: 7, sector: "Energy", category: "NiftyNext50", displayName: "Adani Green Energy", stockNameCategory: "Largecap" },
  { symbol: "ADANIENSOL.NS", sectorId: 7, sector: "Energy", category: "NiftyNext50", displayName: "Adani Energy Solutions", stockNameCategory: "Largecap" },
  { symbol: "IOC.NS", sectorId: 7, sector: "Energy", category: "NiftyNext50", displayName: "Indian Oil Corporation", stockNameCategory: "Largecap" },
  { symbol: "GAIL.NS", sectorId: 7, sector: "Energy", category: "NiftyNext50", displayName: "GAIL (India)", stockNameCategory: "Largecap" },
  { symbol: "COALINDIA.NS", sectorId: 7, sector: "Energy", category: "NiftyNext50", displayName: "Coal India", stockNameCategory: "Largecap" },
  { symbol: "TATAPOWER.NS", sectorId: 7, sector: "Energy", category: "NiftyNext50", displayName: "Tata Power Company", stockNameCategory: "Largecap" },

  // ================= CONSUMER STAPLES =================
  { symbol: "HINDUNILVR.NS", sectorId: 5, sector: "Consumer Staples", category: "Nifty50", displayName: "Hindustan Unilever", stockNameCategory: "Largecap" },
  { symbol: "ITC.NS", sectorId: 5, sector: "Consumer Staples", category: "Nifty50", displayName: "ITC", stockNameCategory: "Largecap" },
  { symbol: "NESTLEIND.NS", sectorId: 5, sector: "Consumer Staples", category: "Nifty50", displayName: "Nestle India", stockNameCategory: "Largecap" },
  { symbol: "BRITANNIA.NS", sectorId: 5, sector: "Consumer Staples", category: "Nifty50", displayName: "Britannia Industries", stockNameCategory: "Largecap" },
  { symbol: "DABUR.NS", sectorId: 5, sector: "Consumer Staples", category: "NiftyNext50", displayName: "Dabur India", stockNameCategory: "Largecap" },
  { symbol: "GODREJCP.NS", sectorId: 5, sector: "Consumer Staples", category: "NiftyNext50", displayName: "Godrej Consumer Products", stockNameCategory: "Largecap" },
  { symbol: "MARICO.NS", sectorId: 5, sector: "Consumer Staples", category: "NiftyNext50", displayName: "Marico", stockNameCategory: "Largecap" },
  { symbol: "TATACONSUM.NS", sectorId: 5, sector: "Consumer Staples", category: "NiftyNext50", displayName: "Tata Consumer Products", stockNameCategory: "Largecap" },
  { symbol: "COLPAL.NS", sectorId: 5, sector: "Consumer Staples", category: "NiftyNext50", displayName: "Colgate-Palmolive (India)", stockNameCategory: "Largecap" },
  { symbol: "VBL.NS", sectorId: 5, sector: "Consumer Staples", category: "NiftyNext50", displayName: "Varun Beverages", stockNameCategory: "Largecap" },

  // ================= CONSUMER DISCRETIONARY =================
  { symbol: "MARUTI.NS", sectorId: 4, sector: "Consumer Discretionary", category: "Nifty50", displayName: "Maruti Suzuki India", stockNameCategory: "Largecap" },
  { symbol: "M&M.NS", sectorId: 4, sector: "Consumer Discretionary", category: "Nifty50", displayName: "Mahindra & Mahindra", stockNameCategory: "Largecap" },
  { symbol: "EICHERMOT.NS", sectorId: 4, sector: "Consumer Discretionary", category: "Nifty50", displayName: "Eicher Motors", stockNameCategory: "Largecap" },
  { symbol: "BAJAJ-AUTO.NS", sectorId: 4, sector: "Consumer Discretionary", category: "Nifty50", displayName: "Bajaj Auto", stockNameCategory: "Largecap" },
  { symbol: "HEROMOTOCO.NS", sectorId: 4, sector: "Consumer Discretionary", category: "Nifty50", displayName: "Hero MotoCorp", stockNameCategory: "Largecap" },
  { symbol: "TITAN.NS", sectorId: 4, sector: "Consumer Discretionary", category: "Nifty50", displayName: "Titan Company", stockNameCategory: "Largecap" },
  { symbol: "TATAMOTORS.NS", sectorId: 4, sector: "Consumer Discretionary", category: "Nifty50", displayName: "Tata Motors", stockNameCategory: "Largecap" },
  { symbol: "ZOMATO.NS", sectorId: 4, sector: "Consumer Discretionary", category: "Nifty50", displayName: "Zomato", stockNameCategory: "Largecap" },
  { symbol: "TVSMOTOR.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyNext50", displayName: "TVS Motor Company", stockNameCategory: "Largecap" },
  { symbol: "TRENT.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyNext50", displayName: "Trent", stockNameCategory: "Largecap" },
  { symbol: "DMART.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyNext50", displayName: "Avenue Supermarts (D-Mart)", stockNameCategory: "Largecap" },
  { symbol: "NYKAA.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyNext50", displayName: "FSN E-Commerce Ventures (Nykaa)", stockNameCategory: "Largecap" },
  { symbol: "IRCTC.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyNext50", displayName: "Indian Railway Catering and Tourism Corporation", stockNameCategory: "Largecap" },
  { symbol: "INDIGO.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyNext50", displayName: "InterGlobe Aviation (IndiGo)", stockNameCategory: "Largecap" },
  { symbol: "JUBLFOOD.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyNext50", displayName: "Jubilant FoodWorks", stockNameCategory: "Largecap" },
  { symbol: "PAGEIND.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyNext50", displayName: "Page Industries", stockNameCategory: "Largecap" },
  { symbol: "MOTHERSON.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyNext50", displayName: "Samvardhana Motherson International", stockNameCategory: "Largecap" },

  // ================= HEALTHCARE / PHARMACEUTICALS =================
  { symbol: "SUNPHARMA.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "Nifty50", displayName: "Sun Pharmaceutical Industries", stockNameCategory: "Largecap" },
  { symbol: "CIPLA.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "Nifty50", displayName: "Cipla", stockNameCategory: "Largecap" },
  { symbol: "DRREDDY.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "Nifty50", displayName: "Dr. Reddy's Laboratories", stockNameCategory: "Largecap" },
  { symbol: "DIVISLAB.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "Nifty50", displayName: "Divi's Laboratories", stockNameCategory: "Largecap" },
  { symbol: "APOLLOHOSP.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyNext50", displayName: "Apollo Hospitals Enterprise", stockNameCategory: "Largecap" },
  { symbol: "AUROPHARMA.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyNext50", displayName: "Aurobindo Pharma", stockNameCategory: "Largecap" },
  { symbol: "TORNTPHARM.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyNext50", displayName: "Torrent Pharmaceuticals", stockNameCategory: "Largecap" },
  { symbol: "MAXHEALTH.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyNext50", displayName: "Max Healthcare Institute", stockNameCategory: "Largecap" },

  // ================= INDUSTRIALS =================
  { symbol: "LT.NS", sectorId: 6, sector: "Industrials", category: "Nifty50", displayName: "Larsen & Toubro", stockNameCategory: "Largecap" },
  { symbol: "BEL.NS", sectorId: 6, sector: "Industrials", category: "NiftyNext50", displayName: "Bharat Electronics", stockNameCategory: "Largecap" },
  { symbol: "HAL.NS", sectorId: 6, sector: "Industrials", category: "NiftyNext50", displayName: "Hindustan Aeronautics", stockNameCategory: "Largecap" },
  { symbol: "SIEMENS.NS", sectorId: 6, sector: "Industrials", category: "NiftyNext50", displayName: "Siemens", stockNameCategory: "Largecap" },
  { symbol: "ABB.NS", sectorId: 6, sector: "Industrials", category: "NiftyNext50", displayName: "ABB India", stockNameCategory: "Largecap" },
  { symbol: "HAVELLS.NS", sectorId: 6, sector: "Industrials", category: "NiftyNext50", displayName: "Havells India", stockNameCategory: "Largecap" },
  { symbol: "POLYCAB.NS", sectorId: 6, sector: "Industrials", category: "NiftyNext50", displayName: "Polycab India", stockNameCategory: "Largecap" },
  { symbol: "BHEL.NS", sectorId: 6, sector: "Industrials", category: "NiftyNext50", displayName: "Bharat Heavy Electricals", stockNameCategory: "Largecap" },
  { symbol: "CGPOWER.NS", sectorId: 6, sector: "Industrials", category: "NiftyNext50", displayName: "CG Power and Industrial Solutions", stockNameCategory: "Largecap" },
  { symbol: "CUMMINSIND.NS", sectorId: 6, sector: "Industrials", category: "NiftyNext50", displayName: "Cummins India", stockNameCategory: "Largecap" },
  { symbol: "ABBPOW.NS", sectorId: 6, sector: "Industrials", category: "NiftyNext50", displayName: "ABB Power Products & Systems India", stockNameCategory: "Largecap" },

  // ================= MATERIALS =================
  { symbol: "TATASTEEL.NS", sectorId: 8, sector: "Materials", category: "Nifty50", displayName: "Tata Steel", stockNameCategory: "Largecap" },
  { symbol: "JSWSTEEL.NS", sectorId: 8, sector: "Materials", category: "Nifty50", displayName: "JSW Steel", stockNameCategory: "Largecap" },
  { symbol: "HINDALCO.NS", sectorId: 8, sector: "Materials", category: "Nifty50", displayName: "Hindalco Industries", stockNameCategory: "Largecap" },
  { symbol: "GRASIM.NS", sectorId: 8, sector: "Materials", category: "Nifty50", displayName: "Grasim Industries", stockNameCategory: "Largecap" },
  { symbol: "ULTRACEMCO.NS", sectorId: 8, sector: "Materials", category: "NiftyNext50", displayName: "UltraTech Cement", stockNameCategory: "Largecap" },
  { symbol: "VEDL.NS", sectorId: 8, sector: "Materials", category: "NiftyNext50", displayName: "Vedanta", stockNameCategory: "Largecap" },
  { symbol: "PIDILITIND.NS", sectorId: 8, sector: "Materials", category: "NiftyNext50", displayName: "Pidilite Industries", stockNameCategory: "Largecap" },
  { symbol: "AMBUJACEM.NS", sectorId: 8, sector: "Materials", category: "NiftyNext50", displayName: "Ambuja Cements", stockNameCategory: "Largecap" },
  { symbol: "ACC.NS", sectorId: 8, sector: "Materials", category: "NiftyNext50", displayName: "ACC", stockNameCategory: "Largecap" },
  { symbol: "HINDZINC.NS", sectorId: 8, sector: "Materials", category: "NiftyNext50", displayName: "Hindustan Zinc", stockNameCategory: "Largecap" },
  { symbol: "ASIANPAINT.NS", sectorId: 8, sector: "Materials", category: "NiftyNext50", displayName: "Asian Paints", stockNameCategory: "Largecap" },
  { symbol: "SOLARA.NS", sectorId: 8, sector: "Materials", category: "NiftyNext50", displayName: "Solar Industries India", stockNameCategory: "Largecap" },

  // ================= COMMUNICATION SERVICES =================
  { symbol: "BHARTIARTL.NS", sectorId: 11, sector: "Communication Services", category: "Nifty50", displayName: "Bharti Airtel", stockNameCategory: "Largecap" },
  { symbol: "INDUSTOWER.NS", sectorId: 11, sector: "Communication Services", category: "NiftyNext50", displayName: "Indus Towers", stockNameCategory: "Largecap" },
  { symbol: "TATACOMM.NS", sectorId: 11, sector: "Communication Services", category: "NiftyNext50", displayName: "Tata Communications", stockNameCategory: "Largecap" },

  // ================= REAL ESTATE =================
  { symbol: "DLF.NS", sectorId: 10, sector: "Real Estate", category: "NiftyNext50", displayName: "DLF", stockNameCategory: "Largecap" },
  { symbol: "LODHA.NS", sectorId: 10, sector: "Real Estate", category: "NiftyNext50", displayName: "Macrotech Developers (Lodha)", stockNameCategory: "Largecap" },
  { symbol: "GODREJPROP.NS", sectorId: 10, sector: "Real Estate", category: "NiftyNext50", displayName: "Godrej Properties", stockNameCategory: "Largecap" },
  { symbol: "OBEROIRLTY.NS", sectorId: 10, sector: "Real Estate", category: "NiftyNext50", displayName: "Oberoi Realty", stockNameCategory: "Largecap" },
  { symbol: "PRESTIGE.NS", sectorId: 10, sector: "Real Estate", category: "NiftyNext50", displayName: "Prestige Estates Projects", stockNameCategory: "Largecap" },

  // ================= UTILITIES =================
  { symbol: "IRFC.NS", sectorId: 9, sector: "Utilities", category: "NiftyNext50", displayName: "Indian Railway Finance Corporation", stockNameCategory: "Largecap" },
  { symbol: "PNB.NS", sectorId: 9, sector: "Utilities", category: "NiftyNext50", displayName: "Punjab National Bank", stockNameCategory: "Largecap" },
  { symbol: "UNIONBANK.NS", sectorId: 9, sector: "Utilities", category: "NiftyNext50", displayName: "Union Bank of India", stockNameCategory: "Largecap" },
  { symbol: "INDIANB.NS", sectorId: 9, sector: "Utilities", category: "NiftyNext50", displayName: "Indian Bank", stockNameCategory: "Largecap" },
  { symbol: "CANBK.NS", sectorId: 9, sector: "Utilities", category: "NiftyNext50", displayName: "Canara Bank", stockNameCategory: "Largecap" },
  { symbol: "TORNTPOWER.NS", sectorId: 9, sector: "Utilities", category: "NiftyNext50", displayName: "Torrent Power", stockNameCategory: "Largecap" },

  // ============================================================
  // ================== NIFTY MIDCAP 100 =======================
  // ============================================================

  // ================= FINANCIALS (Midcap) =================
  { symbol: "IDFCFIRSTB.NS", sectorId: 2, sector: "Financials", category: "NiftyMidcap100", displayName: "IDFC First Bank", stockNameCategory: "Midcap" },
  { symbol: "FEDERALBNK.NS", sectorId: 2, sector: "Financials", category: "NiftyMidcap100", displayName: "Federal Bank", stockNameCategory: "Midcap" },
  { symbol: "BANDHANBNK.NS", sectorId: 2, sector: "Financials", category: "NiftyMidcap100", displayName: "Bandhan Bank", stockNameCategory: "Midcap" },
  { symbol: "AUBANK.NS", sectorId: 2, sector: "Financials", category: "NiftyMidcap100", displayName: "AU Small Finance Bank", stockNameCategory: "Midcap" },
  { symbol: "LICHSGFIN.NS", sectorId: 2, sector: "Financials", category: "NiftyMidcap100", displayName: "LIC Housing Finance", stockNameCategory: "Midcap" },
  { symbol: "M&MFIN.NS", sectorId: 2, sector: "Financials", category: "NiftyMidcap100", displayName: "Mahindra & Mahindra Financial Services", stockNameCategory: "Midcap" },
  { symbol: "POONAWALLA.NS", sectorId: 2, sector: "Financials", category: "NiftyMidcap100", displayName: "Poonawalla Fincorp", stockNameCategory: "Midcap" },
  { symbol: "ABCAPITAL.NS", sectorId: 2, sector: "Financials", category: "NiftyMidcap100", displayName: "Aditya Birla Capital", stockNameCategory: "Midcap" },
  { symbol: "KAJARIACER.NS", sectorId: 2, sector: "Financials", category: "NiftyMidcap100", displayName: "Kajaria Ceramics", stockNameCategory: "Midcap" },
  { symbol: "360ONE.NS", sectorId: 2, sector: "Financials", category: "NiftyMidcap100", displayName: "360 One WAM", stockNameCategory: "Midcap" },
  { symbol: "ANGELONE.NS", sectorId: 2, sector: "Financials", category: "NiftyMidcap100", displayName: "Angel One", stockNameCategory: "Midcap" },
  { symbol: "KFINTECH.NS", sectorId: 2, sector: "Financials", category: "NiftyMidcap100", displayName: "KFin Technologies", stockNameCategory: "Midcap" },

  // ================= INFORMATION TECHNOLOGY (Midcap) =================
  { symbol: "LTTS.NS", sectorId: 1, sector: "Information Technology", category: "NiftyMidcap100", displayName: "L&T Technology Services", stockNameCategory: "Midcap" },
  { symbol: "COFORGE.NS", sectorId: 1, sector: "Information Technology", category: "NiftyMidcap100", displayName: "Coforge", stockNameCategory: "Midcap" },
  { symbol: "CYIENT.NS", sectorId: 1, sector: "Information Technology", category: "NiftyMidcap100", displayName: "Cyient", stockNameCategory: "Midcap" },
  { symbol: "HAPPSTMNDS.NS", sectorId: 1, sector: "Information Technology", category: "NiftyMidcap100", displayName: "Happiest Minds Technologies", stockNameCategory: "Midcap" },
  { symbol: "TANLA.NS", sectorId: 1, sector: "Information Technology", category: "NiftyMidcap100", displayName: "Tanla Platforms", stockNameCategory: "Midcap" },
  { symbol: "KPITTECH.NS", sectorId: 1, sector: "Information Technology", category: "NiftyMidcap100", displayName: "KPIT Technologies", stockNameCategory: "Midcap" },
  { symbol: "TATAELXSI.NS", sectorId: 1, sector: "Information Technology", category: "NiftyMidcap100", displayName: "Tata Elxsi", stockNameCategory: "Midcap" },
  { symbol: "MASTEK.NS", sectorId: 1, sector: "Information Technology", category: "NiftyMidcap100", displayName: "Mastek", stockNameCategory: "Midcap" },

  // ================= HEALTHCARE (Midcap) =================
  { symbol: "ALKEM.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyMidcap100", displayName: "Alkem Laboratories", stockNameCategory: "Midcap" },
  { symbol: "BIOCON.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyMidcap100", displayName: "Biocon", stockNameCategory: "Midcap" },
  { symbol: "LUPIN.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyMidcap100", displayName: "Lupin", stockNameCategory: "Midcap" },
  { symbol: "FORTIS.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyMidcap100", displayName: "Fortis Healthcare", stockNameCategory: "Midcap" },
  { symbol: "METROPOLIS.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyMidcap100", displayName: "Metropolis Healthcare", stockNameCategory: "Midcap" },
  { symbol: "LALPATHLAB.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyMidcap100", displayName: "Dr. Lal PathLabs", stockNameCategory: "Midcap" },
  { symbol: "GRANULES.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyMidcap100", displayName: "Granules India", stockNameCategory: "Midcap" },
  { symbol: "GLAND.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyMidcap100", displayName: "Gland Pharma", stockNameCategory: "Midcap" },
  { symbol: "MANKIND.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyMidcap100", displayName: "Mankind Pharma", stockNameCategory: "Midcap" },

  // ================= CONSUMER DISCRETIONARY (Midcap) =================
  { symbol: "ASHOKLEY.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyMidcap100", displayName: "Ashok Leyland", stockNameCategory: "Midcap" },
  { symbol: "BALKRISIND.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyMidcap100", displayName: "Balkrishna Industries", stockNameCategory: "Midcap" },
  { symbol: "MINDA.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyMidcap100", displayName: "Uno Minda", stockNameCategory: "Midcap" },
  { symbol: "BATAINDIA.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyMidcap100", displayName: "Bata India", stockNameCategory: "Midcap" },
  { symbol: "ZYDUSLIFE.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyMidcap100", displayName: "Zydus Lifesciences", stockNameCategory: "Midcap" },
  { symbol: "VEDL.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyMidcap100", displayName: "Vedant Fashions", stockNameCategory: "Midcap" },
  { symbol: "KALYANKJIL.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyMidcap100", displayName: "Kalyan Jewellers India", stockNameCategory: "Midcap" },
  { symbol: "CROMPTON.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyMidcap100", displayName: "Crompton Greaves Consumer Electricals", stockNameCategory: "Midcap" },
  { symbol: "WHIRLPOOL.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyMidcap100", displayName: "Whirlpool of India", stockNameCategory: "Midcap" },
  { symbol: "PVRINOX.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyMidcap100", displayName: "PVR INOX", stockNameCategory: "Midcap" },

  // ================= CONSUMER STAPLES (Midcap) =================
  { symbol: "RADICO.NS", sectorId: 5, sector: "Consumer Staples", category: "NiftyMidcap100", displayName: "Radico Khaitan", stockNameCategory: "Midcap" },
  { symbol: "EMAMILTD.NS", sectorId: 5, sector: "Consumer Staples", category: "NiftyMidcap100", displayName: "Emami", stockNameCategory: "Midcap" },
  { symbol: "JYOTHYLAB.NS", sectorId: 5, sector: "Consumer Staples", category: "NiftyMidcap100", displayName: "Jyothy Labs", stockNameCategory: "Midcap" },
  { symbol: "BIKAJI.NS", sectorId: 5, sector: "Consumer Staples", category: "NiftyMidcap100", displayName: "Bikaji Foods International", stockNameCategory: "Midcap" },

  // ================= INDUSTRIALS (Midcap) =================
  { symbol: "BHARATFORG.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "Bharat Forge", stockNameCategory: "Midcap" },
  { symbol: "THERMAX.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "Thermax", stockNameCategory: "Midcap" },
  { symbol: "KEI.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "KEI Industries", stockNameCategory: "Midcap" },
  { symbol: "ESCORTS.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "Escorts Kubota", stockNameCategory: "Midcap" },
  { symbol: "BLUESTARCO.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "Blue Star", stockNameCategory: "Midcap" },
  { symbol: "SKFINDIA.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "SKF India", stockNameCategory: "Midcap" },
  { symbol: "TIMKEN.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "Timken India", stockNameCategory: "Midcap" },
  { symbol: "KSB.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "KSB", stockNameCategory: "Midcap" },
  { symbol: "FINCABLES.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "Finolex Cables", stockNameCategory: "Midcap" },
  { symbol: "AIAENG.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "AIA Engineering", stockNameCategory: "Midcap" },
  { symbol: "GRINDWELL.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "Grindwell Norton", stockNameCategory: "Midcap" },
  { symbol: "SUZLON.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "Suzlon Energy", stockNameCategory: "Midcap" },
  { symbol: "PREMIER.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "Premier Energies", stockNameCategory: "Midcap" },

  // ================= MATERIALS (Midcap) =================
  { symbol: "SAIL.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "Steel Authority of India", stockNameCategory: "Midcap" },
  { symbol: "JINDALSTEL.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "Jindal Steel & Power", stockNameCategory: "Midcap" },
  { symbol: "NATIONALUM.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "National Aluminium Company", stockNameCategory: "Midcap" },
  { symbol: "DALBHARAT.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "Dalmia Bharat", stockNameCategory: "Midcap" },
  { symbol: "RAMCOCEM.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "The Ramco Cements", stockNameCategory: "Midcap" },
  { symbol: "APLAPOLLO.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "APL Apollo Tubes", stockNameCategory: "Midcap" },
  { symbol: "SUPREMEIND.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "Supreme Industries", stockNameCategory: "Midcap" },
  { symbol: "ASTRAL.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "Astral", stockNameCategory: "Midcap" },
  { symbol: "MOIL.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "MOIL", stockNameCategory: "Midcap" },
  { symbol: "TATACHEM.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "Tata Chemicals", stockNameCategory: "Midcap" },
  { symbol: "DEEPAKNTR.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "Deepak Nitrite", stockNameCategory: "Midcap" },

  // ================= ENERGY (Midcap) =================
  { symbol: "OIL.NS", sectorId: 7, sector: "Energy", category: "NiftyMidcap100", displayName: "Oil India", stockNameCategory: "Midcap" },
  { symbol: "PETRONET.NS", sectorId: 7, sector: "Energy", category: "NiftyMidcap100", displayName: "Petronet LNG", stockNameCategory: "Midcap" },
  { symbol: "IGL.NS", sectorId: 7, sector: "Energy", category: "NiftyMidcap100", displayName: "Indraprastha Gas", stockNameCategory: "Midcap" },
  { symbol: "ATGL.NS", sectorId: 7, sector: "Energy", category: "NiftyMidcap100", displayName: "Adani Total Gas", stockNameCategory: "Midcap" },
  { symbol: "SJVN.NS", sectorId: 7, sector: "Energy", category: "NiftyMidcap100", displayName: "SJVN", stockNameCategory: "Midcap" },
  { symbol: "NLCINDIA.NS", sectorId: 7, sector: "Energy", category: "NiftyMidcap100", displayName: "NLC India", stockNameCategory: "Midcap" },
  { symbol: "JSWENERGY.NS", sectorId: 7, sector: "Energy", category: "NiftyMidcap100", displayName: "JSW Energy", stockNameCategory: "Midcap" },
  { symbol: "CESC.NS", sectorId: 7, sector: "Energy", category: "NiftyMidcap100", displayName: "CESC", stockNameCategory: "Midcap" },

  // ================= REAL ESTATE (Midcap) =================
  { symbol: "PHOENIXLTD.NS", sectorId: 10, sector: "Real Estate", category: "NiftyMidcap100", displayName: "Phoenix Mills", stockNameCategory: "Midcap" },
  { symbol: "BRIGADE.NS", sectorId: 10, sector: "Real Estate", category: "NiftyMidcap100", displayName: "Brigade Enterprises", stockNameCategory: "Midcap" },
  { symbol: "SOBHA.NS", sectorId: 10, sector: "Real Estate", category: "NiftyMidcap100", displayName: "Sobha", stockNameCategory: "Midcap" },
  { symbol: "SUNTECK.NS", sectorId: 10, sector: "Real Estate", category: "NiftyMidcap100", displayName: "Sunteck Realty", stockNameCategory: "Midcap" },

  // ================= COMMUNICATION SERVICES (Midcap) =================
  { symbol: "SUNTV.NS", sectorId: 11, sector: "Communication Services", category: "NiftyMidcap100", displayName: "Sun TV Network", stockNameCategory: "Midcap" },
  { symbol: "ZEEL.NS", sectorId: 11, sector: "Communication Services", category: "NiftyMidcap100", displayName: "Zee Entertainment Enterprises", stockNameCategory: "Midcap" },
  { symbol: "NAZARA.NS", sectorId: 11, sector: "Communication Services", category: "NiftyMidcap100", displayName: "Nazara Technologies", stockNameCategory: "Midcap" },
  { symbol: "SAREGAMA.NS", sectorId: 11, sector: "Communication Services", category: "NiftyMidcap100", displayName: "Saregama India", stockNameCategory: "Midcap" },
];

export const Bullish_STOCKS = [
  // ==================== NIFTY 100 (LARGECAP) ==================

  // ================= FINANCIALS =================
  { symbol: "ICICIBANK.NS", sectorId: 2, sector: "Financials", category: "Nifty50", displayName: "ICICI Bank", stockNameCategory: "Largecap" },
  { symbol: "SBIN.NS", sectorId: 2, sector: "Financials", category: "Nifty50", displayName: "State Bank of India", stockNameCategory: "Largecap" },
  { symbol: "PFC.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "Power Finance Corporation", stockNameCategory: "Largecap" },
  { symbol: "RECLTD.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "REC", stockNameCategory: "Largecap" },
  { symbol: "MUTHOOTFIN.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "Muthoot Finance", stockNameCategory: "Largecap" },

  // ================= INFORMATION TECHNOLOGY =================
  { symbol: "MPHASIS.NS", sectorId: 1, sector: "Information Technology", category: "NiftyNext50", displayName: "Mphasis", stockNameCategory: "Largecap" },

  // ================= ENERGY =================
  { symbol: "ONGC.NS", sectorId: 7, sector: "Energy", category: "Nifty50", displayName: "Oil and Natural Gas Corporation", stockNameCategory: "Largecap" },
  { symbol: "ADANIGREEN.NS", sectorId: 7, sector: "Energy", category: "NiftyNext50", displayName: "Adani Green Energy", stockNameCategory: "Largecap" },

  // ================= CONSUMER DISCRETIONARY =================
  { symbol: "TVSMOTOR.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyNext50", displayName: "TVS Motor Company", stockNameCategory: "Largecap" },
  { symbol: "IRCTC.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyNext50", displayName: "Indian Railway Catering and Tourism Corporation", stockNameCategory: "Largecap" },
  { symbol: "JUBLFOOD.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyNext50", displayName: "Jubilant FoodWorks", stockNameCategory: "Largecap" },

  // ================= HEALTHCARE / PHARMACEUTICALS =================
  { symbol: "AUROPHARMA.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyNext50", displayName: "Aurobindo Pharma", stockNameCategory: "Largecap" },

  // ================= INDUSTRIALS =================
  { symbol: "BEL.NS", sectorId: 6, sector: "Industrials", category: "NiftyNext50", displayName: "Bharat Electronics", stockNameCategory: "Largecap" },

  // ================= MATERIALS =================
  { symbol: "JSWSTEEL.NS", sectorId: 8, sector: "Materials", category: "Nifty50", displayName: "JSW Steel", stockNameCategory: "Largecap" },

  // ================= REAL ESTATE =================
  { symbol: "GODREJPROP.NS", sectorId: 10, sector: "Real Estate", category: "NiftyNext50", displayName: "Godrej Properties", stockNameCategory: "Largecap" },
  { symbol: "OBEROIRLTY.NS", sectorId: 10, sector: "Real Estate", category: "NiftyNext50", displayName: "Oberoi Realty", stockNameCategory: "Largecap" },

  // ================= UTILITIES =================
  { symbol: "UNIONBANK.NS", sectorId: 9, sector: "Utilities", category: "NiftyNext50", displayName: "Union Bank of India", stockNameCategory: "Largecap" },
  { symbol: "INDIANB.NS", sectorId: 9, sector: "Utilities", category: "NiftyNext50", displayName: "Indian Bank", stockNameCategory: "Largecap" },

  // ================== NIFTY MIDCAP 100 =======================

  // ================= FINANCIALS (Midcap) =================
  { symbol: "KFINTECH.NS", sectorId: 2, sector: "Financials", category: "NiftyMidcap100", displayName: "KFin Technologies", stockNameCategory: "Midcap" },

  // ================= INFORMATION TECHNOLOGY (Midcap) =================
  { symbol: "HAPPSTMNDS.NS", sectorId: 1, sector: "Information Technology", category: "NiftyMidcap100", displayName: "Happiest Minds Technologies", stockNameCategory: "Midcap" },

  // ================= HEALTHCARE (Midcap) =================
  { symbol: "GRANULES.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyMidcap100", displayName: "Granules India", stockNameCategory: "Midcap" },
  { symbol: "MANKIND.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyMidcap100", displayName: "Mankind Pharma", stockNameCategory: "Midcap" },

  // ================= CONSUMER DISCRETIONARY (Midcap) =================
  { symbol: "WHIRLPOOL.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyMidcap100", displayName: "Whirlpool of India", stockNameCategory: "Midcap" },

  // ================= INDUSTRIALS (Midcap) =================
  { symbol: "KEI.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "KEI Industries", stockNameCategory: "Midcap" },
  { symbol: "BLUESTARCO.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "Blue Star", stockNameCategory: "Midcap" },
  { symbol: "TIMKEN.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "Timken India", stockNameCategory: "Midcap" },
  { symbol: "KSB.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "KSB", stockNameCategory: "Midcap" },
  { symbol: "SUZLON.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "Suzlon Energy", stockNameCategory: "Midcap" },

  // ================= MATERIALS (Midcap) =================
  { symbol: "JINDALSTEL.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "Jindal Steel & Power", stockNameCategory: "Midcap" },
  { symbol: "NATIONALUM.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "National Aluminium Company", stockNameCategory: "Midcap" },
  { symbol: "DALBHARAT.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "Dalmia Bharat", stockNameCategory: "Midcap" },
  { symbol: "RAMCOCEM.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "The Ramco Cements", stockNameCategory: "Midcap" },
  { symbol: "SUPREMEIND.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "Supreme Industries", stockNameCategory: "Midcap" },
  { symbol: "ASTRAL.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "Astral", stockNameCategory: "Midcap" },
  { symbol: "MOIL.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "MOIL", stockNameCategory: "Midcap" },

  // ================= ENERGY (Midcap) =================
  { symbol: "PETRONET.NS", sectorId: 7, sector: "Energy", category: "NiftyMidcap100", displayName: "Petronet LNG", stockNameCategory: "Midcap" },
  { symbol: "ATGL.NS", sectorId: 7, sector: "Energy", category: "NiftyMidcap100", displayName: "Adani Total Gas", stockNameCategory: "Midcap" },

  // ================= REAL ESTATE (Midcap) =================
  { symbol: "SOBHA.NS", sectorId: 10, sector: "Real Estate", category: "NiftyMidcap100", displayName: "Sobha", stockNameCategory: "Midcap" },
];

export const Barish_STOCKS = [

  // ============================================================
  // ==================== NIFTY 100 (LARGECAP) ==================
  // ============================================================

  // ================= FINANCIALS =================
  { symbol: "SBIN.NS", sectorId: 2, sector: "Financials", category: "Nifty50", displayName: "State Bank of India", stockNameCategory: "Largecap" },
  { symbol: "HDFCAMC.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "HDFC Asset Management Company", stockNameCategory: "Largecap" },
  { symbol: "JIOFIN.NS", sectorId: 2, sector: "Financials", category: "NiftyNext50", displayName: "Jio Financial Services", stockNameCategory: "Largecap" },

  // ================= INFORMATION TECHNOLOGY =================
  { symbol: "HCLTECH.NS", sectorId: 1, sector: "Information Technology", category: "Nifty50", displayName: "HCL Technologies", stockNameCategory: "Largecap" },
  { symbol: "LTIM.NS", sectorId: 1, sector: "Information Technology", category: "NiftyNext50", displayName: "LTIMindtree", stockNameCategory: "Largecap" },

  // ================= ENERGY =================
  { symbol: "IOC.NS", sectorId: 7, sector: "Energy", category: "NiftyNext50", displayName: "Indian Oil Corporation", stockNameCategory: "Largecap" },
  { symbol: "ADANIGREEN.NS", sectorId: 7, sector: "Energy", category: "NiftyNext50", displayName: "Adani Green Energy", stockNameCategory: "Largecap" },

  // ================= CONSUMER DISCRETIONARY =================
  { symbol: "JUBLFOOD.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyNext50", displayName: "Jubilant FoodWorks", stockNameCategory: "Largecap" },

  // ================= INDUSTRIALS =================
  { symbol: "HAL.NS", sectorId: 6, sector: "Industrials", category: "NiftyNext50", displayName: "Hindustan Aeronautics", stockNameCategory: "Largecap" },
  { symbol: "BEL.NS", sectorId: 6, sector: "Industrials", category: "NiftyNext50", displayName: "Bharat Electronics", stockNameCategory: "Largecap" },

  // ================= MATERIALS =================
  { symbol: "ULTRACEMCO.NS", sectorId: 8, sector: "Materials", category: "NiftyNext50", displayName: "UltraTech Cement", stockNameCategory: "Largecap" },
  { symbol: "AMBUJACEM.NS", sectorId: 8, sector: "Materials", category: "NiftyNext50", displayName: "Ambuja Cements", stockNameCategory: "Largecap" },
  { symbol: "ACC.NS", sectorId: 8, sector: "Materials", category: "NiftyNext50", displayName: "ACC", stockNameCategory: "Largecap" },

  // ================= UTILITIES =================
  { symbol: "IRFC.NS", sectorId: 9, sector: "Utilities", category: "NiftyNext50", displayName: "Indian Railway Finance Corporation", stockNameCategory: "Largecap" },

  // ============================================================
  // ================== NIFTY MIDCAP 100 =======================
  // ============================================================

  // ================= FINANCIALS (Midcap) =================
  { symbol: "BANDHANBNK.NS", sectorId: 2, sector: "Financials", category: "NiftyMidcap100", displayName: "Bandhan Bank", stockNameCategory: "Midcap" },
  { symbol: "KAJARIACER.NS", sectorId: 2, sector: "Financials", category: "NiftyMidcap100", displayName: "Kajaria Ceramics", stockNameCategory: "Midcap" },

  // ================= INFORMATION TECHNOLOGY (Midcap) =================
  { symbol: "LTTS.NS", sectorId: 1, sector: "Information Technology", category: "NiftyMidcap100", displayName: "L&T Technology Services", stockNameCategory: "Midcap" },
  { symbol: "CYIENT.NS", sectorId: 1, sector: "Information Technology", category: "NiftyMidcap100", displayName: "Cyient", stockNameCategory: "Midcap" },
  { symbol: "HAPPSTMNDS.NS", sectorId: 1, sector: "Information Technology", category: "NiftyMidcap100", displayName: "Happiest Minds Technologies", stockNameCategory: "Midcap" },
  { symbol: "MASTEK.NS", sectorId: 1, sector: "Information Technology", category: "NiftyMidcap100", displayName: "Mastek", stockNameCategory: "Midcap" },

  // ================= HEALTHCARE (Midcap) =================
  { symbol: "FORTIS.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyMidcap100", displayName: "Fortis Healthcare", stockNameCategory: "Midcap" },
  { symbol: "MANKIND.NS", sectorId: 3, sector: "Healthcare / Pharmaceuticals", category: "NiftyMidcap100", displayName: "Mankind Pharma", stockNameCategory: "Midcap" },

  // ================= CONSUMER DISCRETIONARY (Midcap) =================
  { symbol: "ASHOKLEY.NS", sectorId: 4, sector: "Consumer Discretionary", category: "NiftyMidcap100", displayName: "Ashok Leyland", stockNameCategory: "Midcap" },

  // ================= CONSUMER STAPLES (Midcap) =================
  { symbol: "JYOTHYLAB.NS", sectorId: 5, sector: "Consumer Staples", category: "NiftyMidcap100", displayName: "Jyothy Labs", stockNameCategory: "Midcap" },

  // ================= INDUSTRIALS (Midcap) =================
  { symbol: "KSB.NS", sectorId: 6, sector: "Industrials", category: "NiftyMidcap100", displayName: "KSB", stockNameCategory: "Midcap" },

  // ================= MATERIALS (Midcap) =================
  { symbol: "JINDALSTEL.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "Jindal Steel & Power", stockNameCategory: "Midcap" },
  { symbol: "NATIONALUM.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "National Aluminium Company", stockNameCategory: "Midcap" },
  { symbol: "APLAPOLLO.NS", sectorId: 8, sector: "Materials", category: "NiftyMidcap100", displayName: "APL Apollo Tubes", stockNameCategory: "Midcap" },

  // ================= COMMUNICATION SERVICES (Midcap) =================
  { symbol: "SUNTV.NS", sectorId: 11, sector: "Communication Services", category: "NiftyMidcap100", displayName: "Sun TV Network", stockNameCategory: "Midcap" },
];