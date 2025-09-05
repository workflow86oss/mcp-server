import { callTool } from "./test-utils";

module.exports = async () => {
  checkEnvVars();

  await callTool("list-workflows", {});
  console.log("✅ Project Service is contactable");
};

/**
 * Check that required environment variables are set for module tests
 */
function checkEnvVars() {
  const w86ApiKey = process.env.W86_API_KEY;
  const w86Headers = process.env.W86_HEADERS;
  const w86Domain = process.env.W86_DOMAIN;

  // Check that either W86_API_KEY or W86_HEADERS is provided
  if (!w86ApiKey && !w86Headers) {
    throw new Error(`❌ Module test environment check failed

Either W86_API_KEY or W86_HEADERS is required:
  W86_API_KEY: Your Workflow86 API key
  W86_HEADERS: Your Workflow86 headers (JSON format)

Also required:
  W86_DOMAIN: Workflow86 API domain (e.g., https://rest.workflow86.com)

Set the required environment variables:
export W86_API_KEY="your-actual-api-key"
# OR
export W86_HEADERS='{"Authorization": "Bearer your-token"}'
export W86_DOMAIN="https://rest.workflow86.com"

Then run: npm run moduleTest`);
  }

  // Check for required W86_DOMAIN
  if (!w86Domain) {
    throw new Error(`❌ Module test environment check failed

Missing required environment variable:
  W86_DOMAIN: Workflow86 API domain (e.g., https://rest.workflow86.com)

Set the required environment variables:
export W86_DOMAIN="https://rest.workflow86.com"

Then run: npm run moduleTest`);
  }

  // Check for test/placeholder values
  let hasTestValues = [];

  if (
    w86ApiKey &&
    (w86ApiKey.includes("test-") || w86ApiKey === "test-api-key")
  ) {
    hasTestValues.push({ name: "W86_API_KEY", value: w86ApiKey });
  }

  if (w86Headers && w86Headers.includes("test-")) {
    hasTestValues.push({ name: "W86_HEADERS", value: w86Headers });
  }

  if (w86Domain && w86Domain.includes("test-")) {
    hasTestValues.push({ name: "W86_DOMAIN", value: w86Domain });
  }

  if (hasTestValues.length > 0) {
    let errorMessage =
      "❌ Environment variables contain test/placeholder values:\n";
    hasTestValues.forEach(({ name, value }) => {
      errorMessage += `  ${name}="${value}"\n`;
    });
    errorMessage += "\nPlease set actual values instead of test placeholders.";
    throw new Error(errorMessage);
  }

  console.log("\n✅ Module test environment variables are configured");
}
