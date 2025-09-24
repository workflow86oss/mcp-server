#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { client } from "./client/client.gen.js";
import { version } from "../package.json";
import { registerWorkflowTools } from "./workflow-tools.js";
import { registerSessionTools } from "./session-tools.js";
import { registerTableTools } from "./table-tools.js";
import { registerTasksTools } from "./tasks-tools";
import { registerComponentTools } from "./component-tools";

// Polyfill ReadableStream if not available
if (typeof globalThis.ReadableStream === "undefined") {
  console.error("Polyfilling ReadableStream");
  const { ReadableStream } = require("node:stream/web");
  globalThis.ReadableStream = ReadableStream;
}
// Polyfill for web APIs in Node.js
if (typeof globalThis.fetch === "undefined") {
  console.error("Polyfilling fetch");
  const { fetch, Headers, Request, Response, FormData } = require("undici");
  globalThis.fetch = fetch;
  globalThis.Headers = Headers;
  globalThis.Request = Request;
  globalThis.Response = Response;
  globalThis.FormData = FormData;
}

const baseUrl = process.env.W86_DOMAIN ?? "https://rest.workflow86.com";

client.setConfig({
  baseUrl,
  headers: process.env.W86_HEADERS
    ? JSON.parse(process.env.W86_HEADERS)
    : {
        "x-api-key": process.env.W86_API_KEY,
      },
});

const server = new McpServer({
  name: "workflow86",
  version: version,
  capabilities: {
    resources: {},
    tools: {},
  },
});

registerWorkflowTools(server);
registerSessionTools(server);
registerTasksTools(server);
registerTableTools(server);
registerComponentTools(server);

async function main() {
  const apiKey = String(process.env.W86_API_KEY);
  const maskedApiKey = `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  console.error(
    `Workflow86 MCP Server started on stdio (Node.js version: ${process.version}, baseUrl: ${baseUrl}, apiKey: ${maskedApiKey})`,
  );

  if (!process.env.W86_API_KEY && !process.env.W86_HEADERS) {
    console.error("W86_API_KEY is not set");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
