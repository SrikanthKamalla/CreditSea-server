const express = require("express");
const router = express.Router();

// Import route modules
const authRoutes = require("./auth");
const uploadRoutes = require("./upload");
const reportRoutes = require("./reports");

// Define routes
router.use("/auth", authRoutes);
router.use("/upload", uploadRoutes);
router.use("/reports", reportRoutes);

// Health check route
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler for API routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not foundddd",
  });
});

module.exports = router;
