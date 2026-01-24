const AWS = require("@aws-sdk/client-lambda");
const lambda = new AWS.Lambda({ region: process.env.AWS_REGION });

module.exports.invokeLambda = async ({
  functionName,
  payload,
  invocationType = "RequestResponse",
}) => {
  if (!functionName) {
    throw new Error("functionName is required");
  }

  console.log("Invoked");

  const response = await lambda
    .invoke({
      FunctionName: functionName, // ARN or name
      InvocationType: invocationType,
      Payload: JSON.stringify(payload || {}),
    })

    console.log("gone well");
  if (response.FunctionError) {
    throw new Error(response.Payload);
  }

  console.log("payload",response);

  return response.Payload
    ? JSON.parse(Buffer.from(response.Payload).toString("utf-8"))
    : null;
};
