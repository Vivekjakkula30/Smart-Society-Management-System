// server/routes/payments.js
const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authenticate, requireAdmin, requireRole, requireOwnershipOrAdmin } = require("../middleware");
const { notifyPaymentReceived } = require("../utils/notificationService");

// GET /api/payments/test
router.get("/test", async (req, res) => {
  return res.json({ message: "Payments route working" });
});

// RECEIPT: generate PDF receipt for a payment
// GET /api/payments/receipt/:id
router.get("/receipt/:id", authenticate, async (req, res) => {
  const paymentId = req.params.id;
  try {
    const [rows] = await db.query(
      `SELECT p.*,
              mi.month    AS invoice_month,
              mi.year     AS invoice_year,
              mi.amount   AS invoice_amount,
              u.full_name AS resident_name,
              u.email     AS resident_email,
              u.phone     AS resident_phone
       FROM payments p
       LEFT JOIN maintenance_invoices mi ON p.invoice_id = mi.id
       LEFT JOIN users u ON p.resident_id = u.id
       WHERE p.id = ?`,
      [paymentId]
    );

    if (!rows.length) return res.status(404).json({ message: "Payment not found" });

    const p = rows[0];

    if (req.user.role === "resident" && parseInt(p.resident_id) !== parseInt(req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    let PDFDocument;
    try { PDFDocument = require("pdfkit"); }
    catch { return res.status(500).json({ message: "PDF generation unavailable — run: npm install pdfkit in /server" }); }

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="receipt-${paymentId}.pdf"`);
    doc.pipe(res);

    doc.fontSize(22).fillColor("#4338ca").text("Smart Society", { align: "center" })
      .moveDown(0.2).fontSize(11).fillColor("#6b7280").text("Management System", { align: "center" }).moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e5e7eb").stroke().moveDown(0.8);
    doc.fontSize(16).fillColor("#111827").text("Payment Receipt", { align: "center" }).moveDown(1);

    const col1 = 50, col2 = 300;
    const row = (label, value, x, y) => {
      doc.fontSize(10).fillColor("#6b7280").text(label, x, y);
      doc.fontSize(10).fillColor("#111827").text(String(value ?? "-"), x, y + 14);
    };

    const startY = doc.y;
    row("Receipt #", `RCPT-${p.id}`, col1, startY);
    row("Payment Date", p.payment_date ? new Date(p.payment_date).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN"), col2, startY);
    doc.moveDown(3);
    const y2 = doc.y;
    row("Resident Name", p.resident_name || `Resident ${p.resident_id}`, col1, y2);
    row("Email", p.resident_email || "-", col2, y2);
    doc.moveDown(3);
    const y3 = doc.y;
    row("Phone", p.resident_phone || "-", col1, y3);
    row("Payment Method", p.payment_method || "-", col2, y3);
    if (p.invoice_month) {
      doc.moveDown(3);
      const y4 = doc.y;
      row("Invoice Period", `${p.invoice_month}/${p.invoice_year}`, col1, y4);
      row("Invoice ID", p.invoice_id || "-", col2, y4);
    }
    if (p.transaction_id) { doc.moveDown(3); row("Transaction ID", p.transaction_id, col1, doc.y); }

    doc.moveDown(2.5);
    const boxY = doc.y;
    doc.rect(50, boxY, 495, 50).fillAndStroke("#f0fdf4", "#16a34a");
    doc.fontSize(13).fillColor("#15803d").text("Amount Paid", 70, boxY + 10)
      .fontSize(18).fillColor("#14532d")
      .text(`Rs. ${Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 70, boxY + 25);
    doc.fontSize(12).fillColor("#16a34a").text("PAID", 400, boxY + 18, { align: "right", width: 125 });

    if (p.notes) { doc.moveDown(3.5).fontSize(10).fillColor("#6b7280").text("Notes:").fillColor("#374151").text(p.notes); }

    doc.moveDown(4);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e5e7eb").stroke().moveDown(0.5);
    doc.fontSize(9).fillColor("#9ca3af")
      .text("This is a computer-generated receipt and does not require a signature.", { align: "center" })
      .text("© Smart Society Management System", { align: "center" });
    doc.end();
  } catch (err) {
    console.error("Receipt generation error:", err.stack || err);
    if (!res.headersSent) res.status(500).json({ message: "Failed to generate receipt", error: err.message });
  }
});

// Helper: get all admin user ids
const getAdminIds = async () => {
  const [admins] = await db.query(`SELECT id FROM users WHERE user_type = 'admin' AND is_active = 1`);
  return admins.map(a => a.id);
};

// POST /api/payments/create
router.post("/create", authenticate, requireRole('admin', 'resident'), async (req, res) => {
  const { invoice_id, resident_id, amount, payment_method = "Offline", transaction_id, notes } = req.body || {};

  if (req.user.role === 'resident' && resident_id && parseInt(resident_id) !== parseInt(req.user.id)) {
    return res.status(403).json({ message: "Residents can only create payments for themselves" });
  }

  const finalResidentId = req.user.role === 'resident' ? req.user.id : (resident_id || req.user.id);

  if (!finalResidentId || !amount) {
    return res.status(400).json({ message: "resident_id and amount are required" });
  }

  try {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO payments (invoice_id, resident_id, amount, payment_method, transaction_id, status)
         VALUES (?, ?, ?, ?, ?, 'completed')`,
        [invoice_id || null, finalResidentId, Number(amount), payment_method, transaction_id || null]
      );
      const paymentId = result.insertId;

      if (invoice_id) {
        await conn.query(`UPDATE maintenance_invoices SET status = 'paid', paid_on = CURDATE() WHERE id = ?`, [invoice_id]);
      }

      await conn.commit();
      conn.release();

      // Notify admins that a payment was received
      try {
        const [resident] = await db.query(`SELECT full_name FROM users WHERE id = ?`, [finalResidentId]);
        const residentName = resident[0]?.full_name || `Resident ${finalResidentId}`;
        const adminIds = await getAdminIds();
        await notifyPaymentReceived({
          admin_user_ids: adminIds,
          resident_name: residentName,
          amount: Number(amount),
          payment_type: invoice_id ? "Maintenance" : "General",
          payment_id: paymentId,
        });
      } catch (notifyErr) {
        console.error("⚠️ Payment received notification failed:", notifyErr.message);
      }

      return res.status(201).json({ message: "Payment recorded", id: paymentId, receipt_number: `RCPT-${Date.now()}` });
    } catch (err) {
      await conn.rollback().catch(() => {});
      conn.release && conn.release();
      return res.status(500).json({ message: "DB error while creating payment", error: err.message });
    }
  } catch (err) {
    return res.status(500).json({ message: "DB connection error", error: err.message });
  }
});

// POST /api/payments/:invoiceId/mark-paid
router.post("/:invoiceId/mark-paid", authenticate, requireAdmin, async (req, res) => {
  const invoiceId = req.params.invoiceId;
  const { resident_id, amount, payment_method = "Offline", transaction_id } = req.body || {};

  if (!invoiceId || !resident_id || !amount) {
    return res.status(400).json({ message: "invoiceId, resident_id and amount are required" });
  }

  try {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [payRes] = await conn.query(
        `INSERT INTO payments (invoice_id, resident_id, amount, payment_method, transaction_id, status)
         VALUES (?, ?, ?, ?, ?, 'completed')`,
        [invoiceId, resident_id, Number(amount), payment_method, transaction_id || null]
      );
      const paymentId = payRes.insertId;

      await conn.query(`UPDATE maintenance_invoices SET status = 'paid', paid_on = CURDATE() WHERE id = ?`, [invoiceId]);

      await conn.commit();
      conn.release();

      // Notify the resident their payment has been marked as received
      try {
        const [resident] = await db.query(`SELECT full_name FROM users WHERE id = ?`, [resident_id]);
        const residentName = resident[0]?.full_name || `Resident ${resident_id}`;
        const adminIds = await getAdminIds();
        await notifyPaymentReceived({
          admin_user_ids: adminIds,
          resident_name: residentName,
          amount: Number(amount),
          payment_type: "Maintenance",
          payment_id: paymentId,
        });
      } catch (notifyErr) {
        console.error("⚠️ Mark-paid notification failed:", notifyErr.message);
      }

      return res.json({ message: "Invoice marked as paid", paymentId });
    } catch (err) {
      await conn.rollback().catch(() => {});
      conn.release && conn.release();
      return res.status(500).json({ message: "DB error while marking invoice paid", error: err.message });
    }
  } catch (err) {
    return res.status(500).json({ message: "DB connection error", error: err.message });
  }
});

// GET /api/payments/resident/:id
router.get("/resident/:id", authenticate, requireOwnershipOrAdmin, async (req, res) => {
  const residentId = req.params.id;
  if (!residentId) return res.status(400).json({ message: "Resident id required" });
  try {
    const [rows] = await db.query(
      `SELECT p.*, mi.month AS invoice_month, mi.year AS invoice_year, mi.amount AS invoice_amount
       FROM payments p LEFT JOIN maintenance_invoices mi ON p.invoice_id = mi.id
       WHERE p.resident_id = ? ORDER BY p.payment_date DESC`,
      [residentId]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: "DB error while fetching payments", error: err.message });
  }
});

// GET /api/payments/all
router.get("/all", authenticate, requireAdmin, async (req, res) => {
  const { month, year, resident_id } = req.query;
  const where = [], params = [];
  if (resident_id) { where.push("p.resident_id = ?"); params.push(resident_id); }
  if (month)       { where.push("mi.month = ?");       params.push(Number(month)); }
  if (year)        { where.push("mi.year = ?");        params.push(Number(year)); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  try {
    const [rows] = await db.query(
      `SELECT p.*, mi.month AS invoice_month, mi.year AS invoice_year, mi.id AS invoice_id
       FROM payments p LEFT JOIN maintenance_invoices mi ON p.invoice_id = mi.id
       ${whereSql} ORDER BY p.payment_date DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: "DB error while fetching payments", error: err.message });
  }
});

