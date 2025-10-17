const CreditReport = require("../models/CreditReport");
const { parseXML } = require("../utils/xmlParser");
const { generateReportId } = require("../utils/generateId");
const AuditLog = require("../models/AuditLog");

// @desc    Upload and process XML file
// @route   POST /api/upload/xml
// @access  Private
const uploadXML = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No XML file uploaded",
      });
    }

    // Check file type
    if (
      req.file.mimetype !== "text/xml" &&
      req.file.mimetype !== "application/xml"
    ) {
      return res.status(400).json({
        success: false,
        message: "File must be XML format",
      });
    }

    // Create initial report record
    const reportId = generateReportId();
    const creditReport = new CreditReport({
      reportId,
      fileName: req.file.originalname,
      originalFileName: req.file.originalname,
      uploadedBy: req.user._id,
      processingStatus: "uploaded",
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    await creditReport.save();

    // Process XML asynchronously
    processXMLAsync(req.file.buffer, creditReport._id, req.user._id);

    // Log the action
    await AuditLog.log({
      action: "file_upload",
      user: req.user._id,
      description: `User uploaded XML file: ${req.file.originalname}`,
      resource: "CreditReport",
      resourceId: creditReport._id,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      metadata: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        reportId,
      },
    });

    res.status(202).json({
      success: true,
      message: "File uploaded successfully. Processing started.",
      data: {
        reportId: creditReport._id,
        uploadId: reportId,
        status: "processing",
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading file",
      error: error.message,
    });
  }
};

// @desc    Get upload status
// @route   GET /api/upload/status/:id
// @access  Private
const getUploadStatus = async (req, res) => {
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

    res.json({
      success: true,
      data: {
        reportId: report._id,
        status: report.processingStatus,
        fileName: report.fileName,
        uploadedAt: report.uploadedAt,
        processedAt: report.processedAt,
        error: report.processingError,
      },
    });
  } catch (error) {
    console.error("Get upload status error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching upload status",
      error: error.message,
    });
  }
};

// Helper function to process XML asynchronously
const processXMLAsync = async (fileBuffer, reportId, userId) => {
  try {
    const creditReport = await CreditReport.findById(reportId);

    if (!creditReport) {
      throw new Error("Report not found");
    }

    // Update status to processing
    creditReport.processingStatus = "processing";
    await creditReport.save();

    // console.log(`Starting XML processing for report: ${reportId}`);

    // Parse XML
    const xmlData = await parseXML(fileBuffer);

    // Extract and transform data
    const extractedData = extractDataFromXML(xmlData);
    // console.log("Data extracted successfully:", {
    //   name: extractedData.basicDetails.name,
    //   pan: extractedData.basicDetails.pan,
    //   accounts: extractedData.creditAccounts.length,
    // });

    // Update report with extracted data
    creditReport.basicDetails = extractedData.basicDetails;
    creditReport.reportSummary = extractedData.reportSummary;
    creditReport.creditAccounts = extractedData.creditAccounts;
    creditReport.addresses = extractedData.addresses;
    creditReport.xmlData = xmlData; // Store raw XML data
    creditReport.header = extractedData.header;
    creditReport.creditProfileHeader = extractedData.creditProfileHeader;
    creditReport.matchResult = extractedData.matchResult;
    creditReport.processingStatus = "processed";
    creditReport.processedAt = new Date();

    await creditReport.save();

    // Log successful processing
    await AuditLog.log({
      action: "file_process",
      user: userId,
      description: `XML file processed successfully: ${creditReport.fileName}`,
      resource: "CreditReport",
      resourceId: creditReport._id,
      metadata: {
        reportId: creditReport.reportId,
        accountsProcessed: extractedData.creditAccounts.length,
        pan: extractedData.basicDetails.pan,
      },
    });

    // console.log(`Report ${creditReport.reportId} processed successfully`);
  } catch (error) {
    console.error("XML processing error:", error);

    // Update report with error
    await CreditReport.findByIdAndUpdate(reportId, {
      processingStatus: "failed",
      processingError: error.message,
    });

    // Log processing failure
    await AuditLog.log({
      action: "file_process",
      user: userId,
      description: `XML file processing failed: ${error.message}`,
      resource: "CreditReport",
      resourceId: reportId,
      metadata: {
        error: error.message,
        fileName: (await CreditReport.findById(reportId))?.fileName,
      },
    });
  }
};

