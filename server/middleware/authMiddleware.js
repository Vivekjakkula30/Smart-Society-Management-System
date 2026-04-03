// server/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const { JWT_SECRET } = require("../config/jwt");

/**
 * Middleware to verify JWT token and attach user info to request
 * Usage: router.get('/protected-route', authenticate, handler)
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Authorization header required.",
      });
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token has expired. Please login again.",
        });
      } else if (err.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      }
      throw err;
    }

    // Verify user still exists and is active (optional but recommended)
    try {
      const [users] = await db.query(
        "SELECT id, email, user_type, is_active, full_name FROM users WHERE id = ?",
        [decoded.id]
      );

      if (!users || users.length === 0) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      const user = users[0];

      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          message: "User account is inactive",
        });
      }

      // Attach user info to request object
      req.user = {
        id: user.id,
        email: user.email,
        role: user.user_type,
        name: user.full_name,
      };
    } catch (dbErr) {
      console.error("Database error in authenticate middleware:", dbErr);
      // Continue even if DB check fails (optional - you can return error instead)
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };
    }

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Optional: Get token from query parameter (for backward compatibility)
 * Usage: router.get('/route', authenticateOptional, handler)
 */
const authenticateOptional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const tokenFromQuery = req.query.token;

    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader || tokenFromQuery;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const [users] = await db.query(
          "SELECT id, email, user_type, is_active, full_name FROM users WHERE id = ?",
          [decoded.id]
        );

        if (users && users.length > 0 && users[0].is_active) {
          req.user = {
            id: users[0].id,
            email: users[0].email,
            role: users[0].user_type,
            name: users[0].full_name,
          };
        }
      } catch (err) {
        // Token invalid but continue without user
        req.user = null;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    req.user = null;
    next();
  }
};

module.exports = {
  authenticate,
  authenticateOptional,
};

