// server/config/jwt.js
// Central JWT configuration

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "your_super_secret_jwt_key_change_this_in_production_123";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
};







