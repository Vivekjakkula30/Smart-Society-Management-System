// server/routes/maintenance.js
const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authenticate, requireAdmin, requireOwnershipOrAdmin } = require("../middleware");
const { notifyPaymentReminder } = require("../utils/notificationService");

// =============== TEST ===============
router.get("/test", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 AS ok");
    return res.json({ message: "Maintenance route working", db: rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Maintenance route DB error", error: err.message });
  }
});

async function markOverdueIfNeeded() {
  try {
    await db.query(`UPDATE maintenance_invoices SET status = 'overdue' WHERE status = 'unpaid' AND due_date < CURDATE()`);
  } catch (err) {
    console.error("Error in markOverdueIfNeeded:", err.message);
  }
}

const generateInvoiceNumber = (residentId, month, year) => {
  return `INV-${residentId}-${year}-${String(month).padStart(2, '0')}-${Date.now()}`;
};

// =============== GET resident invoices ===============
router.get("/resident/:id", authenticate, requireOwnershipOrAdmin, async (req, res) => {
  const residentId = req.params.id;
  if (!residentId) return res.status(400).json({ message: "Resident ID is required" });

  try {
    await markOverdueIfNeeded();
    const [rows] = await db.query(
      `SELECT id, resident_id, month, year, amount, due_date, status, paid_on, notes, created_at
       FROM maintenance_invoices WHERE resident_id = ?
       ORDER BY year DESC, month DESC, due_date DESC`,
      [residentId]
    );
    return res.json(rows);
  } catch (err) {
    console.error("DB error (GET resident maintenance):", err);
    return res.status(500).json({ message: "DB error while fetching maintenance invoices", error: err.message });
  }
});

