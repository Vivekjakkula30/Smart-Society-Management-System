// server/routes/flats.js
const express = require("express");
const router = express.Router();
const db = require("../config/database");

// GET all flats
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, flat_number, block_name AS block FROM flats ORDER BY block_name, flat_number"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching flats:", error);
    res.status(500).json({ message: "Failed to fetch flats" });
  }
});

module.exports = router;