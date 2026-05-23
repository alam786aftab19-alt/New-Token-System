const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const bcrypt = require('bcryptjs');
const supabase = require('./config/db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Import Routes
const authRoutes = require('./routes/authRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[ServerError] Global error caught:', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Function to seed default admin on startup
async function seedDefaultAdmin() {
  try {
    const adminEmail = 'admin@gmail.com';
    const adminPassword = 'admin123';

    // Check if admin exists in 'NewTokenSystem_users' table
    const { data: userAdmin } = await supabase
      .from('NewTokenSystem_users')
      .select('id')
      .eq('email', adminEmail)
      .single();

    if (!userAdmin) {
      console.log('[Seeding] Creating default admin user in "NewTokenSystem_users" table...');
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const { error: seedErr } = await supabase
        .from('NewTokenSystem_users')
        .insert({
          name: 'System Admin',
          email: adminEmail,
          password: hashedPassword,
          phone: '9999999999',
          role: 'admin',
          is_verified: true
        });

      if (seedErr) {
        console.error('[Seeding] Error seeding user admin:', seedErr.message);
      } else {
        console.log('[Seeding] Default admin user seeded successfully! Email: admin@gmail.com | Pass: admin123');
      }
    }

    // Check if admin exists in 'NewTokenSystem_admins' table
    const { data: tableAdmin } = await supabase
      .from('NewTokenSystem_admins')
      .select('id')
      .eq('email', adminEmail)
      .single();

    if (!tableAdmin) {
      console.log('[Seeding] Creating default admin in "NewTokenSystem_admins" table...');
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const { error: seedErr } = await supabase
        .from('NewTokenSystem_admins')
        .insert({
          name: 'System Admin',
          email: adminEmail,
          password: hashedPassword
        });

      if (seedErr) {
        console.error('[Seeding] Error seeding table admin:', seedErr.message);
      } else {
        console.log('[Seeding] Default table admin seeded successfully!');
      }
    }
  } catch (err) {
    console.error('[Seeding] Seeding process skipped or failed:', err.message);
  }
}

// Start Server
app.listen(PORT, async () => {
  console.log(`Server running in production-ready mode on port ${PORT}`);
  await seedDefaultAdmin();
});
