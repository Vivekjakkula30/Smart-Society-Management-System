// server/routes/users.js
const express = require('express');
const router = express.Router();
const db = require('../config/database'); // promise-based pool
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin, requireOwnershipOrAdmin } = require('../middleware');

// ==================== TEST ROUTE ====================
router.get('/test', (req, res) => {
  console.log('✅ Users routes test hit');
  res.json({ message: 'Users routes working!' });
});

// ==================== GET USER PROFILE ====================
// GET /api/users/:id
router.get('/:id', authenticate, requireOwnershipOrAdmin, async (req, res) => {
  console.log('🔵 GET /api/users/:id');
  const userId = req.params.id;

  try {
    const sql = `
      SELECT
        id,
        user_type,
        email,
        full_name,
        phone,
        shift_timing,
        is_active,
        created_at,
        updated_at
      FROM users
      WHERE id = ? AND is_active = TRUE
    `;

    const [users] = await db.query(sql, [userId]);

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = users[0];

    // Get additional role-specific information
    let additionalInfo = {};
    if (user.user_type === 'resident') {
      const residentSql = 'SELECT * FROM residents WHERE user_id = ?';
      const [residents] = await db.query(residentSql, [userId]);
      if (residents.length > 0) {
        additionalInfo = { resident: residents[0] };
      }
    } else if (user.user_type === 'admin') {
      const adminSql = 'SELECT * FROM admins WHERE user_id = ?';
      const [admins] = await db.query(adminSql, [userId]);
      if (admins.length > 0) {
        additionalInfo = { admin: admins[0] };
      }
    } else if (user.user_type === 'security') {
      const securitySql = 'SELECT * FROM security_staff WHERE user_id = ?';
      const [security] = await db.query(securitySql, [userId]);
      if (security.length > 0) {
        additionalInfo = { security: security[0] };
      }
    }

    return res.json({
      success: true,
      user: {
        ...user,
        ...additionalInfo,
      },
    });
  } catch (error) {
    console.error('❌ Get user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: error.message,
    });
  }
});

// ==================== UPDATE USER PROFILE ====================
// PUT /api/users/:id
router.put('/:id', authenticate, requireOwnershipOrAdmin, async (req, res) => {
  console.log('🔵 PUT /api/users/:id');
  const userId = req.params.id;
  const { full_name, phone, shift_timing } = req.body;

  try {
    // Validate input
    if (!full_name || full_name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required',
      });
    }

    // Check if user exists
    const checkSql = 'SELECT user_type FROM users WHERE id = ? AND is_active = TRUE';
    const [existingUsers] = await db.query(checkSql, [userId]);

    if (!existingUsers || existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const userType = existingUsers[0].user_type;

    // Only allow updating certain fields based on user type
    const updateData = {
      full_name: full_name.trim(),
      phone: phone ? phone.trim() : null,
    };

    // Only security staff can update shift_timing
    if (userType === 'security' && shift_timing) {
      const allowedShifts = ['morning', 'evening', 'night'];
      if (!allowedShifts.includes(shift_timing)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid shift timing. Must be: morning, evening, or night',
        });
      }
      updateData.shift_timing = shift_timing;
    }

    // Build dynamic update query
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    values.push(userId); // Add userId for WHERE clause

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const sql = `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = ?`;

    const [result] = await db.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found or no changes made',
      });
    }

    return res.json({
      success: true,
      message: 'User profile updated successfully',
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error('❌ Update user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user profile',
      error: error.message,
    });
  }
});

// ==================== GET ALL USERS (ADMIN ONLY) ====================
// GET /api/users
router.get('/', authenticate, requireAdmin, async (req, res) => {
  console.log('🔵 GET /api/users (all)');

  try {
    const sql = `
      SELECT
        u.id,
        u.user_type,
        u.email,
        u.full_name,
        u.phone,
        u.shift_timing,
        u.is_active,
        u.created_at,
        u.updated_at,
        CASE
          WHEN u.user_type = 'resident' THEN r.flat_number
          WHEN u.user_type = 'security' THEN s.staff_id
          WHEN u.user_type = 'admin' THEN a.admin_id
          ELSE NULL
        END as role_id,
        CASE
          WHEN u.user_type = 'resident' THEN r.block_name
          ELSE NULL
        END as block_name
      FROM users u
      LEFT JOIN residents r ON u.id = r.user_id
      LEFT JOIN security_staff s ON u.id = s.user_id
      LEFT JOIN admins a ON u.id = a.user_id
      ORDER BY u.created_at DESC
    `;

    const [users] = await db.query(sql);

    return res.json({
      success: true,
      users: users,
      total: users.length,
    });
  } catch (error) {
    console.error('❌ Get all users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message,
    });
  }
});

// ==================== DEACTIVATE USER (ADMIN ONLY) ====================
// DELETE /api/users/:id (soft delete)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  console.log('🔵 DELETE /api/users/:id (soft delete)');
  const userId = req.params.id;

  try {
    // Check if user exists and is not already inactive
    const checkSql = 'SELECT user_type, is_active FROM users WHERE id = ?';
    const [existingUsers] = await db.query(checkSql, [userId]);

    if (!existingUsers || existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!existingUsers[0].is_active) {
      return res.status(400).json({
        success: false,
        message: 'User is already inactive',
      });
    }

    // Prevent deactivating admin users (for safety)
    if (existingUsers[0].user_type === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot deactivate admin users',
      });
    }

    // Soft delete by setting is_active to FALSE
    const sql = 'UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = ?';
    const [result] = await db.query(sql, [userId]);

    return res.json({
      success: true,
      message: 'User deactivated successfully',
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error('❌ Deactivate user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to deactivate user',
      error: error.message,
    });
  }
});

module.exports = router;
