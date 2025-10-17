const multer = require("multer");
const path = require("path");

// Configure multer for file upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Check if file is XML
  if (file.mimetype === "text/xml" || file.mimetype === "application/xml") {
    cb(null, true);
  } else {
    cb(new Error("Only XML files are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter,
});

module.exports = upload;
