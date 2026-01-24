import json
import yfinance as yf

def handler(event, context):
    symbol = event["symbol"]
    data = yf.Ticker(symbol).info
    return {
        "statusCode": 200,
        "body": json.dumps(data)
    }