// Helper function to extract data from XML
const extractDataFromXML = (xmlData) => {
  try {
    const profile = xmlData.INProfileResponse;

    // Extract basic details - improved logic to find PAN
    const basicDetails = extractBasicDetails(profile);

    // Extract report summary
    const reportSummary = extractReportSummary(profile);

    // Extract credit accounts
    const creditAccounts = extractCreditAccounts(profile);

    // Extract addresses
    const addresses = extractAddresses(profile);

    // Extract header information
    const header = extractHeaderInfo(profile);

    // Extract credit profile header
    const creditProfileHeader = extractCreditProfileHeader(profile);

    // Extract match result
    const matchResult = extractMatchResult(profile);

    return {
      basicDetails,
      reportSummary,
      creditAccounts,
      addresses,
      header,
      creditProfileHeader,
      matchResult,
    };
  } catch (error) {
    console.error("Error in extractDataFromXML:", error);
    throw new Error(`Failed to extract data from XML: ${error.message}`);
  }
};

// Improved basic details extraction
const extractBasicDetails = (profile) => {
  let pan = "";
  let name = "";
  let mobilePhone = "";
  let dateOfBirth = null;
  let creditScore = null;

  // Try to get PAN from multiple possible locations
  if (profile.CAIS_Account?.CAIS_Account_DETAILS) {
    const accounts = Array.isArray(profile.CAIS_Account.CAIS_Account_DETAILS)
      ? profile.CAIS_Account.CAIS_Account_DETAILS
      : [profile.CAIS_Account.CAIS_Account_DETAILS];

    for (const account of accounts) {
      if (account.CAIS_Holder_Details?.Income_TAX_PAN) {
        pan = account.CAIS_Holder_Details.Income_TAX_PAN;
        break;
      }
      if (account.CAIS_Holder_ID_Details) {
        const idDetails = Array.isArray(account.CAIS_Holder_ID_Details)
          ? account.CAIS_Holder_ID_Details
          : [account.CAIS_Holder_ID_Details];

        for (const idDetail of idDetails) {
          if (idDetail.Income_TAX_PAN) {
            pan = idDetail.Income_TAX_PAN;
            break;
          }
        }
        if (pan) break;
      }
    }
  }

  // Get name from CAIS_Holder_Details
  if (profile.CAIS_Account?.CAIS_Account_DETAILS) {
    const accounts = Array.isArray(profile.CAIS_Account.CAIS_Account_DETAILS)
      ? profile.CAIS_Account.CAIS_Account_DETAILS
      : [profile.CAIS_Account.CAIS_Account_DETAILS];

    const firstAccount = accounts[0];
    if (firstAccount.CAIS_Holder_Details) {
      const holder = firstAccount.CAIS_Holder_Details;
      name = `${holder.First_Name_Non_Normalized || ""} ${
        holder.Surname_Non_Normalized || ""
      }`.trim();

      if (holder.Date_of_birth) {
        dateOfBirth = parseDate(holder.Date_of_birth);
      }
    }
  }

  // If name not found in CAIS, try Current_Application
  if (
    !name &&
    profile.Current_Application?.Current_Application_Details
      ?.Current_Applicant_Details
  ) {
    const applicant =
      profile.Current_Application.Current_Application_Details
        .Current_Applicant_Details;
    name = `${applicant.First_Name || ""} ${applicant.Last_Name || ""}`.trim();
    mobilePhone = applicant.MobilePhoneNumber || "";

    if (
      applicant.Date_Of_Birth_Applicant &&
      applicant.Date_Of_Birth_Applicant !== "00010201"
    ) {
      dateOfBirth = parseDate(applicant.Date_Of_Birth_Applicant);
    }
  }

  // Get mobile phone from CAIS if not found in Current_Application
  if (!mobilePhone && profile.CAIS_Account?.CAIS_Account_DETAILS) {
    const accounts = Array.isArray(profile.CAIS_Account.CAIS_Account_DETAILS)
      ? profile.CAIS_Account.CAIS_Account_DETAILS
      : [profile.CAIS_Account.CAIS_Account_DETAILS];

    const firstAccount = accounts[0];
    if (firstAccount.CAIS_Holder_Phone_Details?.Telephone_Number) {
      mobilePhone = firstAccount.CAIS_Holder_Phone_Details.Telephone_Number;
    }
  }

  // Get credit score
  if (profile.SCORE?.BureauScore) {
    creditScore = parseInt(profile.SCORE.BureauScore);
  }

  // If PAN is still empty, throw error
  if (!pan) {
    throw new Error("PAN number not found in XML file");
  }

  return {
    name: name || "N/A",
    mobilePhone: mobilePhone || "N/A",
    pan: pan,
    creditScore: creditScore,
    bureauScoreConfidLevel: profile.SCORE?.BureauScoreConfidLevel,
    dateOfBirth: dateOfBirth,
  };
};

