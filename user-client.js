// TODO: modularize this into an npm package

var AWS = require('aws-sdk');
var dynamo = new AWS.DynamoDB({apiVersion: "2012-08-10", region: 'us-east-1'})

let TABLE_NAME = "CCUserService";
let GSI1 = "GSI1";

const encoded_user_id = (user_id) => { encodeURIComponent(user_id); }

async function query_or_null(params) {
    callerFunction = (new Error()).stack?.split("\n")[2]?.trim().split(" ")[1]
    return await dynamo.query(req_params, function(e, data) {
        if (e) {
          console.log(callerFunction + " error: ", e);
          return null;
        } else {
          console.log(callerFunction + " success: ", data.Item);
          // logic for testing 
          return data.Item;
        }
      }).promise();
}

export function users_for_gym(gym_id) {

    let PK = "GYM#" + gym_id;
    let SKPattern = "USER#";
    req_params = {
      TableName: TABLE_NAME,
      IndexName: GSI1,
      KeyConditionExpression: "#gsi1pk = :gsi1pk and begins_with(#gsi1sk, :gsi1sk)",
      ExpressionAttributeNames: {
        '#gsi1pk': "GSI1PK",
        '#gsi1sk': "GSI1SK"
      },
      ExpressionAttributeValues: {
        ':gsi1pk': {"S": PK},
        ':gsi1sk': {"S": SKPattern}
      }
    }
  }