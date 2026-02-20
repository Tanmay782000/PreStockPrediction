const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { client } = require("../db/dynamo.client");
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

FILTERED_NEWS = process.env.FilteredNews;

exports.get = async (event) => {
  try {
    const countryId = event.countryId;
    const country = event.country;
    const termId = event.termId;
    const termName = event.termName;
    const categoryId = event.categoryId;
    const categoryName = event.categoryName;
    const topThreeSectors = event.topThreeSectors || [];
    const array = event.array || [];

    const prompt = `
CATEGORY ANALYSIS

countryId Mapping:
1 -> India
2 -> USA
3 -> China
4 -> Singapore

Selected countryId: ${countryId}
Selected country: ${country}
Selected termId: ${termId}
Selected termName : ${termName}
Selected categoryId: ${categoryId}
Selected categoryName: ${categoryName}
Selected topThreeSectors: ${JSON.stringify(topThreeSectors, null, 2)}

IMPORTANT:
Only consider the stocks which are in criteria of selected country, term, category and topThreeSectors. which given factors
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

• countryId
• termId
• categoryId
• sectorId

If such stocks exist:

✔ Select stocks ONLY from this filtered set  
✔ Rank them by probability of profit  
✔ Ignore stocks outside hierarchy  

---

STEP 3 — FALLBACK MODE (RELAXED MODE)

If NO stocks satisfy the full hierarchy:

✔ Ignore hierarchy completely  
✔ Evaluate ALL stocks from INPUT DATA  
✔ Select stocks purely based on probability of profit  
✔ Highest probability wins  

---
CRITICAL RULES:
• NEVER introduce new stock names  
• Use ONLY stocks present in INPUT DATA  
• NEVER use external knowledge  
• NEVER assume missing data  

CONTEXT:
Stock market stock prediction.

probabilityArr(variable):
Contains probability of profit and reason for selected stocks.
e.g. [
  { "stockName": "Infosys", "probability": 0.20, "category"://actual stock category where stock belongs to(dont get from input data)e.g. nifty50, nifty midcap 100 or small cap etc...,"sector"://actual stock sector where stock belongs to(dont get from input data)},
  { "stockName": "HDFC", "probability": 0.21, "category"://actual stock category where stock belongs to(dont get from input data)e.g. nifty50, nifty midcap 100 or small cap etc...,"sector"://actual stock sector where stock belongs to(dont get from input data)},
  { "stockName": "TCS", "probability": 0.32, "category"://actual stock category where stock belongs to(dont get from input data)e.g. nifty50, nifty midcap 100 or small cap etc...,"sector"://actual stock sector where stock belongs to(dont get from input data)},
]
Suggested top three stocks based on probability with stockName, category and sector.

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
  "topThreeSectors": ${topThreeSectors},
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

    const now = Date.now().toString();
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
