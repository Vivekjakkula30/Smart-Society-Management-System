// server/routes/visitors.js
const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authenticate, requireSecurity, requireResident, requireRole } = require("../middleware");
const { notifyVisitorArrival, notifyVisitorDecision } = require("../utils/notificationService");

// ======================
// TEST ROUTE
// ======================
router.get("/test", (req, res) => {
  res.json({ message: "Visitor routes working" });
});

// ======================
// 1. SECURITY: ADD VISITOR ENTRY
// ======================
router.post("/entry", authenticate, requireSecurity, async (req, res) => {
  try {
    const { name, phone, purpose, resident_id } = req.body;

    if (!name || !resident_id) {
      return res.status(400).json({ message: "Visitor name and resident are required" });
    }

    const [result] = await db.query(
      `INSERT INTO gate_logs (resident_id, visitor_name, visitor_phone, visitor_purpose, status, entry_time, entry_by_security_id)
       VALUES (?, ?, ?, ?, 'pending', NOW(), ?)`,
      [resident_id, name, phone || null, purpose || null, req.user.id]
    );

    const gateLogId = result.insertId;

    try {
      await notifyVisitorArrival({
        resident_user_id: resident_id,
        visitor_name: name,
        purpose: purpose || "",
        gate_log_id: gateLogId,
      });
    } catch (notifyErr) {
      console.error("⚠️ Visitor arrival notification failed:", notifyErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Visitor entry added successfully",
      gate_log_id: gateLogId,
    });
  } catch (err) {
    console.error("❌ Visitor entry error:", err);
    return res.status(500).json({ success: false, message: "Failed to add visitor entry", error: err.message });
  }
});

// ======================
// 2. RESIDENT: GET PENDING APPROVALS
// FIX: Removed requireOwnershipOrAdmin (caused silent 403 due to number vs string
//      type mismatch). Replaced with inline String() cast ownership check.
//      Uses req.user.role (not req.user.user_type) per authMiddleware.js
// ======================
router.get("/pending/:residentId", authenticate, async (req, res) => {
  try {
    const { residentId } = req.params;

    const isAdmin = req.user.role === "admin";
    const isOwner = String(req.user.id) === String(residentId);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: `Access denied — your user id (${req.user.id}) does not match residentId (${residentId})`,
      });
    }

    const [results] = await db.query(
      `SELECT gl.id AS gate_log_id, gl.visitor_name AS name, gl.visitor_phone AS phone,
              gl.visitor_purpose AS purpose, gl.entry_time, gl.status
       FROM gate_logs gl
       WHERE gl.resident_id = ? AND gl.status = 'pending'
       ORDER BY gl.entry_time DESC`,
      [residentId]
    );

    return res.json(results);
  } catch (err) {
    console.error("❌ Fetch pending approvals error:", err);
    return res.status(500).json({ message: "Failed to fetch pending visitors", error: err.message });
  }
});

