const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { client } = require("../db/dynamo.client");
const { verify } = require("../Common/auth.middleware");
const { v4: uuid4 } = require("uuid");
TABLE_TOKEN = process.env.TokenHistoryTable;
TABLE_USER = process.env.UserCFTable;

exports.get = async (event) => {
  try {
    // await verify(event);

    const { tokenId, stepId, actionName, value } = JSON.parse(event.body || "{}");

    if (!tokenId) return { statusCode: 400, body: "tokenId required" };

    const tokenRes = await client.send(
      new ScanCommand({
        TableName: TABLE_TOKEN,
        Key: { tokenId: tokenId },
      }),
    );

    if (!tokenRes.Items) return { statusCode: 400, body: "user not found" };

    const userRes = await client.send(
      new ScanCommand({
        TableName: TABLE_USER,
        Key: { tokenId: tokenRes.Items[0].tokenId },
      }),
    );
    const now = Date.now().toString();

    let item = userRes.Item || {
      cfId: uuid4(),
      tokenId,
      userStepId: stepId,
      countryId: 1,
      termId: 1,
      stockCategoryId: 1,
      createdDate: now,
    };

    // apply change
    switch (actionName) {
      case "countryChange":
        item.countryId = value;
        break;
      case "termChange":
        item.termId = value;
        break;
      case "stockCategoryChange":
        item.stockCategoryId = value;
        break;
      default:
        return { statusCode: 400, body: "invalid actionName" };
    }

    item.userStepId = stepId;
    item.modifiedDate = now;

    await client.send(
      new PutCommand({
        TableName: TABLE_USER,
        Item: item,
      }),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        userData: "Record Inserted Successfully",
      }),
    };
  } catch (err) {
    console.log("Error in user flow:", err);
    return {
      statusCode: err.statusCode,
      body: JSON.stringify({ error: err }),
    };
  }
};
