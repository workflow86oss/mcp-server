#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getWorkflowSession,
  getWorkflowVersion,
  listWorkflows,
  listWorkflowSessions,
  runWorkflow,
  terminateSession,
  terminateComponent,
  retryFailedComponent,
} from "./client/sdk.gen.js";
import {
  SessionSummary,
  WorkflowSummary,
  WorkflowVersionSummary,
} from "./client/types.gen.js";
import { client } from "./client/client.gen.js";
import {
  relinkSessionPage,
  relinkWorkflowPage,
  relinkWorkflowVersion,
} from "./links.js";
import { version } from "../package.json";

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

server.tool(
  "list-workflows",
  "List all published workflows",
  {
    pageNumber: z
      .number()
      .default(0)
      .describe("The zero-indexed page number of the response data"),
  },
  async ({ pageNumber = 0 }) => {
    try {
      const response = await listWorkflows({
        client: client,
        throwOnError: true,
        query: {
          pageNumber,
        },
      });

      const workflows: WorkflowSummary[] = response?.data?._embedded || [];
      if (workflows.length === 0) {
        if (pageNumber === 0) {
          return textResponse("There are no workflows defined for this client");
        } else {
          return textResponse("This page contains no additional workflows");
        }
      }

      return jsonResponse(relinkWorkflowPage(response.data));
    } catch (error) {
      return handleError(error);
    }
  },
);

server.tool(
  "get-workflow",
  "Get the details of a workflow",
  {
    workflowId: z
      .string()
      .describe("The ID of the workflow to get the details of"),
  },
  async ({ workflowId }) => {
    try {
      const response = await getWorkflowVersion({
        client: client,
        throwOnError: true,
        path: {
          workflowId: workflowId,
          version: "PUBLISHED",
        },
      });

      const workflow: WorkflowVersionSummary = response.data;
      return jsonResponse(relinkWorkflowVersion(workflow));
    } catch (error) {
      return handleError(error);
    }
  },
);

server.tool(
  "run-workflow",
  "Runs a workflow component, passing in placeholders",
  {
    workflowId: z.string().describe("The ID of the workflow to run"),
    componentId: z
      .string()
      .describe("The ID of the component to start running from"),
    // Simplify placeholderValues to a String -> String map rather than confusing AI with all the options
    placeholderValues: z
      .record(z.string(), z.string())
      .describe(
        "A object containing placeholder keys and values.\n" +
          "- Keys must be from the set of placeholders available to the specified component.\n" +
          "- All keys are optional at the API level, but omitting them may cause the workflow to fail.\n" +
          "- Values are validated against the placeholder type.\n" +
          "- datetime placeholders MUST be in ISO-8601 format, but may omit timezone, offset, or the whole time portion.\n" +
          '- list placeholders MUST be sent as a Bracketed String. eg. "[1,2,3]"\n' +
          "- Values MUST NOT be sent as JSON objects, instead keys should use dotted form.",
      )
      .optional(),
  },
  async ({ workflowId, componentId, placeholderValues }) => {
    try {
      const response = await runWorkflow({
        client: client,
        throwOnError: true,
        path: {
          workflowId: workflowId,
        },
        body: {
          componentId: componentId,
          //The API supports more natural JSON but we don't need that and simplify the MCP interface but need to cast to
          // more complicated type to keep typescript happy
          placeholderValues: placeholderValues as unknown as Record<
            string,
            Record<string, unknown>
          >,
        },
      });

      return jsonResponse(response.data);
    } catch (error) {
      return handleError(error);
    }
  },
);

server.tool(
  "list-sessions",
  "List the running or completed sessions for a Workflow",
  {
    workflowId: z
      .string()
      .describe("The ID of the workflow to list sessions for"),
    pageNumber: z
      .number()
      .default(0)
      .describe("The zero-indexed page number of the response data"),
  },
  async ({ workflowId, pageNumber = 0 }) => {
    try {
      const response = await listWorkflowSessions({
        client: client,
        throwOnError: true,
        path: {
          workflowId,
        },
        query: {
          pageNumber,
        },
      });

      const sessions: SessionSummary[] = response?.data?._embedded || [];
      if (sessions.length === 0) {
        if (pageNumber === 0) {
          return textResponse("This workflow has never been run");
        } else {
          return textResponse("This page contains no additional sessions");
        }
      }

      return jsonResponse(relinkSessionPage(response.data));
    } catch (error) {
      return handleError(error);
    }
  },
);

server.tool(
  "get-session",
  "Get the details of a Workflow Session",
  {
    sessionId: z
      .string()
      .describe("The ID of the workflow session to get the details of"),
  },
  async ({ sessionId }) => {
    try {
      const response = await getWorkflowSession({
        client: client,
        throwOnError: true,
        path: {
          sessionId: sessionId,
        },
      });

      return jsonResponse(response.data);
    } catch (error) {
      return handleError(error);
    }
  },
);

server.tool(
  "terminate-entire-session",
  "Terminate an entire workflow session",
  {
    sessionId: z
      .string()
      .describe("The ID of the workflow session to terminate"),
  },
  async ({ sessionId }) => {
    try {
      const response = await terminateSession({
        client: client,
        throwOnError: true,
        path: {
          sessionId: sessionId,
        },
      });

      return jsonResponse(response.data);
    } catch (error) {
      return handleError(error);
    }
  },
);

server.tool(
  "terminate-component",
  "Terminate a specific component thread in a workflow session",
  {
    sessionId: z.string().describe("The ID of the workflow session"),
    componentId: z.string().describe("The ID of the component to terminate"),
    threadId: z.string().describe("The ID of the thread to terminate"),
  },
  async ({ sessionId, componentId, threadId }) => {
    try {
      const response = await terminateComponent({
        client: client,
        throwOnError: true,
        path: {
          sessionId: sessionId,
          componentId: componentId,
          threadId: threadId,
        },
      });

      return jsonResponse(response.data);
    } catch (error) {
      return handleError(error);
    }
  },
);

server.tool(
  "retry-failed-component",
  "Retry a failed component thread in a workflow session",
  {
    sessionId: z.string().describe("The ID of the workflow session"),
    componentId: z.string().describe("The ID of the component to retry"),
    threadId: z
      .string()
      .default("root")
      .describe("The ID of the thread to retry"),
  },
  async ({ sessionId, componentId, threadId }) => {
    try {
      const response = await retryFailedComponent({
        client: client,
        throwOnError: true,
        path: {
          sessionId: sessionId,
          componentId: componentId,
          threadId: threadId,
        },
      });

      return jsonResponse(response.data);
    } catch (error) {
      return handleError(error);
    }
  },
);

function handleError(error: any) {
  if (error.httpStatus) {
    return textResponse(
      `An unexpected HTTP ${error.httpStatus} error occurred: ${error?.message || JSON.stringify(error)}`,
    );
  } else if (error instanceof Error) {
    console.error(error.name, error.message, error.stack);
    return textResponse(`An unexpected error occurred: ${error.message}`);
  } else {
    return textResponse(
      `An unexpected failure occurred: ${error?.message || JSON.stringify(error)}`,
    );
  }
}

function jsonResponse(result: object) {
  return textResponse(JSON.stringify(result, null, 2));
}

function textResponse(text: string) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
  };
}

async function main() {
  console.error(
    `Workflow86 MCP Server running on stdio (Node.js version: ${process.version}, baseUrl: ${baseUrl})`,
  );

  if (!process.env.W86_API_KEY) {
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
