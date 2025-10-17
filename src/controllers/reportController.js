const CreditReport = require("../models/CreditReport");
const AuditLog = require("../models/AuditLog");

// @desc    Get all reports for user
// @route   GET /api/reports
// @access  Private
const getAllReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reports = await CreditReport.find({ uploadedBy: req.user._id })
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-xmlData -accountHistories"); // Exclude large fields

    const total = await CreditReport.countDocuments({
      uploadedBy: req.user._id,
    });

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get all reports error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching reports",
      error: error.message,
    });
  }
};

// @desc    Get single report
// @route   GET /api/reports/:id
// @access  Private
const getReport = async (req, res) => {
  try {
    const report = await CreditReport.findOne({
      _id: req.params.id,
      uploadedBy: req.user._id,
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Log report view
    await AuditLog.log({
      action: "report_view",
      user: req.user._id,
      description: `User viewed report: ${report.reportId}`,
      resource: "CreditReport",
      resourceId: report._id,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.json({
      success: true,
      data: { report },
    });
  } catch (error) {
    console.error("Get report error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching report",
      error: error.message,
    });
  }
};

// @desc    Delete report
// @route   DELETE /api/reports/:id
// @access  Private
const deleteReport = async (req, res) => {
  try {
    const report = await CreditReport.findOne({
      _id: req.params.id,
      uploadedBy: req.user._id,
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    await CreditReport.findByIdAndDelete(req.params.id);

    // Log deletion
    await AuditLog.log({
      action: "report_delete",
      user: req.user._id,
      description: `User deleted report: ${report.reportId}`,
      resource: "CreditReport",
      resourceId: report._id,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    console.error("Delete report error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting report",
      error: error.message,
    });
  }
};

// @desc    Get report basic details
// @route   GET /api/reports/:id/basic-details
// @access  Private
const getReportBasicDetails = async (req, res) => {
  try {
    const report = await CreditReport.findOne({
      _id: req.params.id,
      uploadedBy: req.user._id,
    }).select("basicDetails reportId fileName uploadedAt");

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    res.json({
      success: true,
      data: {
        basicDetails: report.basicDetails,
        reportId: report.reportId,
        fileName: report.fileName,
        uploadedAt: report.uploadedAt,
      },
    });
  } catch (error) {
    console.error("Get basic details error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching basic details",
      error: error.message,
    });
  }
};

// @desc    Get report summary
// @route   GET /api/reports/:id/summary
// @access  Private
const getReportSummary = async (req, res) => {
  try {
    const report = await CreditReport.findOne({
      _id: req.params.id,
      uploadedBy: req.user._id,
    }).select("reportSummary reportId fileName");

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    res.json({
      success: true,
      data: {
        summary: report.reportSummary,
        reportId: report.reportId,
        fileName: report.fileName,
      },
    });
  } catch (error) {
    console.error("Get report summary error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching report summary",
      error: error.message,
    });
  }
};

// @desc    Get credit accounts
// @route   GET /api/reports/:id/credit-accounts
// @access  Private
const getCreditAccounts = async (req, res) => {
  try {
    const report = await CreditReport.findOne({
      _id: req.params.id,
      uploadedBy: req.user._id,
    }).select("creditAccounts reportId fileName");

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    res.json({
      success: true,
      data: {
        creditAccounts: report.creditAccounts,
        reportId: report.reportId,
        fileName: report.fileName,
        totalAccounts: report.creditAccounts.length,
      },
    });
  } catch (error) {
    console.error("Get credit accounts error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching credit accounts",
      error: error.message,
    });
  }
};

// @desc    Search reports
// @route   GET /api/reports/search
// @access  Private
const searchReports = async (req, res) => {
  try {
    const { q: searchTerm, page = 1, limit = 10 } = req.query;

    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: "Search term is required",
      });
    }

    const skip = (page - 1) * limit;

    const searchQuery = {
      uploadedBy: req.user._id,
      $or: [
        { "basicDetails.name": { $regex: searchTerm, $options: "i" } },
        { "basicDetails.pan": { $regex: searchTerm, $options: "i" } },
        { "basicDetails.mobilePhone": { $regex: searchTerm, $options: "i" } },
        { fileName: { $regex: searchTerm, $options: "i" } },
        { reportId: { $regex: searchTerm, $options: "i" } },
      ],
    };

    const reports = await CreditReport.find(searchQuery)
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("-xmlData -accountHistories");

    const total = await CreditReport.countDocuments(searchQuery);

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
        searchTerm,
      },
    });
  } catch (error) {
    console.error("Search reports error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching reports",
      error: error.message,
    });
  }
};

module.exports = {
  getAllReports,
  getReport,
  deleteReport,
  getReportBasicDetails,
  getReportSummary,
  getCreditAccounts,
  searchReports,
};
