const SibApiV3Sdk = require('sib-api-v3-sdk');
const env = require('../config/env');

const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications['api-key'].apiKey = env.brevoApiKey;

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

const sender = {
  email: env.senderEmail,
  name: env.senderName
};

module.exports = { tranEmailApi, sender };
