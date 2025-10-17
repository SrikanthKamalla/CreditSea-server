const jwt = require("jsonwebtoken");

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET_KEY || "fallback_secret",
    {
      expiresIn: process.env.JWT_EXPIRY || "30d",
    }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET_KEY || "fallback_secret");
};

module.exports = {
  generateToken,
  verifyToken,
};
