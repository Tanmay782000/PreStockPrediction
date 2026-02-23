const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { client } = require("../db/dynamo.client");
const { count } = require("console");
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

FILTERED_NEWS = process.env.FilteredNews;

exports.get = async (event) => {
  try {
    //Table declaration
    const COUNTRY_TABLE = process.env.CountryTable;
    const TERM_TABLE = process.env.StockTermTable;
    
    //Variable declaration
    const countryId = event.countryId;
    const country = event.country;
    const array = event.array || [];

    var countryList = await client.send(new ScanCommand({ TableName: COUNTRY_TABLE }));//{id, countryName}
    countryList = (countryList.Items || []).filter(c => c.countryId == countryId).map(c => ({countryId: c.countryId, countryName: c.countryName}));
    var termList = await client.send(new ScanCommand({ TableName: TERM_TABLE }));//{termId, termName}
    termList = (termList.Items || []).map(t => ({termId: t.termId, termName: t.termName, researchInsight: t.researchInsight}));

    const prompt = `
TERM ANALYSIS

countryId Mapping:
${JSON.stringify(countryList, null, 2)}

Selected countryId: ${countryId}
Selected country: ${country}

Available Terms:
${JSON.stringify(termList, null, 2)}

INSTRUCTION:
Analyze the input data and determine the best term (short/mid/long) also consider the researchInsights into news.
and another important thing is we are predicting the future of term so consider the news and data behaviour as per current time and give more weightage to recent news and data for prediction.
e.g. 
Not to consider in analysis -> Nifty 50 rise for the 2nd consecutive session ; short term was good as per 10 key highlights
Consider in analysis -> Nifty 50 is expected to rise for the 3rd consecutive session as per recent news and data behaviour; short term is predicted to perform well today/tomorrow/afteronwards(based on term).

CONTEXT:
Stock market term prediction.

probabilityArr(variable):
Contains probability of profit and do the ranking based on sequence of category id in above list with asc..

winner(variable):
Winning term id.

SUMMARY(variable):
Explain reasoning in 10 - 15 lines.

INPUT DATA:
${JSON.stringify(array, null, 2)}

OUTPUT RULES:
Return ONLY valid JSON.
No explanations outside JSON.

OUTPUT FORMAT:
{
  "countryId": ${countryId},
  "termId": winner,
  "termName": "termName", //e.g. Short Term/Mid Term/Long Term
  "probabilityArr": probabilityArr,
  "summary": SUMMARY,
  "WINNER":"termId"
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
      termSummery:
        responseBody.content == null || responseBody.content.length == 0
          ? termSumm
          : responseBody.content,
      categorySummery: categorySumm,
      sectorSummery: sectorSumm,
      stockName: stockName,
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
