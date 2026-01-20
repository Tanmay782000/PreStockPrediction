const { ScanCommand } = require("@aws-sdk/client-dynamodb");

TABLE_TOKEN = "TokenHistory";
TABLE_USER = "UserCF"

exports.get = async (event) => {
try{
    await verify(event);
    const tokenid = event.body.tokenId 

    const getTokeninfo = await client.send(new ScanCommand({
        TableName: TABLE_TOKEN,
        Key:{ tokenId: tokenid }
    }));


    if(result.Items.length != 0){
       //ADD LOGIC OF UPDATE
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        stockTerms: result.Items.sort((a, b) => a.termId - b.termId),
      }),
    };
}
catch(err) {

}
}