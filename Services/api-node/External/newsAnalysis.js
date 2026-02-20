const https = require("https");
const { v4: uuid4 } = require("uuid");
const { client } = require("../db/dynamo.client");
const { ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

const Country_Table = process.env.CountryTable;
const News_Table = process.env.NewsTable;

function today() {
  return new Date().toISOString().split("T")[0];
}

function fetchGdelt(url) {
  return new Promise((resolve) => {
    https
      .get(url, (res) => {
        let data = "";

        res.on("data", (chunk) => (data += chunk));

        res.on("end", () => {
          if (res.statusCode !== 200) {
            resolve([]);
            return;
          }

          try {
            const json = JSON.parse(data);
            resolve(json.articles || []);
          } catch {
            resolve([]);
          }
        });
      })
      .on("error", () => resolve([]));
  });
}

exports.get = async () => {
  try {
    const todaydate = today();

    const countryUrls = {
      1: "https://api.gdeltproject.org/api/v2/doc/doc?query=(NSE%20OR%20BSE%20OR%20Nifty%20OR%20Sensex%20OR%20%22NIFTY%2050%22)&mode=artlist&timespan=1d&maxrecords=100&format=json",
      2: "https://api.gdeltproject.org/api/v2/doc/doc?query=(%22S%26P%20500%22%20OR%20%22Dow%20Jones%22%20OR%20Nasdaq%20OR%20NYSE)&mode=artlist&timespan=1d&maxrecords=100&format=json",
      3: "https://api.gdeltproject.org/api/v2/doc/doc?query=(%22Straits%20Times%20Index%22%20OR%20STI%20OR%20SGX)&mode=artlist&timespan=1d&maxrecords=100&format=json",
      4: "https://api.gdeltproject.org/api/v2/doc/doc?query=(%22Hang%20Seng%20Index%22%20OR%20HSI%20OR%20%22Hang%20Seng%22)&mode=artlist&timespan=1d&maxrecords=100&format=json",
    };

    const countrynews = {};

    // Fetch + sanitize
    for (const [country, url] of Object.entries(countryUrls)) {
      const articles = await fetchGdelt(url);

      countrynews[country] = articles.map((a) => ({
        title: a.title || "No Title",
        published: a.seendate || todaydate,
        url: a.url || "No URL",
      }));
    }

    // Convert format for DynamoDB
    const countryMap = {};
    Object.entries(countrynews).forEach(([countryCode, countryArray]) => {
      countryMap[countryCode] = countryArray.map((item) =>
        JSON.stringify(item),
      );
    });

    const now = new Date().toISOString();

    const scanResult = await client.send(
      new ScanCommand({ TableName: Country_Table }),
    );

    scanResult.Items.sort((a, b) => a.countryId - b.countryId);

    for (const element of scanResult.Items) {
      const data = countryMap[element.countryId];

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
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        date: todaydate,
        countrynews,
      }),
    };
  } catch (err) {
    console.log(err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message,
      }),
    };
  }
};
