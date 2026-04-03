// server/routes/residents.js
const express = require("express");
const router = express.Router();
const db = require("../config/database");
const bcrypt = require("bcryptjs");
const { authenticate, requireAdmin, requireRole } = require("../middleware");

// ==================== GET RESIDENTS LIST (security + admin) ====================
// FIX: Was returning r.id AS id (residents table PK = 1,2,3,7...)
//      Now returns u.id AS id (users table PK = 2,3,5,8,9,10...)
//      gate_logs.resident_id stores users.id, so this must match
router.get("/list", authenticate, requireRole('admin', 'security'), async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT u.id AS id, u.full_name, r.flat_number, r.block_name
      FROM users u
      LEFT JOIN residents r ON u.id = r.user_id
      WHERE u.user_type = 'resident' AND u.is_active = 1
      ORDER BY u.full_name
    `);
    return res.json(results);
  } catch (err) {
    console.error("❌ Get residents list error:", err);
    return res.status(500).json({ message: "Failed to fetch residents", error: err.message });
  }
});

// ==================== GET ALL RESIDENTS (admin only) ====================
router.get("/", authenticate, requireAdmin, async (req, res) => {
  console.log("🔵 GET /api/residents");
  try {
    const sql = `
      SELECT 
        u.id, u.email, u.full_name, u.phone, u.is_active, u.created_at,
        r.id AS resident_table_id, r.resident_id, r.flat_number, r.block_name, r.address
      FROM users u
      LEFT JOIN residents r ON u.id = r.user_id
      WHERE u.user_type = 'resident'
      ORDER BY u.created_at DESC
    `;
    const [results] = await db.query(sql);
    console.log(`✅ Found ${results.length} residents`);
    return res.json(results);
  } catch (err) {
    console.error("❌ Get residents error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch residents", error: err.message });
  }
});

// ==================== DEACTIVATE RESIDENT (admin only) ====================
router.patch("/:id/deactivate", authenticate, requireAdmin, async (req, res) => {
  console.log("🔵 PATCH /api/residents/:id/deactivate");
  const userId = req.params.id;
  try {
    const [check] = await db.query(
      "SELECT id, is_active FROM users WHERE id = ? AND user_type = 'resident'",
      [userId]
    );
    if (!check || check.length === 0) {
      return res.status(404).json({ success: false, message: "Resident not found" });
    }
    if (!check[0].is_active) {
      return res.status(400).json({ success: false, message: "Resident is already inactive" });
    }
    await db.query("UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = ?", [userId]);
    console.log(`✅ Resident ${userId} deactivated`);
    return res.json({ success: true, message: "Resident deactivated successfully" });
  } catch (err) {
    console.error("❌ Deactivate resident error:", err);
    return res.status(500).json({ success: false, message: "Failed to deactivate resident", error: err.message });
  }
});

// ==================== RESTORE RESIDENT (admin only) ====================
router.patch("/:id/activate", authenticate, requireAdmin, async (req, res) => {
  console.log("🔵 PATCH /api/residents/:id/activate");
  const userId = req.params.id;
  try {
    const [check] = await db.query(
      "SELECT id, is_active FROM users WHERE id = ? AND user_type = 'resident'",
      [userId]
    );
    if (!check || check.length === 0) {
      return res.status(404).json({ success: false, message: "Resident not found" });
    }
    if (check[0].is_active) {
      return res.status(400).json({ success: false, message: "Resident is already active" });
    }
    await db.query("UPDATE users SET is_active = TRUE, updated_at = NOW() WHERE id = ?", [userId]);
    console.log(`✅ Resident ${userId} restored`);
    return res.json({ success: true, message: "Resident restored successfully" });
  } catch (err) {
    console.error("❌ Activate resident error:", err);
    return res.status(500).json({ success: false, message: "Failed to restore resident", error: err.message });
  }
});

// ==================== GET SINGLE RESIDENT ====================
router.get("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const sql = `
      SELECT 
        u.id, u.email, u.full_name, u.phone, u.is_active, u.created_at,
        r.id AS resident_table_id, r.resident_id, r.flat_number, r.block_name, r.address
      FROM users u
      LEFT JOIN residents r ON u.id = r.user_id
      WHERE u.id = ? AND u.user_type = 'resident'
    `;
    const [results] = await db.query(sql, [userId]);
    if (results.length === 0) return res.status(404).json({ success: false, message: "Resident not found" });
    return res.json(results[0]);
  } catch (err) {
    console.error("❌ Get resident error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch resident", error: err.message });
  }
});

// ==================== CREATE RESIDENT ====================
router.post("/", authenticate, requireAdmin, async (req, res) => {
  console.log("🔵 POST /api/residents");
  try {
    const { email, password, full_name, phone, resident_id, flat_number, block_name, address } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ success: false, message: "email, password, and full_name are required" });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [existing] = await conn.query("SELECT id FROM users WHERE email = ?", [email]);
      if (existing.length > 0) {
        await conn.rollback(); conn.release();
        return res.status(400).json({ success: false, message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const [userResult] = await conn.query(
        `INSERT INTO users (user_type, email, password, full_name, phone, is_active) VALUES (?, ?, ?, ?, ?, TRUE)`,
        ["resident", email, hashedPassword, full_name, phone || null]
      );
      const userId = userResult.insertId;
      const finalResidentId = resident_id || `RES${userId.toString().padStart(4, '0')}`;

      if (resident_id) {
        const [existingResident] = await conn.query("SELECT id FROM residents WHERE resident_id = ?", [finalResidentId]);
        if (existingResident.length > 0) {
          await conn.rollback(); conn.release();
          return res.status(400).json({ success: false, message: "Resident ID already exists" });
        }
      }

      await conn.query(
        `INSERT INTO residents (resident_id, user_id, flat_number, block_name, address) VALUES (?, ?, ?, ?, ?)`,
        [finalResidentId, userId, flat_number || null, block_name || null, address || null]
      );

      await conn.commit(); conn.release();
      console.log("✅ Resident created, user ID:", userId);
      return res.status(201).json({ success: true, message: "Resident created successfully", userId, resident_id: finalResidentId });
    } catch (err) {
      await conn.rollback(); conn.release(); throw err;
    }
  } catch (err) {
    console.error("❌ Create resident error:", err);
    return res.status(500).json({ success: false, message: "Failed to create resident", error: err.message });
  }
});

// ==================== UPDATE RESIDENT ====================
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  console.log("🔵 PUT /api/residents/:id");
  try {
    const userId = req.params.id;
    const { email, password, full_name, phone, is_active, resident_id, flat_number, block_name, address } = req.body;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [userCheck] = await conn.query("SELECT id FROM users WHERE id = ? AND user_type = 'resident'", [userId]);
      if (userCheck.length === 0) {
        await conn.rollback(); conn.release();
        return res.status(404).json({ success: false, message: "Resident not found" });
      }

      const updateFields = [];
      const updateValues = [];

      if (email !== undefined) {
        const [emailCheck] = await conn.query("SELECT id FROM users WHERE email = ? AND id != ?", [email, userId]);
        if (emailCheck.length > 0) {
          await conn.rollback(); conn.release();
          return res.status(400).json({ success: false, message: "Email already registered" });
        }
        updateFields.push("email = ?"); updateValues.push(email);
      }
      if (password !== undefined && password !== "") {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateFields.push("password = ?"); updateValues.push(hashedPassword);
      }
      if (full_name !== undefined) { updateFields.push("full_name = ?"); updateValues.push(full_name); }
      if (phone !== undefined) { updateFields.push("phone = ?"); updateValues.push(phone); }
      if (is_active !== undefined) { updateFields.push("is_active = ?"); updateValues.push(is_active); }

      if (updateFields.length > 0) {
        updateValues.push(userId);
        await conn.query(`UPDATE users SET ${updateFields.join(", ")}, updated_at = NOW() WHERE id = ?`, updateValues);
      }

      const residentFields = [];
      const residentValues = [];

      if (resident_id !== undefined) {
        const [residentIdCheck] = await conn.query(`SELECT id FROM residents WHERE resident_id = ? AND user_id != ?`, [resident_id, userId]);
        if (residentIdCheck.length > 0) {
          await conn.rollback(); conn.release();
          return res.status(400).json({ success: false, message: "Resident ID already exists" });
        }
        residentFields.push("resident_id = ?"); residentValues.push(resident_id);
      }
      if (flat_number !== undefined) { residentFields.push("flat_number = ?"); residentValues.push(flat_number); }
      if (block_name !== undefined) { residentFields.push("block_name = ?"); residentValues.push(block_name); }
      if (address !== undefined) { residentFields.push("address = ?"); residentValues.push(address); }

      if (residentFields.length > 0) {
        const [residentCheck] = await conn.query("SELECT id FROM residents WHERE user_id = ?", [userId]);
        if (residentCheck.length > 0) {
          residentValues.push(userId);
          await conn.query(`UPDATE residents SET ${residentFields.join(", ")} WHERE user_id = ?`, residentValues);
        } else {
          const finalResidentId = resident_id || `RES${userId.toString().padStart(4, '0')}`;
          await conn.query(
            `INSERT INTO residents (resident_id, user_id, flat_number, block_name, address) VALUES (?, ?, ?, ?, ?)`,
            [finalResidentId, userId, flat_number || null, block_name || null, address || null]
          );
        }
      }

      await conn.commit(); conn.release();
      console.log("✅ Resident updated, user ID:", userId);
      return res.json({ success: true, message: "Resident updated successfully" });
    } catch (err) {
      await conn.rollback(); conn.release(); throw err;
    }
  } catch (err) {
    console.error("❌ Update resident error:", err);
    return res.status(500).json({ success: false, message: "Failed to update resident", error: err.message });
  }
});

// ==================== DELETE RESIDENT ====================
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  console.log("🔵 DELETE /api/residents/:id");
  try {
    const userId = req.params.id;
    const [userCheck] = await db.query("SELECT id FROM users WHERE id = ? AND user_type = 'resident'", [userId]);
    if (userCheck.length === 0) return res.status(404).json({ success: false, message: "Resident not found" });

    await db.query("DELETE FROM users WHERE id = ?", [userId]);
    console.log("✅ Resident deleted, user ID:", userId);
    return res.json({ success: true, message: "Resident deleted successfully" });
  } catch (err) {
    console.error("❌ Delete resident error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete resident", error: err.message });
  }
});

module.exports = router;