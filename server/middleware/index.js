// server/middleware/index.js
// Central export for all middleware

const { authenticate, authenticateOptional } = require("./authMiddleware");
const {
  requireRole,
  requireAdmin,
  requireResident,
  requireSecurity,
  requireOwnershipOrAdmin,
} = require("./roleMiddleware");

module.exports = {
  // Authentication
  authenticate,
  authenticateOptional,

  // Role-based access control
  requireRole,
  requireAdmin,
  requireResident,
  requireSecurity,
  requireOwnershipOrAdmin,
};







