// server/middleware/roleMiddleware.js

/**
 * Middleware to check if user has required role(s)
 * Must be used after authenticate middleware
 * 
 * Usage:
 * - router.get('/admin-only', authenticate, requireRole('admin'), handler)
 * - router.get('/admin-or-security', authenticate, requireRole(['admin', 'security']), handler)
 */

const requireRole = (...allowedRoles) => {
  // Flatten array if nested arrays are passed
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    // Check if user is authenticated (should be set by authenticate middleware)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please use authenticate middleware first.",
      });
    }

    // Check if user has required role
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(" or ")}`,
        userRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Convenience middleware for specific roles
 */
const requireAdmin = requireRole("admin");
const requireResident = requireRole("resident");
const requireSecurity = requireRole("security");

/**
 * Middleware to check if user is accessing their own resource or is admin
 * Usage: router.get('/users/:id', authenticate, requireOwnershipOrAdmin, handler)
 */
const requireOwnershipOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Admin can access any resource
  if (req.user.role === "admin") {
    return next();
  }

  // Check if user is accessing their own resource
  const resourceId = req.params.id || req.params.userId || req.params.residentId;
  
  if (resourceId && parseInt(resourceId) === parseInt(req.user.id)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied. You can only access your own resources.",
  });
};

module.exports = {
  requireRole,
  requireAdmin,
  requireResident,
  requireSecurity,
  requireOwnershipOrAdmin,
};







