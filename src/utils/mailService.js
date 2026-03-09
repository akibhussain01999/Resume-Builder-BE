const { tranEmailApi, sender } = require('./brevo');
const { emailOtpTemplate, emailVerificationOtpTemplate } = require('./emailTemplate');
const env = require('../config/env');

const sendEmail = async ({ toEmail, subject, htmlContent }) => {
  if (!toEmail || !subject || !htmlContent) {
    throw new Error('toEmail, subject and htmlContent are required');
  }

  if (!env.brevoApiKey) {
    throw new Error('Missing Brevo API key. Set BREVO_API_KEY (or BREAVE_MAILER_KEY) in .env');
  }

  if (!sender.email || sender.email.endsWith('@example.com')) {
    throw new Error('Invalid sender email. Set a verified SENDER_EMAIL in .env');
  }

  try {
    await tranEmailApi.sendTransacEmail({
      sender,
      to: [{ email: toEmail }],
      subject,
      htmlContent
    });
  } catch (error) {
    const brevoMessage =
      error?.response?.body?.message ||
      error?.response?.text ||
      error?.message ||
      'Unknown mail service error';

    throw new Error(`Email provider error: ${brevoMessage}`);
  }
};

const sendEmailVerificationOtpEmail = async ({ toEmail, name, otp }) => {
  await sendEmail({
    toEmail,
    subject: 'Verify your Resume Builder account',
    htmlContent: emailVerificationOtpTemplate({ name, otp })
  });
};

const sendForgotPasswordEmail = async ({ toEmail, otp }) => {
  await sendEmail({
    toEmail,
    subject: 'Your password reset OTP',
    htmlContent: emailOtpTemplate(otp)
  });
};

module.exports = {
  sendEmail,
  sendEmailVerificationOtpEmail,
  sendForgotPasswordEmail
};