// =============== GET all invoices (admin) ===============
router.get("/all", authenticate, requireAdmin, async (req, res) => {
  const { month, year, status } = req.query;
  const whereClauses = [];
  const params = [];

  if (month)  { whereClauses.push("month = ?");  params.push(Number(month)); }
  if (year)   { whereClauses.push("year = ?");   params.push(Number(year)); }
  if (status) { whereClauses.push("status = ?"); params.push(status); }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  try {
    await markOverdueIfNeeded();
    const [rows] = await db.query(
      `SELECT id, resident_id, month, year, amount, due_date, status, paid_on, notes, created_at
       FROM maintenance_invoices ${whereSql} ORDER BY year DESC, month DESC, due_date DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error("DB error (GET all maintenance):", err);
    return res.status(500).json({ message: "DB error while fetching all maintenance invoices", error: err.message });
  }
});

// OPTIONAL: base GET /api/maintenance
router.get("/", authenticate, requireAdmin, async (req, res) => {
  try {
    await markOverdueIfNeeded();
    const [rows] = await db.query(
      `SELECT id, resident_id, month, year, amount, due_date, status, paid_on, notes, created_at
       FROM maintenance_invoices ORDER BY year DESC, month DESC, due_date DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error("DB error (GET /api/maintenance):", err);
    return res.status(500).json({ message: "DB error while fetching maintenance invoices", error: err.message });
  }
});

// =============== Generate invoice(s) ===============
router.post("/generate", authenticate, requireAdmin, async (req, res) => {
  const { resident_id, month, year, amount, due_date, notes } = req.body || {};

  if (!month || !year || !amount || !due_date) {
    return res.status(400).json({ message: "month, year, amount and due_date are required" });
  }

  const m = Number(month);
  const y = Number(year);
  const amt = Number(amount);

  if (!Number.isInteger(m) || m < 1 || m > 12)
    return res.status(400).json({ message: "month must be between 1 and 12" });
  if (!Number.isInteger(y) || y < 2000 || y > 3000)
    return res.status(400).json({ message: "year must be a valid 4-digit year" });
  if (Number.isNaN(amt) || amt <= 0)
    return res.status(400).json({ message: "amount must be a positive number" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date))
    return res.status(400).json({ message: "due_date must be in YYYY-MM-DD format" });

  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      if (resident_id) {
        let numericResidentId;
        if (isNaN(resident_id)) {
          const [resRows] = await connection.query("SELECT user_id FROM residents WHERE resident_id = ?", [resident_id]);
          if (!resRows.length) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ message: `Resident '${resident_id}' not found` });
          }
          numericResidentId = resRows[0].user_id;
        } else {
          numericResidentId = Number(resident_id);
        }

        const invoiceNumber = generateInvoiceNumber(numericResidentId, m, y);
        const [result] = await connection.query(
          `INSERT INTO maintenance_invoices (resident_id, invoice_number, month, year, amount, due_date, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, 'unpaid', ?)`,
          [numericResidentId, invoiceNumber, m, y, amt, due_date, notes || null]
        );

        await connection.commit();
        connection.release();

        // Notify resident about new payment due
        try {
          const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          await notifyPaymentReminder({
            resident_user_id: numericResidentId,
            amount: amt,
            due_date,
            payment_type: `Maintenance (${monthNames[m - 1]} ${y})`,
            payment_id: result.insertId,
          });
        } catch (notifyErr) {
          console.error("⚠️ Payment reminder notification failed:", notifyErr.message);
        }

        return res.status(201).json({
          message: "Maintenance invoice generated for resident",
          id: result.insertId,
          invoice_number: invoiceNumber,
        });

      } else {
        // Bulk: generate for ALL residents
        const [residents] = await connection.query(`SELECT id FROM users WHERE user_type = 'resident'`);

        if (!residents.length) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ message: "No residents found" });
        }

        const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        let successCount = 0;
        const insertedIds = [];

        for (const r of residents) {
          const invoiceNumber = generateInvoiceNumber(r.id, m, y);
          try {
            const [ins] = await connection.query(
              `INSERT INTO maintenance_invoices (resident_id, invoice_number, month, year, amount, due_date, status, notes)
               VALUES (?, ?, ?, ?, ?, ?, 'unpaid', ?)`,
              [r.id, invoiceNumber, m, y, amt, due_date, notes || null]
            );
            insertedIds.push({ resident_id: r.id, invoice_id: ins.insertId });
            successCount++;
          } catch (singleErr) {
            console.error("Insert failed for resident_id", r.id, singleErr.message);
          }
        }

        await connection.commit();
        connection.release();

        // Notify all residents about their new payment due
        try {
          for (const { resident_id: rid, invoice_id } of insertedIds) {
            await notifyPaymentReminder({
              resident_user_id: rid,
              amount: amt,
              due_date,
              payment_type: `Maintenance (${monthNames[m - 1]} ${y})`,
              payment_id: invoice_id,
            });
          }
        } catch (notifyErr) {
          console.error("⚠️ Bulk payment reminder notification failed:", notifyErr.message);
        }

        return res.status(201).json({
          message: `Maintenance invoices generated for ${successCount} residents`,
          count: successCount,
        });
      }

    } catch (txErr) {
      try { await connection.rollback(); } catch (e) {}
      connection.release && connection.release();
      console.error("Transaction error during generate:", txErr);
      return res.status(500).json({ message: "DB error while generating maintenance invoice(s)", error: txErr.message });
    }
  } catch (err) {
    console.error("DB connection error in generate route:", err);
    return res.status(500).json({ message: "DB connection error", error: err.message });
  }
});

// =============== Mark invoice as paid ===============
router.put("/:id/mark-paid", authenticate, requireAdmin, async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ message: "Invoice ID is required" });

  try {
    const [result] = await db.query(
      `UPDATE maintenance_invoices SET status = 'paid', paid_on = CURDATE() WHERE id = ?`,
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    return res.json({ message: "Invoice marked as paid" });
  } catch (err) {
    console.error("DB error (PUT mark-paid):", err);
    return res.status(500).json({ message: "DB error while updating invoice", error: err.message });
  }
});

module.exports = router;