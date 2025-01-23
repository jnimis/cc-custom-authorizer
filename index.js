
var AWS = require('aws-sdk');
const lib = require('./lib');
const winston = require('winston');

let data;
var dynamo = new AWS.DynamoDB({apiVersion: "2012-08-10", region: 'us-east-1'})

let TABLE_NAME = "CCUserService";
  
const AccessCodes = Object.freeze({
  UNKNOWN_USER:  0,
  ALLOW:         1,
  UNAUTHORIZED:  2,
  SYSTEM_ERROR:  11
});

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

function isEmpty(val) {
  return val == undefined || val == null;
}

const gym_auth_is_valid = async (gym_auth) => {
  
  if (isEmpty(gym_auth)) {
    logger.info("no user info");
    return AccessCodes.UNKNOWN_USER
  }
  
  accessExpiration = gym_auth.access_expires.S;
  if (isEmpty(accessExpiration)) {
    logger.info("no expiration: " + accessExpiration);
    return AccessCodes.UNAUTHORIZED;
  }
  
  let today = new Date().toISOString().substring(0, 10);

  if (accessExpiration >= today) {
    return AccessCodes.ALLOW;
  } else {
    logger.info("owes money: " + accessExpiration + " is before " + today);
    return AccessCodes.UNAUTHORIZED; // owes money
  }
}

const is_authorized = async (user_id, gym_id) => {

  // let encoded_user_id = encodeURIComponent(user_id);
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
    if (e) {
      logger.error("dynamo get_item error: " + e);
      return AccessCodes.SYSTEM_ERROR;
    } else {
      logger.debug("dynamo get_item success: " + data.Item);
      // logic for testing 
      return gym_auth_is_valid(data.Item);
    }
  }).promise();
}

module.exports.handler = async (event, context, callback) => {
  try {
    logger.debug("start of function");

    gym_id = params.headers.gym;
    if (!gym_id) {
      logger.error("no `gym` header on request");
      return context.fail("Invalid request");
    }

    var user_id;
    try {
      data = await lib.authenticate(event);
      user_id = data.email;
    } catch (e) {
      logger.error("error inside authentication flow", e);
      return context.fail("91 Authentication failure: unable to authenticate user using access token");
    }
    logger.info("authentication complete for " + user_id);
    
    // query dynamo userService
    try {
      access_level = await is_authorized(user_id, gym_id);
    } catch (e) {
      logger.error("error inside authorization flow", e);
      return context.fail("100 Authorization failure: there was a system issue while trying to authorize user " + user_id);
    }

    logger.debug("access level: " + access_level);
    if (access_level == AccessCodes.ALLOW) {
      logger.info("user authorized");
      return data;
    } else {
      return context.fail("User not authorized for this gym");
    }
  }
  catch (err) {
      logger.error(err);
      return context.fail("There was a system error: 112");
  }
};
