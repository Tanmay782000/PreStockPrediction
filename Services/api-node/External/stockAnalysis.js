const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { client } = require("../db/dynamo.client");
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
// const YahooFinance = require("yahoo-finance2").default;

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

INSTRUCTION:
give priority to stocks which have hierarchy of selected country, term, category otherwise give any stocks which are mentioned in raw data who 
having potential of rising & strictly took present & future News + Data Analysis based on date in raw data which is in UST, please convert it 
into IST and do the further analysis based on latest date and time zone.

CRITICAL RULES:
-> Never introduce new stock names if the hierarchy not preset then give the 
based stock based on categoryname and sector names.

CONTEXT:
Stock market stock prediction.

probabilityArr(variable):
Contains probability of profit and reason for selected stocks. Also taken care of below rules while generating probabilityArr
var ctgry = //actual stock category where stock belongs to(dont get from input data)e.g. nifty50, nifty midcap 100 or small cap etc...,"sector"://actual stock sector where stock belongs to(dont get from input data)},
Final Array :- Suggested top five stocks in below format
e.g. [
  { "displayName": Stock name,  "probability": proability of profit based on news, "category": ctgry, "KeyCatalysts" : 1 line Key Catalysts why stock will perform well},
]

SUMMARY(variable):
Explain reasoning in 20 - 25 lines.[IMPORTANT]

INPUT DATA:
${JSON.stringify(array, null, 2)}

OUTPUT RULES:
Return ONLY valid JSON.
No explanations outside JSON.

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