// ======================
// 3. RESIDENT: APPROVE / REJECT VISITOR
// ======================
router.put("/decision/:gateLogId", authenticate, requireResident, async (req, res) => {
  try {
    const { gateLogId } = req.params;
    const { status, approved_by } = req.body;

    if (!["approved", "rejected", "APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const normalizedStatus = status.toLowerCase();

    const [result] = await db.query(
      `UPDATE gate_logs SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?`,
      [normalizedStatus, approved_by || null, gateLogId]
    );

    try {
      const [logs] = await db.query(
        `SELECT gl.visitor_name, gl.entry_by_security_id
         FROM gate_logs gl WHERE gl.id = ?`,
        [gateLogId]
      );

      if (logs.length > 0) {
        const log = logs[0];

        if (log.entry_by_security_id) {
          await notifyVisitorDecision({
            security_user_id: log.entry_by_security_id,
            visitor_name: log.visitor_name,
            decision: normalizedStatus,
            gate_log_id: gateLogId,
          });
        } else {
          const [securityUsers] = await db.query(
            `SELECT id FROM users WHERE user_type = 'security' AND is_active = 1`
          );
          for (const su of securityUsers) {
            await notifyVisitorDecision({
              security_user_id: su.id,
              visitor_name: log.visitor_name,
              decision: normalizedStatus,
              gate_log_id: gateLogId,
            });
          }
        }
      }
    } catch (notifyErr) {
      console.error("⚠️ Visitor decision notification failed:", notifyErr.message);
    }

    return res.json({
      success: true,
      message: `Visitor ${normalizedStatus} successfully`,
      affectedRows: result.affectedRows,
    });
  } catch (err) {
    console.error("❌ Approval error:", err);
    return res.status(500).json({ message: "Failed to update visitor status", error: err.message });
  }
});

// ======================
// 4. SECURITY: MARK VISITOR EXIT
// ======================
router.put("/exit/:gateLogId", authenticate, requireSecurity, async (req, res) => {
  try {
    const { gateLogId } = req.params;
    const [result] = await db.query(
      `UPDATE gate_logs SET status = 'exited', exit_time = NOW() WHERE id = ?`,
      [gateLogId]
    );
    return res.json({ success: true, message: "Visitor exit marked successfully", affectedRows: result.affectedRows });
  } catch (err) {
    console.error("❌ Exit error:", err);
    return res.status(500).json({ message: "Failed to mark visitor exit", error: err.message });
  }
});

// ======================
// 5. SECURITY: TODAY'S VISITORS
// FIX: JOIN users + residents to get resident name, flat_number, block_name
//      residents table has flat_number & block_name directly — no flats/blocks join needed
// ======================
router.get("/today", authenticate, requireRole('security', 'admin'), async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT
         gl.id              AS gate_log_id,
         gl.visitor_name    AS name,
         gl.visitor_phone   AS phone,
         gl.visitor_purpose AS purpose,
         gl.resident_id,
         gl.entry_time,
         gl.exit_time,
         gl.status,
         u.full_name        AS resident_name,
         r.flat_number      AS flat_number,
         r.block_name       AS block_name
       FROM gate_logs gl
       LEFT JOIN users     u ON u.id      = gl.resident_id
       LEFT JOIN residents r ON r.user_id = gl.resident_id
       WHERE DATE(gl.entry_time) = CURDATE()
       ORDER BY gl.entry_time DESC`
    );
    return res.json(results);
  } catch (err) {
    console.error("❌ Fetch today visitors error:", err);
    return res.status(500).json({ message: "Failed to fetch today's visitors", error: err.message });
  }
});

// ======================
// 6. SECURITY: ALL VISITORS
// ======================
router.get("/all", authenticate, requireRole('security', 'admin'), async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT
         gl.id              AS gate_log_id,
         gl.visitor_name    AS name,
         gl.visitor_phone   AS phone,
         gl.visitor_purpose AS purpose,
         gl.resident_id,
         gl.entry_time,
         gl.exit_time,
         gl.status,
         u.full_name        AS resident_name,
         r.flat_number      AS flat_number,
         r.block_name       AS block_name
       FROM gate_logs gl
       LEFT JOIN users     u ON u.id      = gl.resident_id
       LEFT JOIN residents r ON r.user_id = gl.resident_id
       ORDER BY gl.entry_time DESC
       LIMIT 100`
    );
    return res.json(results);
  } catch (err) {
    console.error("❌ Fetch all visitors error:", err);
    return res.status(500).json({ message: "Failed to fetch visitors", error: err.message });
  }
});

// ======================
// 7. SECURITY: VISITOR REPORT (date range)
// GET /visitors/report?from=YYYY-MM-DD&to=YYYY-MM-DD
// ======================
router.get("/report", authenticate, requireRole('security', 'admin'), async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: "from and to query params are required (YYYY-MM-DD)" });
    }

    const [results] = await db.query(
      `SELECT
         gl.id              AS gate_log_id,
         gl.visitor_name    AS name,
         gl.visitor_phone   AS phone,
         gl.visitor_purpose AS purpose,
         gl.resident_id,
         gl.entry_time,
         gl.exit_time,
         gl.status,
         u.full_name        AS resident_name,
         r.flat_number      AS flat_number,
         r.block_name       AS block_name,
         sec.full_name      AS logged_by
       FROM gate_logs gl
       LEFT JOIN users     u   ON u.id      = gl.resident_id
       LEFT JOIN residents r   ON r.user_id = gl.resident_id
       LEFT JOIN users     sec ON sec.id    = gl.entry_by_security_id
       WHERE DATE(gl.entry_time) BETWEEN ? AND ?
       ORDER BY gl.entry_time DESC`,
      [from, to]
    );

    return res.json(results);
  } catch (err) {
    console.error("❌ Visitor report error:", err);
    return res.status(500).json({ message: "Failed to generate report", error: err.message });
  }
});

module.exports = router;