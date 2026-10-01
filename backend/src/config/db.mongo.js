const mongoose = require("mongoose");

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/open-quiz";

const connectMongo = async () => {
  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB connected to: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

module.exports = connectMongo;
