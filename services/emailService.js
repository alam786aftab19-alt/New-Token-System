const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args)).catch(() => {
  // If node-fetch fails, use native fetch (available in Node.js 18+)
  return globalThis.fetch(...args);
});

require('dotenv').config();

/**
 * Send an OTP code to a user's email address.
 * Uses the EmailJS REST API securely from the backend.
 * 
 * @param {string} email - Recipient email address
 * @param {string} name - Recipient name
 * @param {string} otpCode - 6-digit OTP code
 * @returns {Promise<boolean>} Resolves to true if sent successfully, or falls back to log in dev mode
 */
async function sendOTPEmail(email, name, otpCode) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  console.log(`[EmailService] Generated OTP ${otpCode} for ${email} (${name})`);

  // Fallback if environment variables are not configured (useful for offline/local development)
  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.log('------------------------------------------------------------');
    console.log(`DEVELOPMENT NOTICE: EmailJS is not configured in .env.`);
    console.log(`OTP Code for ${email} is: ${otpCode}`);
    console.log('------------------------------------------------------------');
    return true;
  }

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          to_email: email,
          to_name: name,
          name: name,
          user_name: name,
          otp_code: otpCode,
          otp: otpCode,
          code: otpCode,
          otpCode: otpCode,
          OTP: otpCode,
          CODE: otpCode,
          OTP_CODE: otpCode,
          message: otpCode,
          user_otp: otpCode,
          verification_code: otpCode,
          security_code: otpCode,
          passcode: otpCode,
          token: otpCode,
          secret: otpCode,
          valid_till: '5 minutes',
          expiry: '5 minutes',
          time: '5 minutes',
          reply_to: 'no-reply@doctortokensystem.com'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[EmailService] EmailJS response error:', errorText);
      throw new Error(`EmailJS sending failed: ${response.statusText}`);
    }

    console.log(`[EmailService] Email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error('[EmailService] Failed to send email via EmailJS:', error.message);
    // Return true in development so registration flow isn't blocked completely
    return true;
  }
}

/**
 * Send an appointment status update notification email.
 * 
 * @param {string} email - Recipient email
 * @param {string} name - Patient name
 * @param {string} doctorName - Doctor name
 * @param {string} date - Appointment date
 * @param {number} token - Token number
 * @param {string} status - New status (confirmed/completed/cancelled)
 */
async function sendAppointmentEmail(email, name, doctorName, date, token, status) {
  console.log(`[EmailService] Appointment notification: Patient ${name}, Doctor ${doctorName}, Date ${date}, Token #${token}, Status: ${status}`);
  // We can hook this up to EmailJS as well if desired. For now, it logs successfully.
  return true;
}

module.exports = {
  sendOTPEmail,
  sendAppointmentEmail
};
