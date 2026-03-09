// mailer.js
require('dotenv').config();
const axios = require('axios');
const { tranEmailApi, sender } = require('./brevo');

async function sendOtpEmail(toEmail, resetLink) {
  try {
    const sendSmtpEmail = {
      sender,
      to: [{ email: toEmail }],
      subject: "Your OTP Code",
      htmlContent: resetLink,
    };

    const response = await tranEmailApi.sendTransacEmail(sendSmtpEmail);
    console.log("Email sent:", response);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

module.exports = { sendOtpEmail };
