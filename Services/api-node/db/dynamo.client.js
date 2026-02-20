const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-south-1" });

module.exports = {client};