const { invokeLambda } = require("../Common/invokeLambda");

exports.post = async (event) => {
  try {
    await verify(event);
    
    const body = event.body ? JSON.parse(event.body) : {};

    const pythonFunction = {
       "functionName": "sp-python-functions-dev-marketSentimentLambda",
       "payload": ""
     }

    const result = await invokeLambda({
      functionName: pythonFunction.functionName,
      payload: pythonFunction.payload,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.log(err)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message,
      }),
    };
  }
};
