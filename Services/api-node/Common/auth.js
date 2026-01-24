const jwt = require("jsonwebtoken");
const { PutCommand,ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { client } = require("../db/dynamo.client");
const { v4: uuid4 } = require('uuid');
const TABLE = process.env.TokenHistoryTable;
const JWT_SECRET = process.env.JWT_SECRET;

module.exports.tokengeneration = async (event) => {
  const body = event.body ? JSON.parse(event.body) : {};
  const username = body.username;
  console.log(body);
  if (!username) {
    return { statusCode: 400, body: "username required" };
  }
  console.log(username);
  // create token
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
  let tokenId = uuid4(); 
 
  const existingToken = await client.send(new ScanCommand({ 
    TableName: TABLE, 
    Key: { username: username }
  }))

  console.log("Existing Token:", existingToken.Items);
  console.log("Existing Token Id:", existingToken.Items.tokenId);
  if(existingToken.Items.length > 0){
    console.log("Updating existing token for user:", username);
    tokenId = existingToken.Items[0].tokenId;  
  }

  console.log("TOKEN ID",tokenId);

  // store token
  await client.send(new PutCommand({
    TableName: TABLE,
    Item: {
      tokenId,
      username,
      token,
      createdDate: Date.now().toString()
    }
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ token })
  };
};
