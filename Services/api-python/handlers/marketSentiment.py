import sys
sys.path.append("./python")

import json
import requests
from datetime import date

def today():
    return date.today().isoformat()

def fetch_gdelt(url):
    r = requests.get(url, timeout=30)
    if r.status_code != 200:
        return []
    data = r.json()
    return data.get("articles", [])

def handler(event, context):
    todaydate = today()

    country_urls = {
        "1": "https://api.gdeltproject.org/api/v2/doc/doc?query=(NSE%20OR%20BSE%20OR%20Nifty%20OR%20Sensex%20OR%20%22NIFTY%2050%22)&mode=artlist&timespan=1d&maxrecords=20&format=json",
        "2": "https://api.gdeltproject.org/api/v2/doc/doc?query=(%22S%26P%20500%22%20OR%20%22Dow%20Jones%22%20OR%20Nasdaq%20OR%20NYSE)&mode=artlist&timespan=1d&maxrecords=20&format=json",
    }

    countrynews = {}

    for country, url in country_urls.items():
        articles = fetch_gdelt(url)

        countrynews[country] = []
        for a in articles:
            countrynews[country].append({
                "title": a.get("title"),
                "published": a.get("seendate")
            })

    return {
        "statusCode": 200,
        "body": json.dumps({
            "date": todaydate,
            "countrynews": countrynews
        })
    }
