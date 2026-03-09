const emailOtpTemplate = (otp) => {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
      <h2 style="margin:0 0 12px;">Password Reset OTP</h2>
      <p>Your one-time password is:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:1px;">${otp}</p>
      <p>This code is valid for 5 minutes.</p>
    </div>
  `;
};

const emailVerificationOtpTemplate = ({ name, otp }) => {
  const safeName = name || 'there';

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;">
      <h2 style="margin:0 0 12px;">Verify your email</h2>
      <p>Hi ${safeName},</p>
      <p>Thanks for registering. Enter the OTP below to verify your account.</p>
      <p style="font-size:30px;font-weight:700;letter-spacing:3px;margin:18px 0;">${otp}</p>
      <p>This OTP is valid for 5 minutes.</p>
    </div>
  `;
};

module.exports = {
  emailOtpTemplate,
  emailVerificationOtpTemplate
};