// POST /api/payments/webhook
router.post("/webhook", async (req, res) => {
  const { invoice_id, resident_id, amount, transaction_id, status } = req.body || {};
  if (!resident_id || !amount || !transaction_id) {
    return res.status(400).json({ message: "Invalid webhook payload" });
  }
  try {
    if (status === "success" || status === "completed") {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        const [r] = await conn.query(
          `INSERT INTO payments (invoice_id, resident_id, amount, payment_method, transaction_id, status)
           VALUES (?, ?, ?, 'Online', ?, 'completed')`,
          [invoice_id || null, resident_id, Number(amount), transaction_id]
        );
        if (invoice_id) {
          await conn.query(`UPDATE maintenance_invoices SET status = 'paid', paid_on = CURDATE() WHERE id = ?`, [invoice_id]);
        }
        await conn.commit();
        conn.release();
        return res.json({ message: "Webhook processed", paymentId: r.insertId });
      } catch (err) {
        await conn.rollback().catch(() => {});
        conn.release && conn.release();
        return res.status(500).json({ message: "Webhook DB error", error: err.message });
      }
    } else {
      return res.status(200).json({ message: "Webhook received (no action for non-success status)" });
    }
  } catch (err) {
    return res.status(500).json({ message: "Webhook processing error", error: err.message });
  }
});

module.exports = router;