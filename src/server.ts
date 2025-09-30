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
import { getMaskedSecret } from "./util.js";

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

// Normalize empty/opaque API errors into useful messages for clients
try {
  client.interceptors.error.use(
    (error: unknown, response: Response, request: Request) => {
      const status = response?.status;
      const statusText = response?.statusText || "";
      let path = "";
      try {
        path = new URL(request.url).pathname;
      } catch {}

      const hasMeaning =
        (typeof error === "string" && error.trim().length > 0) ||
        (error &&
          typeof error === "object" &&
          Object.keys(error as any).length > 0);

      if (!hasMeaning) {
        let hint = "";
        if (status === 401 || status === 403) {
          hint = " - Unauthorized: missing or invalid API key";
        } else if (status === 404) {
          hint = " - Not found";
        } else if (status === 429) {
          hint = " - Rate limited";
        }
        return `HTTP ${status} ${statusText} from ${path || "/"} (empty body)${hint}`.trim();
      }

      if (error && typeof error === "object") {
        try {
          return JSON.stringify(error);
        } catch {
          return String(error);
        }
      }
      return String(error ?? "Unknown error");
    },
  );
} catch {}

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
          `[tool] start name=${name} apiKey=${getMaskedSecret(resolvedHeaders, process.env.W86_API_KEY, "x-api-key")}`,
          args ?? {},
        );
      } catch (logErr) {
        console.warn(`[tool] warn: failed to log start for ${name}:`, logErr);
      }
      try {
        const result = await originalCb(...cbArgs);
        try {
          console.error(
            `[tool] success name=${name} durationMs=${Date.now() - start}`,
          );
        } catch (logErr) {
          console.warn(
            `[tool] warn: failed to log success for ${name}:`,
            logErr,
          );
        }
        return result;
      } catch (err) {
        try {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[tool] error name=${name} durationMs=${Date.now() - start}: ${msg}`,
          );
        } catch (logErr) {
          console.warn(`[tool] warn: failed to log error for ${name}:`, logErr);
        }
        throw err;
      }
    };
    rest[rest.length - 1] = wrappedCb;
    return originalTool(name, ...rest);
  };
}

attachConsoleToolLoggingInterceptor(server);

// Interceptor: block tool invocation when no auth is configured
function attachAuthGuardInterceptor(s: McpServer) {
  const originalTool = (s as any).tool.bind(s) as any;
  (s as any).tool = (name: string, ...rest: any[]) => {
    if (!rest || rest.length === 0) {
      return originalTool(name, ...rest);
    }
    const originalCallback = rest[rest.length - 1];
    if (typeof originalCallback !== "function") {
      return originalTool(name, ...rest);
    }

    const wrappedCallback = async (...callbackArgs: any[]) => {
      // Only guard Workflow86 tools (i.e., all registered tools). MCP list-tools is not a tool call.
      if (!(process.env.W86_API_KEY || process.env.W86_HEADERS)) {
        const msg =
          "Unauthorized: no Workflow86 auth configured. Set W86_API_KEY or W86_HEADERS to call this tool.";
        throw new Error(msg);
      }
      return originalCallback(...callbackArgs);
    };

    rest[rest.length - 1] = wrappedCallback;
    return originalTool(name, ...rest);
  };
}

attachAuthGuardInterceptor(server);

registerWorkflowTools(server);
registerSessionTools(server);
registerTasksTools(server);
registerTableTools(server);
registerComponentTools(server);

async function main() {
  console.error(
    `Workflow86 MCP Server started on stdio (package version: ${version}, Node.js version: ${process.version}, baseUrl: ${baseUrl})`,
  );

  // Allow startup without API key so MCP clients can list tools.
  // Tool execution will be guarded per-call by an interceptor below.
  if (!process.env.W86_API_KEY && !process.env.W86_HEADERS) {
    console.error(
      "W86_API_KEY is not set. Server will start for tool discovery only; Workflow86 tools will require an API key at call time.",
    );
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
