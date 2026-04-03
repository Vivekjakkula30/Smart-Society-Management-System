// server/routes/dashboard.js
const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authenticate, requireAdmin } = require("../middleware");

// ========== GET RECENT ACTIVITY ==========
router.get("/recent-activity", authenticate, requireAdmin, async (req, res) => {
  console.log("🔵 GET /api/dashboard/recent-activity");

  try {
    const activities = [];

    // 1. Recent complaints
    const [complaints] = await db.query(`
      SELECT 
        c.id,
        c.title,
        c.created_at,
        u.full_name AS resident_name
      FROM complaints c
      LEFT JOIN users u ON c.resident_id = u.id
      ORDER BY c.created_at DESC
      LIMIT 5
    `);
    complaints.forEach((c) => {
      activities.push({
        type: "complaint",
        icon: "📋",
        color: "bg-indigo-500",
        message: `New complaint: "${c.title}"${c.resident_name ? ` by ${c.resident_name}` : ""}`,
        created_at: c.created_at,
      });
    });

    // 2. Recent facility bookings
    const [bookings] = await db.query(`
      SELECT 
        fb.id,
        fb.booking_date,
        fb.created_at,
        f.name AS facility_name,
        u.full_name AS resident_name
      FROM facility_bookings fb
      LEFT JOIN facilities f ON fb.facility_id = f.id
      LEFT JOIN users u ON fb.resident_id = u.id
      ORDER BY fb.created_at DESC
      LIMIT 5
    `);
    bookings.forEach((b) => {
      activities.push({
        type: "booking",
        icon: "🏢",
        color: "bg-amber-500",
        message: `Facility booking: ${b.facility_name || "Facility"} on ${b.booking_date}${b.resident_name ? ` by ${b.resident_name}` : ""}`,
        created_at: b.created_at,
      });
    });

    // 3. Recent residents added
    const [residents] = await db.query(`
      SELECT 
        id,
        full_name,
        email,
        created_at
      FROM users
      WHERE user_type = 'resident'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    residents.forEach((r) => {
      activities.push({
        type: "resident",
        icon: "👥",
        color: "bg-emerald-500",
        message: `New resident registered: ${r.full_name || r.email}`,
        created_at: r.created_at,
      });
    });

    // 4. Recent maintenance invoices
    const [invoices] = await db.query(`
      SELECT 
        mi.id,
        mi.month,
        mi.year,
        mi.amount,
        mi.created_at,
        u.full_name AS resident_name
      FROM maintenance_invoices mi
      LEFT JOIN users u ON mi.resident_id = u.id
      ORDER BY mi.created_at DESC
      LIMIT 5
    `);
    invoices.forEach((inv) => {
      activities.push({
        type: "maintenance",
        icon: "💰",
        color: "bg-blue-500",
        message: `Maintenance invoice: ₹${inv.amount} for ${inv.month}/${inv.year}${inv.resident_name ? ` — ${inv.resident_name}` : ""}`,
        created_at: inv.created_at,
      });
    });

    // Sort all activities by date descending, take top 10
    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const recent = activities.slice(0, 10);

    return res.json(recent);
  } catch (err) {
    console.error("❌ Error fetching recent activity:", err);
    return res.status(500).json({
      message: "Failed to fetch recent activity",
      error: err.message,
    });
  }
});

module.exports = router;