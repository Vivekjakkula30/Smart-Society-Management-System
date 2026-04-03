// server/routes/facilityBookings.js
const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authenticate, requireAdmin, requireResident, requireOwnershipOrAdmin } = require("../middleware");

router.get("/test", (req, res) => res.json({ message: "Facility bookings route working" }));

// ─── CREATE BOOKING (Resident) ────────────────────────────────────────────────
router.post("/", authenticate, requireResident, async (req, res) => {
  try {
    const { facility_id, booking_date, start_time, end_time, notes } = req.body;
    const resident_id = req.user.id;

    if (!facility_id || !booking_date)
      return res.status(400).json({ message: "facility_id and booking_date are required" });

    const [facRows] = await db.query(
      "SELECT id, booking_fee, is_active FROM facilities WHERE id = ?",
      [facility_id]
    );
    if (!facRows.length || !facRows[0].is_active)
      return res.status(400).json({ message: "Facility is not available for booking" });

    const booking_fee = facRows[0].booking_fee || 0;

    const [checkRows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM facility_bookings
       WHERE facility_id=? AND booking_date=? AND status IN ('pending','approved')`,
      [facility_id, booking_date]
    );
    if (checkRows[0]?.cnt > 0)
      return res.status(400).json({ message: "This facility is already booked for that date." });

    const [result] = await db.query(
      `INSERT INTO facility_bookings
         (resident_id, facility_id, booking_date, start_time, end_time,
          status, total_amount, payment_status, notes, created_at)
       VALUES (?,?,?,?,?,'pending',?,'unpaid',?,NOW())`,
      [resident_id, facility_id, booking_date, start_time || null,
       end_time || null, booking_fee, notes || null]
    );
    return res.status(201).json({
      message: "Booking request created successfully",
      bookingId: result.insertId,
      amount: booking_fee,
    });
  } catch (err) {
    console.error("[facilityBookings] POST /:", err);
    return res.status(500).json({ message: "Failed to create booking", error: err.message });
  }
});

// ─── GET RESIDENT BOOKINGS ────────────────────────────────────────────────────
router.get("/resident/:id", authenticate, requireOwnershipOrAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT fb.*, f.name AS facility_name, f.location AS facility_location, f.booking_fee
       FROM facility_bookings fb
       JOIN facilities f ON fb.facility_id = f.id
       WHERE fb.resident_id = ?
       ORDER BY fb.booking_date DESC, fb.created_at DESC`,
      [req.params.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error("[facilityBookings] GET /resident/:id:", err);
    return res.status(500).json({ message: "Failed to fetch bookings", error: err.message });
  }
});

// ─── GET ALL BOOKINGS — Admin ─────────────────────────────────────────────────
router.get("/all", authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         fb.id, fb.resident_id, fb.facility_id, fb.booking_date,
         fb.start_time, fb.end_time, fb.status, fb.total_amount,
         fb.payment_status, fb.payment_date, fb.notes, fb.created_at,
         f.name        AS facility_name,
         f.location    AS facility_location,
         f.booking_fee,
         u.full_name   AS resident_name,
         u.email       AS resident_email
       FROM facility_bookings fb
       JOIN facilities f ON fb.facility_id = f.id
       LEFT JOIN users u ON fb.resident_id = u.id
       ORDER BY fb.booking_date DESC, fb.created_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error("[facilityBookings] GET /all error:", err.message);
    return res.status(500).json({ message: "Failed to fetch bookings", error: err.message });
  }
});

