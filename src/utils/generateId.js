const generateReportId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `REP-${timestamp}-${random}`.toUpperCase();
};

module.exports = {
  generateReportId,
};
