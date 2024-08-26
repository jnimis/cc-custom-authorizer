
var AWS = require('aws-sdk/dist/aws-sdk-react-native');
const lib = require('./lib');
let data;

const get_admin_api_token = () => {
  var ssm = new AWS.SSM({region: 'us-east-1'});
  var params = {
    Name: "/cornercam/auth0-admin-api-key",
    WithDecryption: true
  }
  ssm.getParameter(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     return data.Parameter.Value;
  });
}

const is_authorized = (user_id, gym_id) => {

  let admin_api_token = get_admin_api_token();

  let encoded_user_id = encodeURIComponent(user_id);
  var myHeaders = new Headers();
  myHeaders.append("Accept", "application/json");
  myHeaders.append("Authorization", "Bearer " + admin_api_token);

  var requestOptions = {
    method: 'GET',
    headers: myHeaders,
    redirect: 'follow'
  };

  fetch("https://onemanband.auth0.com/api/v2/users?q=user_id%3A" + encoded_user_id, requestOptions)
    .then(response => response.text())
    .then(result => console.log(result))
    .catch(error => console.log('error', error));
}

// Lambda function index.handler - thin wrapper around lib.authenticate
module.exports.handler = async (event, context, callback) => {
  try {
    // console.log(get_admin_api_token());
    data = await lib.authenticate(event);
    
    // get metadata from auth0
    let user_id = data.principalId;
    console.log("user id is " + user_id);
  }
  catch (err) {
      console.log(err);
      return context.fail("Unauthorized");
  }
  return data;
};
