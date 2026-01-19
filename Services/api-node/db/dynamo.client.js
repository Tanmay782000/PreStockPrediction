const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
// const { GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-south-1" });
// const TABLE = process.env.TokenHistory;

// exports.getToken = async (username) => {
//   const res = await client.send(
//     new GetCommand({
//       TableName: TABLE,
//       Key: { username }
//     })
//   );
//   return res.Item;
// };

// exports.saveToken = async (username, token, ttl) => {
//   return client.send(
//     new PutCommand({
//       TableName: TABLE,
//       Item: { username, token, ttl }
//     })
//   );
// };

module.exports = {client};