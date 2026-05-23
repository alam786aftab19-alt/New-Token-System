const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/db');
const { sendOTPEmail } = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development-use';

/**
 * Generate a JWT token.
 */
function generateToken(id, email, role) {
  return jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Generate a random 6-digit OTP.
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Register a new user (patient).
 */
async function register(req, res) {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password || !phone) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  try {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('NewTokenSystem_users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (unverified by default)
    const { data: newUser, error: createError } = await supabase
      .from('NewTokenSystem_users')
      .insert({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone,
        role: 'patient',
        is_verified: false
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    // Generate and send OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 mins

    const { error: otpError } = await supabase
      .from('NewTokenSystem_otp_verifications')
      .upsert({
        email: email.toLowerCase(),
        otp_code: otp,
        expires_at: expiresAt
      }, { onConflict: 'email' });

    if (otpError) {
      throw otpError;
    }

    await sendOTPEmail(email.toLowerCase(), name, otp);

    return res.status(201).json({
      success: true,
      message: 'Registration successful. OTP sent to your email.'
    });
  } catch (error) {
    console.error('[Register] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Login user (patient, doctor, or admin).
 */
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    // 1. Search in users table (patients / admins)
    const { data: user } = await supabase
      .from('NewTokenSystem_users')
      .select('*')
      .eq('email', cleanEmail)
      .single();

    if (user) {
      if (!user.is_verified) {
        return res.status(403).json({
          success: false,
          isNotVerified: true,
          message: 'Please verify your email before logging in.'
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        const token = generateToken(user.id, user.email, user.role);
        return res.json({
          success: true,
          token,
          user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
      }
    }

    // 2. Search in doctors table
    const { data: doctor } = await supabase
      .from('NewTokenSystem_doctors')
      .select('*')
      .eq('email', cleanEmail)
      .single();

    if (doctor) {
      const isMatch = await bcrypt.compare(password, doctor.password);
      if (isMatch) {
        const token = generateToken(doctor.id, doctor.email, 'doctor');
        return res.json({
          success: true,
          token,
          user: { id: doctor.id, name: doctor.name, email: doctor.email, role: 'doctor' }
        });
      }
    }

    // 3. Search in admins table
    const { data: admin } = await supabase
      .from('NewTokenSystem_admins')
      .select('*')
      .eq('email', cleanEmail)
      .single();

    if (admin) {
      const isMatch = await bcrypt.compare(password, admin.password);
      if (isMatch) {
        const token = generateToken(admin.id, admin.email, 'admin');
        return res.json({
          success: true,
          token,
          user: { id: admin.id, name: admin.name, email: admin.email, role: 'admin' }
        });
      }
    }

    return res.status(400).json({ success: false, message: 'Invalid email or password' });
  } catch (error) {
    console.error('[Login] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Verify OTP code.
 */
async function verifyOTP(req, res) {
  const { email, otp_code } = req.body;

  if (!email || !otp_code) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const { data: verification } = await supabase
      .from('NewTokenSystem_otp_verifications')
      .select('*')
      .eq('email', cleanEmail)
      .single();

    if (!verification) {
      return res.status(400).json({ success: false, message: 'OTP not found or expired. Resend code.' });
    }

    // Check expiry
    const now = new Date();
    const expiry = new Date(verification.expires_at);

    if (now > expiry) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }

    if (verification.otp_code !== otp_code.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code' });
    }

    // Mark user as verified
    const { data: updatedUser, error: updateError } = await supabase
      .from('NewTokenSystem_users')
      .update({ is_verified: true })
      .eq('email', cleanEmail)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Delete OTP record
    await supabase.from('NewTokenSystem_otp_verifications').delete().eq('email', cleanEmail);

    const token = generateToken(updatedUser.id, updatedUser.email, updatedUser.role);

    return res.json({
      success: true,
      message: 'Email verified successfully!',
      token,
      user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role }
    });
  } catch (error) {
    console.error('[VerifyOTP] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Resend OTP.
 */
async function resendOTP(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const { data: user } = await supabase
      .from('NewTokenSystem_users')
      .select('name')
      .eq('email', cleanEmail)
      .single();

    if (!user) {
      return res.status(404).json({ success: false, message: 'No registered user found with this email' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await supabase
      .from('NewTokenSystem_otp_verifications')
      .upsert({
        email: cleanEmail,
        otp_code: otp,
        expires_at: expiresAt
      }, { onConflict: 'email' });

    await sendOTPEmail(cleanEmail, user.name, otp);

    return res.json({ success: true, message: 'New OTP code sent to your email.' });
  } catch (error) {
    console.error('[ResendOTP] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Forgot password - initiates recovery with OTP.
 */
async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    // Verify user exists in users, doctors, or admins
    let targetUser = null;
    const { data: user } = await supabase.from('NewTokenSystem_users').select('name').eq('email', cleanEmail).single();
    if (user) targetUser = user;

    if (!targetUser) {
      const { data: doc } = await supabase.from('NewTokenSystem_doctors').select('name').eq('email', cleanEmail).single();
      if (doc) targetUser = doc;
    }

    if (!targetUser) {
      const { data: adm } = await supabase.from('NewTokenSystem_admins').select('name').eq('email', cleanEmail).single();
      if (adm) targetUser = adm;
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'No registered user found with this email' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await supabase
      .from('NewTokenSystem_otp_verifications')
      .upsert({
        email: cleanEmail,
        otp_code: otp,
        expires_at: expiresAt
      }, { onConflict: 'email' });

    await sendOTPEmail(cleanEmail, targetUser.name, otp);

    return res.json({ success: true, message: 'Password reset OTP sent to your email.' });
  } catch (error) {
    console.error('[ForgotPassword] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Reset password using OTP.
 */
async function resetPassword(req, res) {
  const { email, otp_code, newPassword } = req.body;

  if (!email || !otp_code || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const { data: verification } = await supabase
      .from('NewTokenSystem_otp_verifications')
      .select('*')
      .eq('email', cleanEmail)
      .single();

    if (!verification) {
      return res.status(400).json({ success: false, message: 'OTP verification record not found or expired.' });
    }

    // Expiry check
    if (new Date() > new Date(verification.expires_at)) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please try again.' });
    }

    if (verification.otp_code !== otp_code.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code' });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update in appropriate table
    let updated = false;

    // Try users
    const { data: u, error: ue } = await supabase
      .from('NewTokenSystem_users')
      .update({ password: hashedNewPassword, is_verified: true })
      .eq('email', cleanEmail)
      .select();
    if (u && u.length > 0) updated = true;

    // Try doctors
    if (!updated) {
      const { data: d } = await supabase
        .from('NewTokenSystem_doctors')
        .update({ password: hashedNewPassword })
        .eq('email', cleanEmail)
        .select();
      if (d && d.length > 0) updated = true;
    }

    // Try admins
    if (!updated) {
      const { data: a } = await supabase
        .from('NewTokenSystem_admins')
        .update({ password: hashedNewPassword })
        .eq('email', cleanEmail)
        .select();
      if (a && a.length > 0) updated = true;
    }

    if (!updated) {
      return res.status(404).json({ success: false, message: 'User record not found.' });
    }

    // Delete OTP record
    await supabase.from('NewTokenSystem_otp_verifications').delete().eq('email', cleanEmail);

    return res.json({ success: true, message: 'Password reset successful. You can now login.' });
  } catch (error) {
    console.error('[ResetPassword] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = {
  register,
  login,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword
};
