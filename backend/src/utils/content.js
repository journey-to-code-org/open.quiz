const LessonModule = require("../models/LessonModule.model");
const { isDemoMode } = require("../config/demoMode");

// The daily demo reset rewrites lessons from outside this process, so demo caches expire.
const DEMO_MODULE_CACHE_TTL_MS = 60 * 1000;

let moduleCache = new Map();

const getModule = async (moduleId) => {
  const cached = moduleCache.get(moduleId);
  if (cached && (!isDemoMode() || Date.now() - cached.cachedAt < DEMO_MODULE_CACHE_TTL_MS)) {
    return cached.data;
  }

  const moduleData = await LessonModule.findOne({ id: moduleId }).lean();
  if (moduleData) {
    moduleCache.set(moduleId, { data: moduleData, cachedAt: Date.now() });
  } else {
    moduleCache.delete(moduleId);
  }
  return moduleData;
};

const getDefaultModule = async () => {
  const configuredModuleId = process.env.DEFAULT_MODULE_ID?.trim();
  const query = configuredModuleId ? { id: configuredModuleId } : {};
  return LessonModule.findOne(query).sort({ id: 1 }).lean();
};

const getLesson = async (moduleId, lessonId) => {
  const moduleData = await getModule(moduleId);
  if (!moduleData) {
    return null;
  }
  return (moduleData.lessons || []).find((lesson) => lesson.id === lessonId) || null;
};

const clearCache = () => {
  moduleCache = new Map();
};

const clearModuleCache = (moduleId) => {
  moduleCache.delete(moduleId);
};

const sanitizeLessonData = (lessonData) => {
  const sanitizedLesson = JSON.parse(JSON.stringify(lessonData));

  for (const microLesson of sanitizedLesson.microLessons || []) {
    for (const contentItem of microLesson.microLessonContent || []) {
      if (contentItem.type === "knowledgeCheck") {
        delete contentItem.correctResponse;
        delete contentItem.explanation;
      }
    }
  }

  return sanitizedLesson;
};

const sanitizeModuleData = (moduleData) => ({
  ...moduleData,
  lessons: (moduleData.lessons || []).map(sanitizeLessonData),
});

module.exports = {
  getModule,
  getDefaultModule,
  getLesson,
  sanitizeLessonData,
  sanitizeModuleData,
  clearCache,
  clearModuleCache,
  DEMO_MODULE_CACHE_TTL_MS,
};