// ─── REPORTS — Admin ──────────────────────────────────────────────────────────
router.get("/reports", authenticate, requireAdmin, async (req, res) => {
  try {
    const [summary] = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_status='paid'   THEN total_amount ELSE 0 END), 0) AS total_collected,
        COALESCE(SUM(CASE WHEN payment_status='unpaid'
                           AND status='approved'       THEN total_amount ELSE 0 END), 0) AS total_pending,
        COUNT(*)                                                                         AS total_bookings,
        SUM(CASE WHEN status='approved'                THEN 1 ELSE 0 END)               AS approved_count,
        SUM(CASE WHEN status='rejected'                THEN 1 ELSE 0 END)               AS rejected_count,
        SUM(CASE WHEN status='cancelled'               THEN 1 ELSE 0 END)               AS cancelled_count,
        SUM(CASE WHEN payment_status='paid'            THEN 1 ELSE 0 END)               AS paid_count
      FROM facility_bookings
    `);

    const [popularFacilities] = await db.query(`
      SELECT
        f.id, f.name, f.is_active, f.created_at,
        COUNT(fb.id) AS booking_count,
        COALESCE(SUM(CASE WHEN fb.payment_status='paid' THEN fb.total_amount ELSE 0 END), 0) AS revenue
      FROM facilities f
      LEFT JOIN facility_bookings fb ON f.id = fb.facility_id
      GROUP BY f.id, f.name, f.is_active, f.created_at
      ORDER BY booking_count DESC
    `);

    const [monthlyRevenue] = await db.query(`
      SELECT
        DATE_FORMAT(payment_date, '%b %Y') AS month,
        COUNT(*)                           AS bookings,
        SUM(total_amount)                  AS revenue
      FROM facility_bookings
      WHERE payment_status = 'paid'
        AND payment_date IS NOT NULL
        AND payment_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(payment_date, '%b %Y'), YEAR(payment_date), MONTH(payment_date)
      ORDER BY YEAR(payment_date), MONTH(payment_date)
    `);

    return res.json({ summary: summary[0], popularFacilities, monthlyRevenue });
  } catch (err) {
    console.error("[facilityBookings] GET /reports:", err);
    return res.status(500).json({ message: "Failed to fetch reports", error: err.message });
  }
});

// ─── UPDATE STATUS — Admin ────────────────────────────────────────────────────
router.put("/:id/status", authenticate, requireAdmin, async (req, res) => {
  const normalizedStatus = (req.body.status || "").toLowerCase();
  if (!["pending", "approved", "rejected", "cancelled"].includes(normalizedStatus))
    return res.status(400).json({ message: "Invalid status" });
  try {
    const [result] = await db.query(
      "UPDATE facility_bookings SET status=? WHERE id=?",
      [normalizedStatus, req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Booking not found" });
    return res.json({ message: "Booking status updated successfully" });
  } catch (err) {
    console.error("[facilityBookings] PUT /:id/status:", err);
    return res.status(500).json({ message: "Failed to update status", error: err.message });
  }
});

// ─── MARK PAID — Resident (own booking) OR Admin (any booking) ───────────────
// FIX: was requireAdmin only — residents couldn't mark their own payment, causing
//      the mark-paid call to 403, payment_status never updated in DB, and
//      "Pay Now" kept re-appearing after every page reload.
router.put("/:id/mark-paid", authenticate, async (req, res) => {
  try {
    const { payment_method, amount, transaction_id } = req.body;

    const [rows] = await db.query(
      "SELECT id, resident_id, payment_status, total_amount FROM facility_bookings WHERE id=?",
      [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ message: "Booking not found" });

    const booking = rows[0];

    // Authorization: must be the booking owner OR an admin
    const isAdmin = req.user.role === "admin" || req.user.is_admin;
    const isOwner = String(booking.resident_id) === String(req.user.id);
    if (!isAdmin && !isOwner)
      return res.status(403).json({ message: "Not authorised to mark this booking as paid" });

    if (booking.payment_status === "paid")
      return res.status(400).json({ message: "Already marked as paid" });

    await db.query(
      `UPDATE facility_bookings
       SET payment_status = 'paid',
           payment_date   = NOW()
       WHERE id = ?`,
      [req.params.id]
    );

    return res.json({
      message: "Payment marked successfully",
      amount: booking.total_amount,
      transaction_id: transaction_id || null,
    });
  } catch (err) {
    console.error("[facilityBookings] PUT /:id/mark-paid:", err);
    return res.status(500).json({ message: "Failed to mark payment", error: err.message });
  }
});

module.exports = router;