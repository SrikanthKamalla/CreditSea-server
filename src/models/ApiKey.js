const mongoose = require("mongoose");

const apiKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    permissions: [
      {
        type: String,
        enum: ["read", "write", "delete"],
      },
    ],
    rateLimit: {
      type: Number,
      default: 1000, // requests per hour
    },
    lastUsed: Date,
    expiresAt: Date,
  },
  {
    timestamps: true,
  }
);

apiKeySchema.index({ key: 1 });
apiKeySchema.index({ user: 1 });
apiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to check if API key is valid
apiKeySchema.methods.isValid = function () {
  return this.isActive && (!this.expiresAt || this.expiresAt > new Date());
};

module.exports = mongoose.model("ApiKey", apiKeySchema);
