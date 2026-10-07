const { existsSync } = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const instanceId = process.argv[2];
if (!instanceId || !/^[a-z0-9-]+$/.test(instanceId)) {
  console.error("Usage: node scripts/runInstance.js <instance-id>");
  process.exit(1);
}

const repositoryRoot = path.resolve(__dirname, "..");
const instanceRoot = path.join(repositoryRoot, "instances", instanceId);
const settingsPath = path.join(instanceRoot, "settings.env");
const localEnvPath = path.join(instanceRoot, ".env");
if (!existsSync(settingsPath)) {
  console.error(`Instance settings not found: ${settingsPath}`);
  process.exit(1);
}

const childEnvironment = { ...process.env };
const instanceControlledKey =
  /^(MONGO_URI|PORT|CLIENT_URL|CORS_ORIGINS|DEFAULT_MODULE_ID|FROM_EMAIL|FROM_NAME|VITE_)/;
for (const key of Object.keys(childEnvironment)) {
  if (instanceControlledKey.test(key)) delete childEnvironment[key];
}

const dotenvArguments = [
  "-e",
  settingsPath,
  "-e",
  localEnvPath,
  "-e",
  path.join(repositoryRoot, ".env"),
  "--",
  "npm-run-all",
  "--parallel",
  "--race",
  "-l",
  "development:backend",
  "development:frontend",
];

const dotenvCli = path.join(
  repositoryRoot,
  "node_modules",
  "dotenv-cli",
  "cli.js",
);
const child = spawn(process.execPath, [dotenvCli, ...dotenvArguments], {
  cwd: repositoryRoot,
  env: childEnvironment,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  console.error(`Could not start instance '${instanceId}': ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exitCode = code ?? 1;
  }
});
