
var AWS = require('aws-sdk');
const lib = require('./lib');
let data;
var ssm = new AWS.SSM({region: 'us-east-1'});
var dynamo = new AWS.DynamoDB({apiVersion: "2012-08-10", region: 'us-east-1'})

let TABLE_NAME = "CCUserService";
  
const AccessCodes = Object.freeze({
  UNKNOWN_USER:  0,
  ALLOW:         1,
  UNAUTHORIZED:  2,
  SYSTEM_ERROR:  11
});

function isEmpty(val) {
  return val == undefined || val == null;
}

const get_admin_api_token = async () => {
  console.log("initialized ssm");
  var params = {
    Name: "/cornercam/auth0-admin-api-key",
    WithDecryption: true
  }
  try {
    const ssmResponse = await ssm.getParameter(params).promise()
    return ssmResponse.Parameter.Value;
  } catch(error) {
    console.log(error);
    return undefined;
  }
}

const gym_auth_is_valid = async (gym_auth) => {
  if (isEmpty(gym_auth)) {
    return AccessCodes.UNKNOWN_USER
  }
  
  if (isEmpty(gym_auth.accessExpires)) {
    return AccessCodes.UNAUTHORIZED;
  }
  
  let today = new Date().toISOString().substring(0, 10);

  if (gym_auth.accessExpires >= today) {
    return AccessCodes.ALLOW;
  } else {
    return AccessCodes.UNAUTHORIZED; // owes money
  }
}

const is_authorized = async (user_id, gym_id) => {

  let encoded_user_id = encodeURIComponent(user_id);
  
  let PK = "USER#" + user_id;
  let SK = "GYM#" + gym_id;
  req_params = {
    TableName: TABLE_NAME,
    Key: {
      PK: {"S": PK},
      SK: {"S": SK}
    }
  }
  return await dynamo.getItem(req_params, function(e, data) {
    console.log("dynamo callback");
    if (e) {
      console.log("get_item error: ", e);
      return AccessCodes.SYSTEM_ERROR;
    } else {
      console.log("get_item success: ", data.Item);
      // logic for testing 
      return gym_auth_is_valid(data.Item);
    }
  }).promise();
}

module.exports.handler = async (event, context, callback) => {
  try {
    console.log("start of function");

    var user_id;
    try { 
      data = await lib.authenticate(event);
      user_id = data.principalId;
      console.log("user id is " + user_id);
    } catch (e) {
      console.log("error inside authentication flow", e);
      return context.fail("Authentication failure: invalid auth token");
    }
    console.log("authentication complete");
    
    // get metadata from auth0
    // const [message, access_level] = await is_authorized(user_id, 1); // "google-oauth2|106647354996701306231"
    // query dynamo userService
    access_level = await is_authorized(user_id, 1);
    console.log(access_level);
    if (access_level == AccessCodes.ALLOW) {
      return data;
    } else if (access_level == AccessCodes.SYSTEM_ERROR) {
      return context.fail("There was a system error: 105");
    } else {
      return context.fail("User not authorized for this gym");
    }
  }
  catch (err) {
      console.log(err);
      return context.fail("There was a system error: 112");
  }
};