// Extract report summary
const extractReportSummary = (profile) => {
  const caisSummary = profile.CAIS_Account?.CAIS_Summary;
  const totalCAPS = profile.TotalCAPS_Summary;

  return {
    totalAccounts: caisSummary?.Credit_Account?.CreditAccountTotal
      ? parseInt(caisSummary.Credit_Account.CreditAccountTotal)
      : 0,
    activeAccounts: caisSummary?.Credit_Account?.CreditAccountActive
      ? parseInt(caisSummary.Credit_Account.CreditAccountActive)
      : 0,
    closedAccounts: caisSummary?.Credit_Account?.CreditAccountClosed
      ? parseInt(caisSummary.Credit_Account.CreditAccountClosed)
      : 0,
    defaultAccounts: caisSummary?.Credit_Account?.CreditAccountDefault
      ? parseInt(caisSummary.Credit_Account.CreditAccountDefault)
      : 0,
    currentBalance: caisSummary?.Total_Outstanding_Balance
      ?.Outstanding_Balance_All
      ? parseInt(caisSummary.Total_Outstanding_Balance.Outstanding_Balance_All)
      : 0,
    securedAmount: caisSummary?.Total_Outstanding_Balance
      ?.Outstanding_Balance_Secured
      ? parseInt(
          caisSummary.Total_Outstanding_Balance.Outstanding_Balance_Secured
        )
      : 0,
    unsecuredAmount: caisSummary?.Total_Outstanding_Balance
      ?.Outstanding_Balance_UnSecured
      ? parseInt(
          caisSummary.Total_Outstanding_Balance.Outstanding_Balance_UnSecured
        )
      : 0,
    securedPercentage: caisSummary?.Total_Outstanding_Balance
      ?.Outstanding_Balance_Secured_Percentage
      ? parseInt(
          caisSummary.Total_Outstanding_Balance
            .Outstanding_Balance_Secured_Percentage
        )
      : 0,
    unsecuredPercentage: caisSummary?.Total_Outstanding_Balance
      ?.Outstanding_Balance_UnSecured_Percentage
      ? parseInt(
          caisSummary.Total_Outstanding_Balance
            .Outstanding_Balance_UnSecured_Percentage
        )
      : 0,
    last7DaysEnquiries: totalCAPS?.TotalCAPSLast7Days
      ? parseInt(totalCAPS.TotalCAPSLast7Days)
      : 0,
    last30DaysEnquiries: totalCAPS?.TotalCAPSLast30Days
      ? parseInt(totalCAPS.TotalCAPSLast30Days)
      : 0,
    last90DaysEnquiries: totalCAPS?.TotalCAPSLast90Days
      ? parseInt(totalCAPS.TotalCAPSLast90Days)
      : 0,
    last180DaysEnquiries: totalCAPS?.TotalCAPSLast180Days
      ? parseInt(totalCAPS.TotalCAPSLast180Days)
      : 0,
    creditAccountTotal: caisSummary?.Credit_Account?.CreditAccountTotal
      ? parseInt(caisSummary.Credit_Account.CreditAccountTotal)
      : 0,
    creditAccountActive: caisSummary?.Credit_Account?.CreditAccountActive
      ? parseInt(caisSummary.Credit_Account.CreditAccountActive)
      : 0,
    creditAccountDefault: caisSummary?.Credit_Account?.CreditAccountDefault
      ? parseInt(caisSummary.Credit_Account.CreditAccountDefault)
      : 0,
    creditAccountClosed: caisSummary?.Credit_Account?.CreditAccountClosed
      ? parseInt(caisSummary.Credit_Account.CreditAccountClosed)
      : 0,
    cadSuitFiledCurrentBalance: caisSummary?.Credit_Account
      ?.CADSuitFiledCurrentBalance
      ? parseInt(caisSummary.Credit_Account.CADSuitFiledCurrentBalance)
      : 0,
  };
};

