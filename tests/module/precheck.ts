import { callTool } from "./test-utils";

module.exports = async () => {
  checkEnvVars();

  await callTool("list-workflows", {});
};

/**
 * Check that required environment variables are set for module tests
 */
function checkEnvVars() {
  const requiredVars = {
    W86_API_KEY: "Your Workflow86 API key",
    W86_DOMAIN: "Workflow86 API domain (e.g., https://rest.workflow86.com)",
  };

  let missingVars = [];
  let hasTestValues = [];

  for (const [varName, description] of Object.entries(requiredVars)) {
    const value = process.env[varName];

    if (!value) {
      missingVars.push({ name: varName, description });
    } else if (value.includes("test-") || value === "test-api-key") {
      hasTestValues.push({ name: varName, value, description });
    }
  }

  if (missingVars.length > 0 || hasTestValues.length > 0) {
    let errorMessage = "❌ Module test environment check throw new Errored\n";

    if (missingVars.length > 0) {
      errorMessage += "Missing required environment variables:";
      missingVars.forEach(({ name, description }) => {
        errorMessage += `  ${name}: ${description}\n`;
      });
      errorMessage += "\n";
    }

    if (hasTestValues.length > 0) {
      errorMessage += "Environment variables contain test/placeholder values:";
      hasTestValues.forEach(({ name, value, description }) => {
        errorMessage += `  ${name}="${value}" (${description})\n`;
      });
      errorMessage += "\n";
    }

    errorMessage += `To run module tests, set the required environment variables:
export W86_API_KEY="your-actual-api-key"';
export W86_DOMAIN="https://rest.workflow86.com"

Then run: npm run moduleTest`;

    throw new Error(errorMessage);
  }

  console.log("✅ Module test environment variables are configured");
}
