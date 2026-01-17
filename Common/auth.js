const jwt = require('jsonwebtoken');
const { getToken } = require('../db/dynamo.client');

const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
  try {
    const token = event.authorizationToken?.split(' ')[1];
    if (!token) throw new Error('No token');

    const decoded = jwt.verify(token, JWT_SECRET);

    const record = await getToken(decoded.username);
    if (!record || record.token !== token) {
      throw new Error('Invalid token');
    }

    return generatePolicy(
      decoded.username,
      'Allow',
      event.methodArn,
      { username: decoded.username }
    );

  } catch (err) {
    return generatePolicy(
      'anonymous',
      'Deny',
      event.methodArn
    );
  }
};

const generatePolicy = (principalId, effect, resource, context = {}) => ({
  principalId,
  policyDocument: {
    Version: '2012-10-17',
    Statement: [{
      Action: 'execute-api:Invoke',
      Effect: effect,
      Resource: resource
    }]
  },
  context
});
