require("dotenv").config();
const express = require("express");
const rateLimit = require("express-rate-limit");
const cors = require("cors");

const routes = require("./src/routes/index.js");
const connectDB = require("./src/configs/mongoose.js");

const app = express();
const PORT = process.env.PORT || 8000;

connectDB().then(() => console.log("✅ MongoDB Connected Successfully"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10000,
  message: "Too many requests, please try again later.",
});

app.get("/", (req, res) => {
  res.send("API is working!");
});

app.use("/api", limiter, routes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on the host: http://localhost:${PORT}`);
});
