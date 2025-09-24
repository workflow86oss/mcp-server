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

let resolvedHeaders: any;
if (process.env.W86_HEADERS) {
  console.error("!!Using custom headers!!");
  resolvedHeaders = JSON.parse(process.env.W86_HEADERS);
} else {
  resolvedHeaders = {
    "x-api-key": process.env.W86_API_KEY,
  };
}
client.setConfig({
  baseUrl,
  headers: resolvedHeaders,
});

function getMaskedApiKey(): string {
  try {
    let key: string | undefined;
    if (resolvedHeaders) {
      if (resolvedHeaders instanceof Headers) {
        key = resolvedHeaders.get("x-api-key") ?? undefined;
        if (!key) {
          // fallback: scan all headers
          for (const [k, v] of (resolvedHeaders as Headers).entries()) {
            if (k.toLowerCase() === "x-api-key") {
              key = v;
              break;
            }
          }
        }
      } else if (typeof resolvedHeaders === "object") {
        for (const k of Object.keys(resolvedHeaders)) {
          if (k.toLowerCase() === "x-api-key") {
            key = String((resolvedHeaders as Record<string, unknown>)[k]);
            break;
          }
        }
      }
    }
    if (!key && process.env.W86_API_KEY) {
      key = String(process.env.W86_API_KEY);
    }
    if (!key) return "<none>";
    if (key.length <= 8) return `${key[0]}***${key[key.length - 1]}`;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  } catch {
    return "<unknown>";
  }
}

const server = new McpServer({
  name: "workflow86",
  version: version,
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Interceptor: log every tool invocation to stderr
function attachConsoleToolLoggingInterceptor(s: McpServer) {
  const originalTool = (s as any).tool.bind(s) as any;
  (s as any).tool = (name: string, ...rest: any[]) => {
    if (!rest || rest.length === 0) {
      return originalTool(name, ...rest);
    }
    const originalCb = rest[rest.length - 1];
    if (typeof originalCb !== "function") {
      return originalTool(name, ...rest);
    }
    const wrappedCb = async (...cbArgs: any[]) => {
      const start = Date.now();
      const extra = cbArgs.length === 2 ? cbArgs[1] : cbArgs[0];
      const args = cbArgs.length === 2 ? cbArgs[0] : undefined;
      // Always log to stderr to avoid corrupting stdio transport
      try {
        console.error(
          `[tool] start name=${name} apiKey=${getMaskedApiKey()}`,
          args ?? {},
        );
      } catch {}
      try {
        const result = await originalCb(...cbArgs);
        try {
          console.error(
            `[tool] success name=${name} durationMs=${Date.now() - start}`,
          );
        } catch {}
        return result;
      } catch (err) {
        try {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[tool] error name=${name} durationMs=${Date.now() - start}: ${msg}`,
          );
        } catch {}
        throw err;
      }
    };
    rest[rest.length - 1] = wrappedCb;
    return originalTool(name, ...rest);
  };
}

attachConsoleToolLoggingInterceptor(server);

registerWorkflowTools(server);
registerSessionTools(server);
registerTasksTools(server);
registerTableTools(server);
registerComponentTools(server);

async function main() {
  const maskedApiKey = getMaskedApiKey();
  console.error(
    `Workflow86 MCP Server started on stdio (package version: ${version}, Node.js version: ${process.version}, baseUrl: ${baseUrl}, apiKey: ${maskedApiKey})`,
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
