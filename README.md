# Doctor Token System 🩺🎟️

A production-ready, full-stack application for generating and managing doctor appointment tokens online. Designed with a modern **Glassmorphism Dark Theme** using Tailwind CSS, Node.js + Express.js, Supabase PostgreSQL, and EmailJS OTP validation.

---

## 🌟 Key Features

1. **Patient Registration & Login**: Hashed passwords (bcrypt) and secure JWT authentication.
2. **Email OTP Verification**: Multi-factor signup and forgot-password resets via EmailJS REST API.
3. **Daily Reset Doctor Tokens**: Increments sequential appointment passes daily per doctor (e.g., #1, #2, #3).
4. **Interactive Dashboards**:
   - **Patient Dashboard**: View tokens, download slips, print, and generate live QR codes.
   - **Doctor Dashboard**: Manage patient checkup state (Accept / Reject / Complete checkup), search patients, and filter by date.
   - **Admin Dashboard**: System diagnostics, manage departments, CRUD doctor profiles, and block/delete users.
5. **Robust Security**: Protected middleware routes, rate limiting, and CORS integrations.

---

## 🏗️ Folder Structure

```
├── config/
│   └── db.js                 # Supabase client initializer
├── controllers/
│   ├── adminController.js     # Analytics, user blocks, departments CRUD
│   ├── appointmentController.js # Token bookings, updates, history
│   ├── authController.js      # Password crypts, JWTs, OTP flows
│   └── doctorController.js    # Doctor roster CRUD
├── middleware/
│   └── authMiddleware.js     # JWT checks & Role whitelisting
├── public/                    # Immersive Glassmorphism Frontend SPA
│   ├── css/
│   ├── js/
│   ├── index.html            # Landing page
│   ├── login.html            # Unified portal login
│   ├── signup.html           # Patient signup
│   ├── verify-otp.html       # OTP sequential box inputs
│   ├── forgot-password.html  # Forgot password trigger
│   ├── reset-password.html   # New password submission
│   ├── dashboard.html        # Patient active tokens & QR modal
│   ├── book-token.html       # Multi-step selector token book
│   ├── doctor-dashboard.html # Doctor checkup console
│   └── admin-dashboard.html  # System administration tabs
├── routes/
│   ├── adminRoutes.js
│   ├── appointmentRoutes.js
│   ├── authRoutes.js
│   └── doctorRoutes.js
├── services/
│   ├── emailService.js       # EmailJS API caller (with console logging fallback)
│   └── tokenService.js       # Daily sequence counter
├── .env.example              # Env template
├── package.json              # Script configurations & dependencies
├── schema.sql                # Supabase database SQL schema
└── server.js                 # App configuration and entry point
```

---

## 🚀 Local Installation & Setup

### 1. Clone & Install Dependencies
Navigate to the project root and run:
```bash
npm install
```

### 2. Database Setup (Supabase)
1. Register a free account at [Supabase](https://supabase.com/).
2. Create a new project.
3. Open the **SQL Editor** in Supabase and paste the contents of `schema.sql`. Run the query to initialize all tables, indexes, and default department values.
4. Retrieve your **Project URL** and **Anon/Public API Key** from `Project Settings > API`.

### 3. Email Service Setup (EmailJS)
1. Register an account at [EmailJS](https://www.emailjs.com/).
2. Add a new email service (e.g. Gmail) and get your `Service ID`.
3. Create an email template named "OTP Template" with the variables `{{to_name}}` and `{{otp_code}}`. Note the `Template ID`.
4. Go to Account Settings and retrieve your `Public Key` and `Private Key`.
> **Note**: For security, all EmailJS calls are executed from the Node backend, preventing key exposures.

### 4. Configure Environment Variables
Create a file named `.env` in the root folder (or rename `.env.example`) and fill in your keys:
```env
PORT=5000
SUPABASE_URL=https://your-supabase-id.supabase.co
SUPABASE_KEY=your-supabase-anon-key
JWT_SECRET=your-secret-string-value

# EmailJS credentials
EMAILJS_SERVICE_ID=your_service_id
EMAILJS_TEMPLATE_ID=your_template_id
EMAILJS_PUBLIC_KEY=your_public_key
EMAILJS_PRIVATE_KEY=your_private_key
```

### 5. Running the Application
To run the server in development mode (starts nodemon auto-refresh):
```bash
npm run dev
```
To run the server in production mode:
```bash
npm start
```
The server will print a success console message:
`Server running in production-ready mode on port 5000`

---

## 🔐 Default Administrator Seed
On database launch and server execution, the application automatically checks and inserts a default administrator account into the database for immediate testing access:
* **Admin Login Email**: `admin@gmail.com`
* **Admin Login Password**: `admin123`

---

## 🛠️ REST API Specification

### Auth APIs
* `POST /api/auth/register` - Create patient profile (requires `name`, `email`, `phone`, `password`). Sends OTP.
* `POST /api/auth/login` - Unified login form (requires `email`, `password`). Returns JWT and role metadata.
* `POST /api/auth/verify-otp` - Verify code (requires `email`, `otp_code`). Activates user, returns JWT.
* `POST /api/auth/resend-otp` - Re-deliver code (requires `email`).
* `POST /api/auth/forgot-password` - Request password reset code (requires `email`).
* `POST /api/auth/reset-password` - Reset password (requires `email`, `otp_code`, `newPassword`).

### Doctor APIs
* `GET /api/doctors` - Get doctor list (supports optional query `?departmentId=X`).
* `GET /api/doctors/departments` - List clinic divisions.
* `POST /api/doctors` - Add doctor profile (Admin only).
* `PUT /api/doctors/:id` - Edit doctor details (Admin or assigned Doctor only).
* `DELETE /api/doctors/:id` - Delete doctor profile (Admin only).

### Appointment APIs (Token Bookings)
* `POST /api/appointments` - Book appointment/auto-assign token (requires `doctor_id`, `department_id`, `appointment_date`, optional `notes`).
* `GET /api/appointments` - Scoped list (Patients see owned bookings, Doctors see assigned, Admins see all).
* `PUT /api/appointments/:id` - Change booking status or description (Status change triggers notification emails).
* `DELETE /api/appointments/:id` - Delete booking from records (Admin only).

### Admin APIs
* `GET /api/admin/users` - Get list of registered patients.
* `DELETE /api/admin/users/:id` - Delete/Block patient account.
* `GET /api/admin/stats` - System database analytics (patient/doctor/appointment counts and status splits).
* `POST /api/admin/departments` - Add department (requires `name`, `description`).
* `DELETE /api/admin/departments/:id` - Remove department.

---

## 🌩️ Cloud Deployment Guidelines

### 💻 Render Deployment
1. Sign up on [Render](https://render.com/).
2. Select **New > Web Service** and link your repository.
3. Configure settings:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Expand the **Advanced** tab and add the environment variables specified in `.env`.
5. Deploy. Render will serve the Node Express server.

### ⚡ Vercel Deployment (Full-stack Serverless)
1. Install vercel CLI: `npm install -g vercel`
2. Create a `vercel.json` file in the project root:
```json
{
  "version": 2,
  "builds": [
    { "src": "server.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/server.js" },
    { "src": "/(.*)", "dest": "/public/$1" }
  ]
}
```
3. Run the CLI command `vercel` and follow prompts to link and deploy your project, passing environment variables in Vercel's console settings.

---

## 🛡️ Production Security Checklist
* Make sure `JWT_SECRET` in `.env` is long and complex.
* Always enforce HTTPS to encrypt traffic.
* Keep standard CORS settings scoped strictly to production URLs (edit CORS params in `server.js`).
* Database handles soft/hard foreign key delete cascade to prevent database mismatch locks.
* Rate limit limits brute-force requests to 100 entries per IP per 15 minutes.