// Extract credit accounts
const extractCreditAccounts = (profile) => {
  const creditAccounts = [];

  if (!profile.CAIS_Account?.CAIS_Account_DETAILS) {
    return creditAccounts;
  }

  const accounts = Array.isArray(profile.CAIS_Account.CAIS_Account_DETAILS)
    ? profile.CAIS_Account.CAIS_Account_DETAILS
    : [profile.CAIS_Account.CAIS_Account_DETAILS];

  accounts.forEach((account) => {
    // Extract address from account if available
    let address = null;
    if (account.CAIS_Holder_Address_Details) {
      address = {
        line1:
          account.CAIS_Holder_Address_Details
            .First_Line_Of_Address_non_normalized || "",
        line2:
          account.CAIS_Holder_Address_Details
            .Second_Line_Of_Address_non_normalized || "",
        city: account.CAIS_Holder_Address_Details.City_non_normalized || "",
        state: account.CAIS_Holder_Address_Details.State_non_normalized || "",
        pincode:
          account.CAIS_Holder_Address_Details.ZIP_Postal_Code_non_normalized ||
          "",
        country:
          account.CAIS_Holder_Address_Details.CountryCode_non_normalized ||
          "IB",
      };
    }

    creditAccounts.push({
      accountNumber: account.Account_Number || "N/A",
      accountType: mapAccountType(account.Account_Type),
      subscriberName: (account.Subscriber_Name || "").trim() || "N/A",
      portfolioType: account.Portfolio_Type,
      openDate: parseDate(account.Open_Date),
      creditLimit: account.Credit_Limit_Amount
        ? parseInt(account.Credit_Limit_Amount)
        : 0,
      highestCredit: account.Highest_Credit_or_Original_Loan_Amount
        ? parseInt(account.Highest_Credit_or_Original_Loan_Amount)
        : 0,
      currentBalance: account.Current_Balance
        ? parseInt(account.Current_Balance)
        : 0,
      amountOverdue: account.Amount_Past_Due
        ? parseInt(account.Amount_Past_Due)
        : 0,
      accountStatus: mapAccountStatus(account.Account_Status),
      paymentRating: account.Payment_Rating,
      paymentHistoryProfile: account.Payment_History_Profile,
      dateReported: parseDate(account.Date_Reported),
      dateClosed: parseDate(account.Date_Closed),
      currency: account.CurrencyCode || "INR",
      accountHolderType: account.AccountHoldertypeCode,
      address: address,
      identificationNumber: account.Identification_Number,
      termsDuration: account.Terms_Duration,
      termsFrequency: account.Terms_Frequency,
      scheduledMonthlyPayment: account.Scheduled_Monthly_Payment_Amount
        ? parseInt(account.Scheduled_Monthly_Payment_Amount)
        : 0,
      specialComment: account.Special_Comment,
      originalChargeOffAmount: account.Original_Charge_Off_Amount
        ? parseInt(account.Original_Charge_Off_Amount)
        : 0,
      dateOfFirstDelinquency: parseDate(account.Date_of_First_Delinquency),
      dateOfLastPayment: parseDate(account.Date_of_Last_Payment),
      suitFiledWilfulDefault: account.SuitFiled_WilfulDefault,
      writtenOffSettledStatus: account.Written_off_Settled_Status,
      valueOfCollateral: account.Value_of_Collateral
        ? parseInt(account.Value_of_Collateral)
        : 0,
      typeOfCollateral: account.Type_of_Collateral,
      writtenOffAmountTotal: account.Written_Off_Amt_Total
        ? parseInt(account.Written_Off_Amt_Total)
        : 0,
      writtenOffAmountPrincipal: account.Written_Off_Amt_Principal
        ? parseInt(account.Written_Off_Amt_Principal)
        : 0,
      rateOfInterest: account.Rate_of_Interest
        ? parseFloat(account.Rate_of_Interest)
        : 0,
      repaymentTenure: account.Repayment_Tenure
        ? parseInt(account.Repayment_Tenure)
        : 0,
      subscriberComments: account.Subscriber_comments,
      consumerComments: account.Consumer_comments,
    });
  });

  return creditAccounts;
};

