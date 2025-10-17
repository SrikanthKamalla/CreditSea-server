const express = require("express");
const router = express.Router();
const {
  uploadXML,
  getUploadStatus,
} = require("../controllers/uploadController");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

// Protected routes
router.post("/xml", protect, upload.single("xmlFile"), uploadXML);
router.get("/status/:id", protect, getUploadStatus);

module.exports = router;
