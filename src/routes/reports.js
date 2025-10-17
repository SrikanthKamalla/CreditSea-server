const express = require("express");
const router = express.Router();
const {
  getAllReports,
  getReport,
  deleteReport,
  getReportBasicDetails,
  getReportSummary,
  getCreditAccounts,
  searchReports,
} = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");

// Protected routes
router.get("/", protect, getAllReports);
router.get("/search", protect, searchReports);
router.get("/:id", protect, getReport);
router.delete("/:id", protect, deleteReport);
router.get("/:id/basic-details", protect, getReportBasicDetails);
router.get("/:id/summary", protect, getReportSummary);
router.get("/:id/credit-accounts", protect, getCreditAccounts);

module.exports = router;
