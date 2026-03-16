require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const repoRoutes = require("./routes/repo");
const commitsRoutes = require("./routes/commits");
const historyRoutes = require("./routes/history");
const analyzeRoutes = require("./routes/analyze");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Routes
app.use("/api/repo", repoRoutes);
app.use("/api/commits", commitsRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/analyze", analyzeRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve frontend for any non-API route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err.message);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🕰️  Codebase Time Machine running on http://localhost:${PORT}`);
});

module.exports = app;
