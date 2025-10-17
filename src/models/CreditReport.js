const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  line1: String,
  line2: String,
  city: String,
  state: String,
  pincode: String,
  country: {
    type: String,
    default: "India",
  },
  type: {
    type: String,
    enum: ["current", "permanent", "office", "other"],
    default: "current",
  },
});

const creditAccountSchema = new mongoose.Schema({
  accountNumber: {
    type: String,
    required: true,
    trim: true,
  },
  accountType: {
    type: String,
    required: true,
    trim: true,
  },
  subscriberName: {
    type: String,
    required: true,
    trim: true,
  },
  portfolioType: String,
  openDate: Date,
  creditLimit: {
    type: Number,
    default: 0,
  },
  highestCredit: {
    type: Number,
    default: 0,
  },
  currentBalance: {
    type: Number,
    default: 0,
  },
  amountOverdue: {
    type: Number,
    default: 0,
  },
  accountStatus: {
    type: String,
    required: true,
  },
  paymentRating: String,
  paymentHistoryProfile: String,
  dateReported: Date,
  dateClosed: Date,
  currency: {
    type: String,
    default: "INR",
  },
  accountHolderType: String,
  address: addressSchema,
  // Additional fields from XML
  identificationNumber: String,
  termsDuration: String,
  termsFrequency: String,
  scheduledMonthlyPayment: Number,
  specialComment: String,
  originalChargeOffAmount: Number,
  dateOfFirstDelinquency: Date,
  dateOfLastPayment: Date,
  suitFiledWilfulDefault: String,
  writtenOffSettledStatus: String,
  valueOfCollateral: Number,
  typeOfCollateral: String,
  writtenOffAmountTotal: Number,
  writtenOffAmountPrincipal: Number,
  rateOfInterest: Number,
  repaymentTenure: Number,
  subscriberComments: String,
  consumerComments: String,
});

const accountHistorySchema = new mongoose.Schema({
  year: Number,
  month: Number,
  daysPastDue: Number,
  assetClassification: String,
});

const basicDetailsSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  mobilePhone: {
    type: String,
    trim: true,
  },
  pan: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  creditScore: {
    type: Number,
    min: 300,
    max: 900,
  },
  bureauScoreConfidLevel: String,
  dateOfBirth: Date,
  email: String,
  gender: String,
  // Additional identification details
  passportNumber: String,
  voterId: String,
  driverLicense: String,
  rationCard: String,
  universalId: String,
});

const reportSummarySchema = new mongoose.Schema({
  totalAccounts: {
    type: Number,
    default: 0,
  },
  activeAccounts: {
    type: Number,
    default: 0,
  },
  closedAccounts: {
    type: Number,
    default: 0,
  },
  defaultAccounts: {
    type: Number,
    default: 0,
  },
  currentBalance: {
    type: Number,
    default: 0,
  },
  securedAmount: {
    type: Number,
    default: 0,
  },
  unsecuredAmount: {
    type: Number,
    default: 0,
  },
  securedPercentage: Number,
  unsecuredPercentage: Number,
  last7DaysEnquiries: {
    type: Number,
    default: 0,
  },
  last30DaysEnquiries: {
    type: Number,
    default: 0,
  },
  last90DaysEnquiries: {
    type: Number,
    default: 0,
  },
  last180DaysEnquiries: {
    type: Number,
    default: 0,
  },
  // Additional summary fields
  creditAccountTotal: Number,
  creditAccountActive: Number,
  creditAccountDefault: Number,
  creditAccountClosed: Number,
  cadSuitFiledCurrentBalance: Number,
});

const creditReportSchema = new mongoose.Schema(
  {
    // Report identification
    reportId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    originalFileName: {
      type: String,
      required: true,
    },

    // User who uploaded the report
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Processing status
    processingStatus: {
      type: String,
      enum: ["uploaded", "processing", "processed", "failed"],
      default: "uploaded",
    },
    processingError: String,

    // XML source data (store for audit/reprocessing)
    xmlData: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Extracted data
    basicDetails: basicDetailsSchema,
    reportSummary: reportSummarySchema,
    creditAccounts: [creditAccountSchema],
    addresses: [addressSchema],

    // Account history (if needed for detailed analysis)
    accountHistories: [accountHistorySchema],

    // XML header information
    header: {
      systemCode: String,
      reportDate: Date,
      reportTime: String,
      messageText: String,
    },

    // Credit profile header
    creditProfileHeader: {
      enquiryUsername: String,
      reportDate: Date,
      reportTime: String,
      version: String,
      reportNumber: String,
      subscriberName: String,
    },

    // Match result
    matchResult: {
      exactMatch: {
        type: String,
        enum: ["Y", "N"],
      },
    },

    // File information
    fileSize: Number,
    mimeType: String,

    // Timestamps
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
creditReportSchema.index({ reportId: 1 });
creditReportSchema.index({ uploadedBy: 1 });
creditReportSchema.index({ "basicDetails.pan": 1 });
creditReportSchema.index({ "basicDetails.name": 1 });
creditReportSchema.index({ processingStatus: 1 });
creditReportSchema.index({ uploadedAt: -1 });
creditReportSchema.index({ "basicDetails.creditScore": -1 });

// Virtual for formatted report date
creditReportSchema.virtual("formattedReportDate").get(function () {
  return this.creditProfileHeader?.reportDate?.toLocaleDateString("en-IN");
});

// Method to check if report is processed
creditReportSchema.methods.isProcessed = function () {
  return this.processingStatus === "processed";
};

// Static method to get reports by PAN
creditReportSchema.statics.findByPAN = function (pan) {
  return this.find({ "basicDetails.pan": pan }).sort({ uploadedAt: -1 });
};

// Static method to get reports by user
creditReportSchema.statics.findByUser = function (userId) {
  return this.find({ uploadedBy: userId }).sort({ uploadedAt: -1 });
};

module.exports = mongoose.model("CreditReport", creditReportSchema);
