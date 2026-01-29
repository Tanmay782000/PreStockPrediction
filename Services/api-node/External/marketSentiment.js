const { invokeLambda } = require("../Common/invokeLambda");
const { verify } = require("../Common/auth.middleware");
const { client } = require("../db/dynamo.client");
const { v4: uuid4 } = require("uuid");
const { ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

const Country_Table = process.env.CountryTable;
const News_Table = process.env.NewsTable;

exports.post = async (event) => {
  try {
    // await verify(event);

    const body = event.body ? JSON.parse(event.body) : {};

    const pythonFunction = {
      functionName: "sp-python-functions-dev-marketSentimentLambda",
      payload: "",
    };

    const result = await invokeLambda({
      functionName: pythonFunction.functionName,
      payload: pythonFunction.payload,
    });

    const body2 = JSON.parse(result.body);
    const countryMap = {};

    Object.entries(body2.countrynews).forEach(([countryCode, countryArray]) => {
      countryMap[countryCode] = countryArray.map((item) =>
        JSON.stringify(item),
      );
    });
    console.log("stingify worked");
    const now = new Date().toISOString();

    const scanResult = await client.send(
      new ScanCommand({
        TableName: Country_Table,
      }),
    );
    console.log("scan worked");
    scanResult.Items.sort((a, b) => a.countryId - b.countryId);
    console.log("itemsssssss",scanResult.Items);
    for (const element of scanResult.Items) {
      const data = countryMap[element.countryId];

      if (data) {
        const item = {
          id: uuid4(),
          countryId: element.countryId,
          newsData: data,
          createdDate: now,
        };
    console.log("final data",data);
        await client.send(
          new PutCommand({
            TableName: News_Table,
            Item: item,
          }),
        );
    console.log("process completed");
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result),
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
