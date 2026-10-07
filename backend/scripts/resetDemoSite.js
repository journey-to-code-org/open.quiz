const mongoose = require("mongoose");
const { resetDemoSite } = require("../src/services/demoReset.service");

const CONFIRMATION = "reset-demo-site";

async function main() {
  if (process.env.DEMO_RESET_CONFIRM !== CONFIRMATION) {
    throw new Error(
      `Refusing to reset the demo. Set DEMO_RESET_CONFIRM=${CONFIRMATION} to confirm this demo reset.`,
    );
  }
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is required for the demo reset.");
  }

  // Connect directly so the connection host is never printed to CI logs.
  await mongoose.connect(mongoUri);
  const deleted = await resetDemoSite();
  for (const [name, count] of Object.entries(deleted)) {
    console.log(`${name}: deleted ${count}`);
  }
  console.log(
    "Demo reset complete: accounts cleared and starter content restored. The next verified login becomes an admin.",
  );
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
