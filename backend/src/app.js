const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const passport = require("./config/passport.js");

// Middleware imports
const { authenticateUser: jwtMiddleware } = require("./middleware/jsonWebToken");
const errorHandlerMiddleware = require("./middleware/errorHandler");
const notFoundMiddleware = require("./middleware/notFound");
const { apiLimiter } = require("./middleware/rateLimiter");
const requireAdmin = require("./middleware/requireAdmin");

// Route imports
const healthRoutes = require("./routes/health.routes");
const adminRoutes = require("./routes/admin.routes");
const userRoutes = require("./routes/user.routes");
const oauthRoutes = require("./routes/oauth.routes");
const lessonRoutes = require("./routes/lesson.routes");
const lessonPublicRoutes = require("./routes/lessonPublic.routes");
const lessonImportRoutes = require("./routes/lessonImport.routes");
const contentAssetRoutes = require("./routes/contentAsset.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const leaderboardRoutes = require("./routes/leaderboard.routes");
const profileRoutes = require("./routes/profile.routes");
const quizRoutes = require("./routes/quiz.routes");
const quizPublicRoutes = require("./routes/quizPublic.routes");
const onboardingRoutes = require("./routes/onboarding.routes");

// Create Express app
const app = express();

// Utility Function to parse allowed origins from environment variables
const parseAllowedOrigins = () => {
  const configuredOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const fallbackOrigins = [
    process.env.CLIENT_URL,
    process.env.RENDER_EXTERNAL_URL,
    "http://localhost:5173",
  ].filter(Boolean);

  return [...new Set([...configuredOrigins, ...fallbackOrigins])];
};

// CORS Configuration
const allowedOrigins = parseAllowedOrigins();
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true,
  exposedHeaders: ["X-CSRF-TOKEN"],
};

// Configure Morgan based on environment
const morganConfig = process.env.NODE_ENV === "production" ? "combined" : "dev";

// Top-level middleware
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(morgan(morganConfig));
app.use(apiLimiter);
app.use(passport.initialize());

// Routes
app.use("/api/v1/auth", oauthRoutes);
app.use("/health", healthRoutes);
app.use(apiLimiter);
app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/lessons", lessonImportRoutes);
app.use("/api/v1/lessons", lessonPublicRoutes);
app.use("/api/v1/assets", contentAssetRoutes);
app.use("/api/v1/lessons", jwtMiddleware, lessonRoutes);
app.use("/api/v1/dashboard", jwtMiddleware, dashboardRoutes);
app.use("/api/v1/leaderboard", jwtMiddleware, leaderboardRoutes);
app.use("/api/v1/profile", jwtMiddleware, profileRoutes);
app.use("/api/v1/quizzes", quizPublicRoutes);
app.use("/api/v1/quizzes", jwtMiddleware, quizRoutes);
app.use("/api/v1/onboarding", onboardingRoutes);
app.use("/api/v1/admin", jwtMiddleware, requireAdmin, adminRoutes);
const frontendBuildPath = path.resolve(__dirname, "../../frontend/dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  app.get(/.*/, (req, res, next) => {
    if (
      req.path === "/api" ||
      req.path.startsWith("/api/") ||
      req.path === "/health" ||
      !req.accepts("html")
    ) {
      return next();
    }

    return res.sendFile(path.join(frontendBuildPath, "index.html"));
  });
} else if (process.env.NODE_ENV !== "production") {
  app.get("/", (req, res) => {
    res.redirect(process.env.CLIENT_URL || "http://localhost:5173");
  });
}

// Error Handling Middleware
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

module.exports = app;
