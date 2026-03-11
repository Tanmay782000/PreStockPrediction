const https = require("https");
const { v4: uuid4 } = require("uuid");
const { client } = require("../db/dynamo.client");
const { ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

const Country_Table = process.env.CountryTable;
const News_Table = process.env.NewsTable;

function today() {
  return new Date().toISOString().split("T")[0];
}

// Helper for delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchGdelt(url) {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      console.log(`GDELT status for ${url}: ${res.statusCode}, headers:`, res.headers);

      // Response timeout (e.g., slow data stream)
      res.setTimeout(15000, () => {
        console.log(`Response timeout for ${url}`);
        req.destroy();
        resolve([]);
      });

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          console.log(`Non-200 status (${res.statusCode}) for ${url}, data length: ${data.length}`);
          resolve([]);
          return;
        }

        console.log(`Fetched ${data.length} bytes for ${url}`);
        try {
          const json = JSON.parse(data);
          const articles = json.articles || [];
          console.log(`Parsed ${articles.length} articles for ${url}`);
          resolve(articles);
        } catch (parseErr) {
          console.log(`JSON parse error for ${url}: ${parseErr.message}, data preview: ${data.substring(0, 200)}...`);
          resolve([]);
        }
      });
    });

    // Request timeout (e.g., no connection)
    req.setTimeout(10000, () => {
      console.log(`Connection timeout for ${url}`);
      req.destroy();
      resolve([]);
    });

    req.on("error", (err) => {
      console.log(`HTTPS error for ${url}: ${err.message}`);
      resolve([]);
    });
  });
}

exports.get = async () => {
  try {
    const todaydate = today();
    console.log("invoked");
    const countryUrls = {
      1: "https://api.gdeltproject.org/api/v2/doc/doc?query=(NSE%20OR%20BSE%20OR%20Nifty%20OR%20Sensex%20OR%20%22NIFTY%2050%22)&mode=artlist&timespan=1d&maxrecords=10&format=json",
      2: "https://api.gdeltproject.org/api/v2/doc/doc?query=(%22S%26P%20500%22%20OR%20%22Dow%20Jones%22%20OR%20Nasdaq%20OR%20NYSE)&mode=artlist&timespan=1d&maxrecords=10&format=json"
      // 3: "https://api.gdeltproject.org/api/v2/doc/doc?query=(%22Straits%20Times%20Index%22%20OR%20STI%20OR%20SGX)&mode=artlist&timespan=1d&maxrecords=10&format=json",
      // 4: "https://api.gdeltproject.org/api/v2/doc/doc?query=(%22Hang%20Seng%20Index%22%20OR%20HSI%20OR%20%22Hang%20Seng%22)&mode=artlist&timespan=1d&maxrecords=10&format=json",
    };
    console.log("invoked2");
    const countrynews = {};

    // Fetch + sanitize (sequential with delays for safety)
    for (const [country, url] of Object.entries(countryUrls)) {
      console.log(`Starting fetch for country ${country}`);
      let attempts = 0;
      let mappedArticles = [];

      while (attempts < 8) {
        const articles = await fetchGdelt(url);
        console.log(`Attempt ${attempts + 1} for country ${country}: ${articles.length} articles`);

        mappedArticles = (articles || []).map((a) => ({
          title: a?.title ?? "No Title",
          published: a?.seendate ?? todaydate,
          url: a?.url ?? "No URL",
        }));

        // check if at least one article has a real title
        const hasValidTitle = mappedArticles.some(
          (a) => a.title !== "No Title" && a.title.trim() !== "",  // Extra: skip empty strings too
        );

        console.log(`Country ${country} attempt ${attempts + 1} valid titles: ${hasValidTitle ? 'YES' : 'NO'}`);

        if (hasValidTitle) {
          console.log(`Success for country ${country} after ${attempts + 1} attempts`);
          break;
        }

        attempts++;
        if (attempts < 8) {
          console.log(`Retrying country ${country} in 2s...`);
          await delay(2000);  // Backoff delay
        }
      }

      countrynews[country] = mappedArticles;
      console.log(`Final articles for country ${country}: ${mappedArticles.length} (valid: ${mappedArticles.some(a => a.title !== "No Title" && a.title.trim() !== "")})`);

      // Delay between countries to avoid any global throttling
      if (country !== '4') {  // Skip after last
        console.log(`Delaying 1s before next country...`);
        await delay(1000);
      }
    }

    // Optional: Parallel version (uncomment if sequential still flakes; adds per-fetch delay)
    /*
    const fetchPromises = Object.entries(countryUrls).map(async ([country, url]) => {
      let attempts = 0;
      let mappedArticles = [];
      while (attempts < 8) {
        // ... same while loop as above, but await delay(500) between retries for parallelism
        // ...
      }
      return [country, mappedArticles];
    });
    const countryEntries = await Promise.all(fetchPromises);
    const countrynews = Object.fromEntries(countryEntries);
    */

    console.log("invoked3");
    console.log("Final countrynews summary:", JSON.stringify(Object.fromEntries(Object.entries(countrynews).map(([k,v]) => [k, v.length]))));

    // Convert format for DynamoDB (unchanged)
    const countryMap = {};
    Object.entries(countrynews).forEach(([countryCode, countryArray]) => {
      countryMap[countryCode] = countryArray.map((item) =>
        JSON.stringify(item),
      );
    });

    console.log("invoked4");
    const now = new Date().toISOString();

    const scanResult = await client.send(
      new ScanCommand({ TableName: Country_Table }),
    );

    console.log("Scanned countries:", scanResult.Items.map(i => i.countryId));
    scanResult.Items.sort((a, b) => a.countryId - b.countryId);
    console.log("invoked5");

    let putCount = 0;
    for (const element of scanResult.Items) {
      const data = countryMap[element.countryId];
      console.log(`Preparing put for country ${element.countryId}: ${data ? data.length : 0} items`);

      if (data && data.length > 0) {
        const item = {
          id: uuid4(),
          countryId: element.countryId,
          newsData: data,
          createdDate: now,
        };

        await client.send(
          new PutCommand({
            TableName: News_Table,
            Item: item,
          }),
        );
        putCount++;
        console.log(`Put success for country ${element.countryId}`);
      } else {
        console.log(`Skipping put for country ${element.countryId} (no data)`);
      }
    }

    console.log(`invoked6: Total puts: ${putCount}`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        date: todaydate,
        countrynews,
        puts: putCount,
      }),
    };
  } catch (err) {
    console.log("Top-level error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message,
      }),
    };
  }
};