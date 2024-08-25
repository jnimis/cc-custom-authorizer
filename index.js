const lib = require('./lib');
let data;

const get_admin_api_token = () => {
  var secretsmanager = new AWS.SecretsManager();
  var params = {
    SecretId: "cornercam/auth0-admin-api-key"
  }
  secretsmanager.getSecretValue(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     return data.SecretString;
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
    data = await lib.authenticate(event);
    console.log(context);
    console.log(data);
    // get metadata from auth0
    let user_id = data.principalId
  }
  catch (err) {
      console.log(err);
      return context.fail("Unauthorized");
  }
  return data;
};
