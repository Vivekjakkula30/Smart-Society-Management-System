// server/controllers/authController.js

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/jwt");
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[6-9]\d{9}$/;
const allowedUserTypes = ["resident", "admin", "security"];
const securityShifts = ["6 AM - 2 PM", "2 PM - 10 PM", "10 PM - 6 AM"];
const shiftMapping = {
  "6 AM - 2 PM": "morning",
  "2 PM - 10 PM": "evening",
  "10 PM - 6 AM": "night"
};

const reverseShiftMapping = {
  "morning": "6 AM - 2 PM",
  "evening": "2 PM - 10 PM",
  "night": "10 PM - 6 AM"
};

// ===================== REGISTER =====================
exports.register = async (req, res) => {
  try {
    console.log("🔔 /auth/register body:", req.body);

    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phone = String(req.body?.phone || "").trim();
    const password = String(req.body?.password || "");
    const userType = String(req.body?.userType || "").trim();
    const shiftTiming = String(req.body?.shiftTiming || "").trim();
    const flat_number = req.body?.flat_number ? String(req.body.flat_number).trim() : null;
    const block_name = req.body?.block_name ? String(req.body.block_name).trim() : null;

   

    if (!name || !email || !password || !userType) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (name.length < 2) {
      return res.status(400).json({ message: "Please provide a valid name" });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    if (phone && !phoneRegex.test(phone)) {
      return res.status(400).json({ message: "Please provide a valid 10-digit mobile number" });
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters and include letters and numbers",
      });
    }

    if (!allowedUserTypes.includes(userType)) {
      return res.status(400).json({ message: "Invalid user role selected" });
    }

    if (userType === "security" && !securityShifts.includes(shiftTiming)) {
      return res.status(400).json({ message: "Please select a valid shift timing for security staff" });
    }

    console.log("📌 Received shiftTiming:", shiftTiming);

    // Check if user already exists
    const [existing] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Map shift timing to database enum value
    const dbShiftTiming = userType === "security" ? shiftMapping[shiftTiming] : null;

    // Insert user
    const [userResult] = await db.query(
      `INSERT INTO users
        (user_type, email, password, full_name, phone, shift_timing)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userType,
        email,
        hash,
        name,
        phone || null,
        dbShiftTiming,
      ]
    );

    const newUserId = userResult.insertId;

    // Auto-create residents record if userType is resident
    if (userType === "resident") {
      // Generate resident ID like RES001, RES002 etc.
      const [countRows] = await db.query("SELECT COUNT(*) AS total FROM residents");
      const nextNum = (countRows[0].total + 1).toString().padStart(3, "0");
      const residentId = `RES${nextNum}`;

      await db.query(
        `INSERT INTO residents (resident_id, user_id, flat_number, block_name, address)
         VALUES (?, ?, ?, ?, NULL)`,
        [residentId, newUserId, flat_number, block_name]
      );

      console.log(`✅ Residents record created: ${residentId} for user ${newUserId} with flat ${flat_number}, block ${block_name}`);
    }

    return res.status(201).json({ message: "User registered" });
  } catch (err) {
    console.error("❌ Register error:", err);
    res.status(500).json({ message: "Server error during registration" });
  }
};

// ===================== LOGIN =====================
exports.login = async (req, res) => {
  try {
    console.log("🔑 /auth/login body:", req.body);

    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (!rows.length) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.user_type, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.user_type,
        phone: user.phone,
        shiftTiming: user.shift_timing ? reverseShiftMapping[user.shift_timing] : null,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
};