// Extract addresses
const extractAddresses = (profile) => {
  const addresses = [];

  if (profile.CAIS_Account?.CAIS_Account_DETAILS) {
    const accounts = Array.isArray(profile.CAIS_Account.CAIS_Account_DETAILS)
      ? profile.CAIS_Account.CAIS_Account_DETAILS
      : [profile.CAIS_Account.CAIS_Account_DETAILS];

    accounts.forEach((account) => {
      if (account.CAIS_Holder_Address_Details) {
        const addr = account.CAIS_Holder_Address_Details;
        addresses.push({
          line1: addr.First_Line_Of_Address_non_normalized || "",
          line2: addr.Second_Line_Of_Address_non_normalized || "",
          city: addr.City_non_normalized || "",
          state: addr.State_non_normalized || "",
          pincode: addr.ZIP_Postal_Code_non_normalized || "",
          country: addr.CountryCode_non_normalized || "IB",
          type: "current",
        });
      }
    });
  }

  // Remove duplicates based on address lines
  const uniqueAddresses = addresses.filter(
    (addr, index, self) =>
      index ===
      self.findIndex(
        (a) =>
          a.line1 === addr.line1 &&
          a.line2 === addr.line2 &&
          a.city === addr.city
      )
  );

  return uniqueAddresses;
};

// Extract header information
const extractHeaderInfo = (profile) => {
  return {
    systemCode: profile.Header?.SystemCode,
    reportDate: parseDate(profile.Header?.ReportDate),
    reportTime: profile.Header?.ReportTime,
    messageText: profile.Header?.MessageText,
  };
};

// Extract credit profile header
const extractCreditProfileHeader = (profile) => {
  return {
    enquiryUsername: profile.CreditProfileHeader?.Enquiry_Username,
    reportDate: parseDate(profile.CreditProfileHeader?.ReportDate),
    reportTime: profile.CreditProfileHeader?.ReportTime,
    version: profile.CreditProfileHeader?.Version,
    reportNumber: profile.CreditProfileHeader?.ReportNumber,
    subscriberName: profile.CreditProfileHeader?.Subscriber_Name,
  };
};

// Extract match result
const extractMatchResult = (profile) => {
  return {
    exactMatch: profile.Match_result?.Exact_match || "N",
  };
};

// Improved helper functions for data mapping
const mapAccountType = (typeCode) => {
  const types = {
    10: "Credit Card",
    51: "Home Loan",
    52: "Personal Loan",
    53: "Auto Loan",
    71: "Business Loan",
  };
  return types[typeCode] || "Other Credit Facility";
};

const mapAccountStatus = (statusCode) => {
  const statuses = {
    11: "active",
    13: "closed",
    53: "default",
    71: "delinquent",
  };
  return statuses[statusCode] || "unknown";
};

const parseDate = (dateString) => {
  if (!dateString || dateString.length < 8) return null;

  try {
    // Handle different date formats
    if (dateString.length === 8) {
      // YYYYMMDD format
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      return new Date(`${year}-${month}-${day}`);
    } else if (dateString.length === 10) {
      // Already in YYYY-MM-DD format or similar
      return new Date(dateString);
    }
    return null;
  } catch (error) {
    console.error("Error parsing date:", dateString, error);
    return null;
  }
};

module.exports = {
  uploadXML,
  getUploadStatus,
};
