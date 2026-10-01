require("dotenv").config();
// Ensure that JWT_SECRET is set in production
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.warn("JWT_SECRET must be set in production.");
  console.log("Exiting the application due to missing JWT_SECRET.");
  process.exit(1);
}
const { setServers } = require("node:dns");
const app = require("./src/app");
const connectMongo = require("./src/config/db.mongo.js");
const { startLeaderboardScheduler } = require("./src/jobs/leaderboardScheduler.js");

const PORT = process.env.PORT || 8080;

// Some developers cannot resolve a connection with MongoDB Atlas
// This is a workaround to set the DNS server to Cloudflare's public DNS
const setDNS = async (dns = "1.1.1.1") => {
  try {
    // Only enabled if the NODE_ENV is not set to "production" to avoid potential issues in production environments.
    process.env.NODE_ENV !== "production" && setServers([dns]);
  } catch (err) {
    console.error("Failed to set DNS servers:", err.message);
    process.exit(1);
  }
};

const startServer = async () => {
  await setDNS();
  await connectMongo().catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

  startLeaderboardScheduler();

  app.listen(PORT, () => {
    console.log(`open.quiz API listening on http://localhost:${PORT}`);
  });
};

if (process.env.NODE_ENV !== "test") {
  startServer();
}

module.exports = { startServer };
