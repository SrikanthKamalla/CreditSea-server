const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "user_login",
        "user_logout",
        "file_upload",
        "file_process",
        "report_view",
        "report_delete",
        "user_created",
        "user_updated",
      ],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    description: {
      type: String,
      required: true,
    },
    resource: {
      type: String, // e.g., 'CreditReport', 'User'
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    ipAddress: String,
    userAgent: String,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ user: 1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ createdAt: -1 });

// Static method to log actions
auditLogSchema.statics.log = function (data) {
  return this.create(data);
};

module.exports = mongoose.model("AuditLog", auditLogSchema);
