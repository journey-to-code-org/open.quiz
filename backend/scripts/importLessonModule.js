const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");
const connectMongo = require("../src/config/db.mongo");
const LessonModule = require("../src/models/LessonModule.model");
const { lessonImportSchema } = require("../src/validation/userValidation");

async function importLessonModule() {
  const contentPath = process.argv[2];
  if (!contentPath) {
    throw new Error("Usage: node backend/scripts/importLessonModule.js <module.json>");
  }

  const moduleData = JSON.parse(await fs.readFile(path.resolve(contentPath), "utf8"));
  const { error, value } = lessonImportSchema.validate(moduleData, { abortEarly: false });
  if (error) {
    throw new Error(error.details.map((detail) => detail.message).join("\n"));
  }

  await connectMongo();
  await LessonModule.findOneAndUpdate(
    { id: value.id },
    { $set: value },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  console.log(`Imported lesson module '${value.id}'.`);
}

importLessonModule()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });