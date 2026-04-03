// server/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Import middleware
const {
  authenticate,
  authenticateOptional,
  requireRole,
  requireAdmin,
  requireResident,
  requireSecurity,
  requireOwnershipOrAdmin,
} = require('./middleware');

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Smart Society Backend is running!' });
});

// ======================= ROUTES LOADING ============================

// AUTH
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.log('⚠️ Auth routes not loaded');
  console.error(error);
}

// USERS
try {
  const userRoutes = require('./routes/users');
  app.use('/api/users', authenticate, userRoutes);
  console.log('✅ User routes loaded (protected)');
} catch (error) {
  console.log('⚠️ User routes not loaded');
  console.error(error);
}

// COMPLAINTS
try {
  const complaintRoutes = require('./routes/complaints');
  app.use('/api/complaints', complaintRoutes);
  console.log('✅ Complaint routes loaded');
} catch (error) {
  console.log('⚠️ Complaint routes not loaded');
  console.error(error);
}

// NOTICES
try {
  const noticeRoutes = require('./routes/notices');
  app.use('/api/notices', noticeRoutes);
  console.log('✅ Notice routes loaded');
} catch (error) {
  console.log('⚠️ Notice routes not loaded');
  console.error(error);
}

// EVENTS
try {
  const eventRoutes = require('./routes/events');
  app.use('/api/events', eventRoutes);
  console.log('✅ Event routes loaded');
} catch (error) {
  console.log('⚠️ Event routes not loaded');
  console.error(error);
}

// FACILITIES
try {
  const facilitiesRoutes = require('./routes/facilities');
  app.use('/api/facilities', facilitiesRoutes);
  console.log('✅ Facilities routes loaded');
} catch (error) {
  console.log('⚠️ Facilities routes not loaded');
  console.error(error);
}

// FACILITY BOOKINGS
try {
  const facilityBookingRoutes = require('./routes/facilityBookings');
  app.use('/api/facility-bookings', facilityBookingRoutes);
  console.log('✅ Facility Booking routes loaded');
} catch (error) {
  console.log('⚠️ Facility Booking routes not loaded');
  console.error(error);
}

// MAINTENANCE
try {
  const maintenanceRoutes = require('./routes/maintenance');
  app.use('/api/maintenance', maintenanceRoutes);
  console.log('✅ Maintenance routes loaded');
} catch (error) {
  console.log('⚠️ Maintenance routes not loaded');
  console.error(error);
}

// PAYMENTS
try {
  const paymentsRoutes = require('./routes/payments');
  app.use('/api/payments', paymentsRoutes);
  console.log('✅ Payments routes loaded');
} catch (error) {
  console.log('⚠️ Payments routes not loaded');
  console.error(error);
}

// VISITORS
try {
  const visitorRoutes = require("./routes/visitors");
  app.use("/api/visitors", visitorRoutes);
  console.log("✅ Visitor routes loaded");
} catch (error) {
  console.log("⚠️ Visitor routes not loaded");
  console.error(error);
}

// FLATS
try {
  const flatRoutes = require("./routes/flats");
  app.use("/api/flats", flatRoutes);
  console.log("✅ Flat routes loaded");
} catch (error) {
  console.log("⚠️ Flat routes not loaded");
  console.error(error);
}

// RESIDENTS
try {
  const residentRoutes = require("./routes/residents");
  app.use("/api/residents", residentRoutes);
  console.log("✅ Resident routes loaded");
} catch (error) {
  console.log("⚠️ Resident routes not loaded");
  console.error(error);
}

// NOTIFICATIONS
try {
  const notificationRoutes = require("./routes/notifications");
  app.use("/api/notifications", notificationRoutes);
  console.log("✅ Notification routes loaded");
} catch (error) {
  console.log("⚠️ Notification routes not loaded");
  console.error(error);
}

// DASHBOARD
try {
  const dashboardRoutes = require('./routes/dashboard');
  app.use('/api/dashboard', dashboardRoutes);
  console.log('✅ Dashboard routes loaded');
} catch (error) {
  console.log('⚠️ Dashboard routes not loaded');
  console.error(error);
}

// ======================= HEALTH CHECK ============================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    routes: {
      auth: '/api/auth',
      users: '/api/users',
      complaints: '/api/complaints',
      notices: '/api/notices',
      events: '/api/events',
      facilities: '/api/facilities',
      facilityBookings: '/api/facility-bookings',
      maintenance: '/api/maintenance',
      payments: '/api/payments',
      visitors: '/api/visitors',
      notifications: '/api/notifications',
      residents: '/api/residents',
    }
  });
});

// ======================= 404 HANDLER ============================

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      message: 'API route not found',
      tried: req.originalUrl,
      availableRoutes: [
        // Auth
        'POST /api/auth/login',
        'POST /api/auth/register',

        // Users
        'GET /api/users/:id',

        // Complaints
        'POST /api/complaints/submit',
        'GET /api/complaints/resident/:id',
        'GET /api/complaints/all',
        'PUT /api/complaints/:id/status',

        // Notices
        'GET /api/notices',
        'POST /api/notices',
        'PUT /api/notices/:id',
        'DELETE /api/notices/:id',

        // Events
        'GET /api/events',
        'POST /api/events',
        'PUT /api/events/:id',
        'DELETE /api/events/:id',

        // Facilities
        'GET /api/facilities',
        'POST /api/facilities',

        // Facility Bookings
        'POST /api/facility-bookings',
        'GET /api/facility-bookings/resident/:id',
        'GET /api/facility-bookings/all',
        'PUT /api/facility-bookings/:id/status',

        // Maintenance
        'GET /api/maintenance',
        'GET /api/maintenance/all',
        'GET /api/maintenance/resident/:id',
        'POST /api/maintenance/generate',
        'PUT /api/maintenance/:id/mark-paid',
        'GET /api/maintenance/test',

        // Payments
        'POST /api/payments/create',
        'POST /api/payments/:invoiceId/mark-paid',
        'GET /api/payments/resident/:id',
        'GET /api/payments/all',
        'POST /api/payments/webhook',

        // Notifications
        'GET /api/notifications',
        'GET /api/notifications/unread-count',
        'PATCH /api/notifications/:id/read',
        'PATCH /api/notifications/read-all',
        'DELETE /api/notifications/:id',

        // Residents
        'GET /api/residents',
        'GET /api/residents/list',
        'GET /api/residents/:id',
        'POST /api/residents',
        'PUT /api/residents/:id',
        'DELETE /api/residents/:id',
        'PATCH /api/residents/:id/deactivate',
        'PATCH /api/residents/:id/activate',

        // Visitors ← these were missing from the list (routes were always registered, just not listed here)
        'POST /api/visitors/entry',
        'GET /api/visitors/today',
        'GET /api/visitors/all',
        'GET /api/visitors/pending/:residentId',
        'GET /api/visitors/report',
        'PUT /api/visitors/decision/:gateLogId',
        'PUT /api/visitors/exit/:gateLogId',
      ]
    });
  }
  next();
});

// ======================= ERROR HANDLER ============================

app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// ======================= START SERVER ============================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 API available at: http://localhost:${PORT}/api`);
  console.log('📋 Routes active: Auth, Users, Complaints, Notices, Events, Facilities, FacilityBookings, Maintenance, Payments, Visitors, Notifications, Residents');
});