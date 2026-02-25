const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { client } = require("../db/dynamo.client");
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const YahooFinance = require("yahoo-finance2").default;

FILTERED_NEWS = process.env.FilteredNews;

exports.get = async (event) => {
  try {
    //Table declaration
    const COUNTRY_TABLE = process.env.CountryTable;
    const SECTOR_TABLE = process.env.SectorDetailsTable;
    
    //Variable declaration
    const countryId = event.countryId;
    const country = event.country;
    const termId = event.termId;
    const termName = event.termName;
    const categoryId = event.categoryId;
    const categoryName = event.categoryName;
    const topFiveSectors = event.topFiveSectors || [];
    const array = event.array || [];

    var countryList = await client.send(new ScanCommand({ TableName: COUNTRY_TABLE }));//{id, countryName}
    countryList = (countryList.Items || []).filter(c => c.countryId == countryId).map(c => ({countryId: c.countryId, countryName: c.countryName}));


    const prompt = `
CATEGORY ANALYSIS

countryId Mapping:
${JSON.stringify(countryList, null, 2)}

Selected countryId: ${countryId}
Selected country: ${country}
Selected termId: ${termId}
Selected termName : ${termName}
Selected categoryId: ${categoryId}
Selected categoryName: ${categoryName}
Selected topFiveSectors: ${JSON.stringify(topFiveSectors, null, 2)}

IMPORTANT:
Only consider the stocks which are in criteria of selected country, term, category and topFiveSectors. which given factors
please do proper analysis over stocks which are having high probability of profit.

INSTRUCTION:

Perform stock selection using the following decision logic:

STEP 1 — Strictly took present & future News + Data Analysis
below insights which not to take in prediction
e.g. Not to consider in analysis -> Nifty 50 rise for the 2nd consecutive session ; IT sector was good as per 10 key highlights
below insights which to take in prediction
e.g. Consider in analysis -> Nifty 50 is expected to rise for the 3rd consecutive session as per recent news and data behaviour; IT sector's infosys is expected to be good today/tomorrow/afteronwards(based on term).

STEP 2 — HIERARCHY CHECK (STRICT MODE)

Check whether INPUT DATA contains stocks that match ALL hierarchy levels:

-> countryId
-> termId
-> categoryId
-> sectorId

If such stocks exist:

-> Select stocks ONLY from this filtered set  
-> Rank them by probability of profit  
-> Ignore stocks outside hierarchy  

STEP 3 — FALLBACK MODE (RELAXED MODE)

If NO stocks satisfy the full hierarchy:

-> Ignore hierarchy completely  
-> Evaluate ALL stocks from INPUT DATA  
-> Select stocks purely based on probability of profit  
-> Highest probability wins  

CRITICAL RULES:
-> NEVER introduce new stock names  
-> Use ONLY stocks present in INPUT DATA  
-> NEVER use external knowledge  
-> NEVER assume missing data  

CONTEXT:
Stock market stock prediction.

probabilityArr(variable):
Contains probability of profit and reason for selected stocks. Also taken care of below rules while generating probabilityArr
rule 1 :- var ctgry = //actual stock category where stock belongs to(dont get from input data)e.g. nifty50, nifty midcap 100 or small cap etc...,"sector"://actual stock sector where stock belongs to(dont get from input data)},
rule 2 :- var prefix = condition(countryId == 1 ? ".NS" : countryId == 3 ? "HK" : countryId == 4 ? "SI" : "")
rule 4 :- var yfi_stockName = stockName + prefix // we are using yahooFinance for getting stock data and news so consider the stock name with prefix while doing analysis and generating output e.g. "Infosys.NS","DBS.SI" etc..
e.g. [
  { "displayName": "Infosys", "stockName":yfi_stockName, "probability": 0.20, "category": ctgry },
  { "displayName": "HDFC", "stockName":yfi_stockName, "probability": 0.21, "category": ctgry },
  { "displayName": "TCS", "stockName":yfi_stockName, "probability": 0.32, "category": ctgry },
  { "displayName": "Dr.Reddy", "stockName":yfi_stockName, "probability": 0.42,"category": ctgry },
  { "displayName": "Reliance", "stockName":yfi_stockName, "probability": 0.21, "category": ctgry },
]
note - ctgry variable contains the instruction regarding analysis and output format

Suggested top five stocks based on probability with stockName, category and sector.

SUMMARY(variable):
Explain reasoning in 10 - 15 lines.

INPUT DATA:
${JSON.stringify(array, null, 2)}

OUTPUT FORMAT:
{
  "countryId": ${countryId},
  "termId": ${termId},
  "termName": ${termName},
  "categoryId": ${categoryId},
  "categoryName": ${categoryName},
  "topFiveSectors": ${topFiveSectors},
  "probabilityArr": probabilityArr,
  "summary": SUMMARY
}

OUTPUT RULES:
Return ONLY valid JSON.
No explanations outside JSON.
`;

    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0", // example
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }],
          },
        ],
      }),
    });

    console.log("Done the model analysis");

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(Buffer.from(response.body).toString());

    console.log("Parsed response body:", responseBody);

    let termSumm = "";
    let categorySumm = "";
    let sectorSumm = "";
    let stockName = "";

    var getnewsData = await client.send(
      new ScanCommand({
        TableName: FILTERED_NEWS,
        Key: { countryId: Number(countryId) },
      }),
    );

    console.log("first scan", getnewsData.Items);

    if (getnewsData.Items && getnewsData.Items.length > 0) {
      termSumm = getnewsData.Items[0].termSummery;
      categorySumm = getnewsData.Items[0].categorySummery;
      sectorSumm = getnewsData.Items[0].sectorSummery;
      stockName = getnewsData.Items[0].stockName;
    }

    const now = new Date().toISOString();
    let item = {
      countryId: Number(countryId),
      termSummery: termSumm,
      categorySummery: categorySumm,
      sectorSummery: sectorSumm,
      stockName:
        responseBody.content == null || responseBody.content.length == 0
          ? stockName
          : responseBody.content,
      createdDate: now,
      modifiedDate: now,
    };

    await client.send(
      new PutCommand({
        TableName: FILTERED_NEWS,
        Item: item,
      }),
    );

    console.log("*********************************************************************")

    // var getnewsDataUpdated = await client.send(
    //   new ScanCommand({
    //     TableName: FILTERED_NEWS,
    //     Key: { countryId: Number(countryId) },
    //   }),
    // );
    // const stockList = getnewsDataUpdated.Items[0].stockName;
    // console.log("stockList", stockList);
    // const parsed =
    //     typeof stockList === "string"
    //         ? JSON.parse(stockList)
    //         : stockList;
    // console.log("parsed stockList", parsed);
    // const today = new Date();
    // const period2 = formatDate(today);
    // const threeMonthsAgo = new Date(today);
    // threeMonthsAgo.setMonth(today.getMonth() - 3);
    // const period1 = formatDate(threeMonthsAgo);
    // const tempArray = [];
    // const yahooFinance = new YahooFinance();
    // for (var i = 0; i < stockList.length; i++) {
    //   var stock = stockList[i];
    //   const data = await yahooFinance.historical(stock.stockName, {
    //   period1: period1,
    //   period2: period2,
    //   interval: "1d"
    //   });
    //   tempArray.push({"stockName":stock.stockName, "dailyData": JSON.stringify(data), "probability": stock.probability});
    // }
    // console.log("tempArray", tempArray);
    //NOW AGAIN CALL LLM and pass the tempArray

    console.log("*********************************************************************")

    console.log("second save");
    return {
      statusCode: 200,
      body: JSON.stringify(responseBody),
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

function formatDate(date) {
  return date.toISOString().split("T")[0];
}
