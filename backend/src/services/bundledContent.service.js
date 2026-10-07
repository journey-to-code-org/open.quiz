const LessonModule = require("../models/LessonModule.model");
const { lessonImportSchema } = require("../validation/userValidation");
const { clearModuleCache } = require("../utils/content");
const introduction = require("../../../shared/content/examples/openquiz-introduction/openquiz-introduction.json");

async function ensureInstructionalContent() {
  const { error, value } = lessonImportSchema.validate(introduction, { abortEarly: false });
  if (error) throw new Error(error.details.map((detail) => detail.message).join("\n"));
  // Bundled character artwork is resolved by the module's content package, not a relative image URL.
  for (const character of value.characters) delete character.imagePath;
  await LessonModule.init();
  const result = await LessonModule.updateOne(
    { id: value.id },
    { $setOnInsert: value },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  if (result.upsertedCount) clearModuleCache(value.id);
}

module.exports = { ensureInstructionalContent };
