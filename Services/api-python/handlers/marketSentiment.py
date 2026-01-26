import sys
sys.path.append("./python")

import json
import requests

def handler(event, context):
    url = "https://query1.finance.yahoo.com/v8/finance/chart/AAPL"

    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
    }

    response = requests.get(url, headers=headers, timeout=5)

    # DEBUG SAFETY
    if response.status_code != 200:
        return {
            "statusCode": response.status_code,
            "body": response.text[:200]
        }

    data = response.json()

    meta = data["chart"]["result"][0]["meta"]

    return {
        "statusCode": 200,
        "body": json.dumps({
            "price": meta.get("regularMarketPrice"),
            "currency": meta.get("currency"),
            "exchange": meta.get("exchangeName")
        })
    }
