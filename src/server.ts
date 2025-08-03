#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getWorkflowHistory,
  getWorkflowSession,
  getWorkflowVersion,
  listWorkflows,
  listWorkflowSessions,
  retryFailedComponent1,
  runWorkflow,
  terminateComponent,
  terminateEntireSession,
  retryFailedComponent,
  rerunWorkflow,
  buildWorkflow,
} from "./client/sdk.gen.js";
import {
  PageOfWorkflowHistory,
  SessionSummary,
  WorkflowSummary,
  WorkflowVersionDetails,
} from "./client/types.gen.js";
import { client } from "./client/client.gen.js";
import {
  relinkSessionPage,
  relinkWorkflowHistoryPage,
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

const zodPageNumber = z
  .number()
  .default(0)
  .describe("The zero-indexed page number of the response data");

server.tool(
  "list-workflows",
  "Get a paginated list of workflow summaries including workflow IDs, names, publication status, draft versions, and navigation links. Returns structured metadata for each workflow with pagination controls and links to detailed workflow information.",
  {
    status: z
      .enum(["ALL", "PUBLISHED"])
      .default("ALL")
      .describe("Optional parameter to filter results by publication status"),
    pageNumber: zodPageNumber,
  },
  async ({ status = "ALL", pageNumber = 0 }) => {
    try {
      const response = await listWorkflows({
        client: client,
        throwOnError: true,
        query: {
          status,
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
  "get-workflow-history",
  "Retrieve a paginated history of all versions for a specific workflow, including version numbers, timestamps, status changes, and metadata for each version. Useful for tracking workflow evolution and accessing previous versions.",
  {
    workflowId: z
      .string()
      .describe("The ID of the workflow to get the details of"),
    pageNumber: zodPageNumber,
  },
  async ({ workflowId, pageNumber = 0 }) => {
    try {
      const response = await getWorkflowHistory({
        client: client,
        throwOnError: true,
        path: {
          workflowId,
        },
        query: {
          pageNumber,
        },
      });

      const workflowHistory: PageOfWorkflowHistory = response.data;
      return jsonResponse(
        relinkWorkflowHistoryPage(workflowId, workflowHistory),
      );
    } catch (error) {
      return handleError(error);
    }
  },
);

server.tool(
  "get-workflow",
  "Get comprehensive workflow details including metadata (ID, version, status, name), full workflow description with purpose and use cases, complete component definitions with types and descriptions, placeholder mappings for data flow between components, component connections and relationships, and links to related workflow operations like session management",
  {
    workflowId: z
      .string()
      .describe("The ID of the workflow to get the details of"),
    workflowVersion: z
      .string()
      .default("PUBLISHED")
      .describe("PUBLISHED, DRAFT, or an integer workflow version"),
  },
  async ({ workflowId, workflowVersion = "PUBLISHED" }) => {
    try {
      const response = await getWorkflowVersion({
        client: client,
        throwOnError: true,
        path: {
          workflowId,
          workflowVersion,
        },
      });

      const workflow: WorkflowVersionDetails = response.data;
      return jsonResponse(relinkWorkflowVersion(workflow));
    } catch (error: any) {
      if (error?.httpStatus === 410 && workflowVersion === "PUBLISHED") {
        return textResponse("This project has not been published");
      } else {
        return handleError(error);
      }
    }
  },
);

server.tool(
  "run-workflow",
  "Execute a workflow starting from a specified component with optional placeholder values. Supports both production runs and test runs of draft versions. Validates component existence and placeholder types before execution. Returns session details for tracking workflow progress. Can be used to restart workflows with data from previous sessions.",
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
    workflowVersion: z
      .string()
      .describe(
        "Optional project version to run. If not provided, uses latest version based on session mode.",
      )
      .optional(),
  },
  async ({ workflowId, componentId, placeholderValues, workflowVersion }) => {
    try {
      const response = await runWorkflow({
        client: client,
        throwOnError: true,
        path: {
          workflowId,
        },
        body: {
          componentId,
          //The API supports more natural JSON but we don't need that and simplify the MCP interface but need to cast to
          // more complicated type to keep typescript happy
          placeholderValues: placeholderValues as unknown as Record<
            string,
            Record<string, unknown>
          >,
          workflowVersion,
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
  "Get a paginated list of all execution sessions for a workflow, including session IDs, status, timestamps, and execution mode. Can filter between production and test runs of draft workflows. Returns user-friendly messages when no sessions exist, with pagination support for workflows with many execution histories.",
  {
    workflowId: z
      .string()
      .describe("The ID of the workflow to list sessions for"),
    sessionMode: z
      .enum(["PROD", "TEST"])
      .default("PROD")
      .describe("Optional filter to return PROD or TEST sessions"),
    pageNumber: zodPageNumber,
  },
  async ({ workflowId, sessionMode = "PROD", pageNumber = 0 }) => {
    try {
      const response = await listWorkflowSessions({
        client: client,
        throwOnError: true,
        path: {
          workflowId,
        },
        query: {
          sessionMode,
          pageNumber,
        },
      });

      const sessions: SessionSummary[] = response?.data?._embedded || [];
      if (sessions.length === 0) {
        if (pageNumber === 0) {
          return textResponse(
            `This workflow has never been run in ${sessionMode} mode`,
          );
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
  "Retrieve comprehensive details of a specific workflow execution session, including session status, component execution states, placeholder values, timing information, error details, and complete execution history. Essential for debugging and monitoring workflow runs.",
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
  "Immediately stop and terminate an entire workflow session, ending execution of all active components and preventing any further processing. Useful for canceling long-running workflows or stopping erroneous executions. Returns confirmation of termination status.",
  {
    sessionId: z
      .string()
      .describe("The ID of the workflow session to terminate"),
  },
  async ({ sessionId }) => {
    try {
      const response = await terminateEntireSession({
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
  "Selectively terminate a specific component thread within a workflow session while allowing other components to continue running. Provides granular control over workflow execution by targeting individual components or threads. Useful for stopping problematic components without affecting the entire workflow.",
  {
    sessionId: z.string().describe("The ID of the workflow session"),
    componentId: z.string().describe("The ID of the component to terminate"),
    threadId: z
      .string()
      .default("root")
      .describe("The ID of the thread to terminate"),
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
  "Restart execution of a failed component and continue the workflow from that point forward. Automatically resumes processing from the specified component using existing session data and placeholder values. Essential for recovering from transient failures or errors without restarting the entire workflow.",
  {
    sessionId: z.string().describe("The ID of the workflow session"),
    componentId: z.string().describe("The ID of the component to retry"),
    threadId: z
      .string()
      .default("root")
      .describe("The ID of the thread to retry"),
  },
  async ({ sessionId, componentId, threadId = "root" }) => {
    try {
      const response = await retryFailedComponent1({
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
  "rerun-workflow",
  "Reruns a workflow component from an existing session and copies placeholders" +
    " from the provided workflow session",
  {
    workflowId: z.string().describe("The ID of the workflow to rerun"),
    sessionId: z
      .string()
      .describe("The ID of the workflow session to copy values from"),
    componentId: z
      .string()
      .describe("The ID of the component to start running from"),
    projectVersion: z
      .string()
      .describe(
        "The project version to run. It will default to project version from the sessionId",
      )
      .optional(),
  },
  async ({ workflowId, sessionId, componentId, projectVersion }) => {
    try {
      const response = await rerunWorkflow({
        client: client,
        throwOnError: true,
        path: {
          workflowId: workflowId,
        },
        body: {
          componentId: componentId,
          originalSessionId: sessionId,
          workflowVersion: projectVersion,
        },
      });

      return jsonResponse(response.data);
    } catch (error) {
      return handleError(error);
    }
  },
);

server.tool(
  "build-workflow",
  "Build a workflow using AI with text description and optional image input. Returns an AI chat session ID for tracking the build progress.",
  {
    text: z.string().describe("The text description of the workflow to build"),
    image: z
      .string()
      .describe("Optional URL of an image to include in the workflow build")
      .optional(),
  },
  async ({ text, image }) => {
    try {
      const response = await buildWorkflow({
        client: client,
        throwOnError: true,
        body: {
          text,
          image,
        },
      });

      const sessionId = response.data.sessionId;
      
      if (sessionId) {
        return textResponse(`Workflow build started successfully. Session ID: ${sessionId}. Use the get-session tool with this session ID to check build progress. The build process may take several minutes to complete.`);
      } else {
        return jsonResponse(response.data);
      }
    } catch (error) {
      return handleError(error);
    }
  },
);

server.tool(
  "poll-workflow-build",
  "Poll the status of a workflow build until it completes or fails. Returns the final build status.",
  {
    sessionId: z.string().describe("The session ID returned from build-workflow"),
    maxWaitSeconds: z
      .number()
      .default(300)
      .describe("Maximum time to wait for completion in seconds (default: 300)"),
  },
  async ({ sessionId, maxWaitSeconds = 300 }) => {
    try {
      const startTime = Date.now();
      const maxWaitMs = maxWaitSeconds * 1000;
      
      while (Date.now() - startTime < maxWaitMs) {
        try {
          const response = await getWorkflowSession({
            client: client,
            throwOnError: true,
            path: {
              sessionId,
            },
          });

          const session = response.data;
          
          if (session.status === "SUCCESSFUL") {
            return textResponse(`Workflow build completed successfully! Session ID: ${sessionId}`);
          } else if (session.status === "FAILED") {
            return textResponse(`Workflow build failed. Session ID: ${sessionId}. Check the session details for error information.`);
          } else if (session.status === "TERMINATED") {
            return textResponse(`Workflow build was terminated. Session ID: ${sessionId}`);
          }
          
          // Wait 5 seconds before next poll
          await new Promise(resolve => setTimeout(resolve, 5000));
          
                 } catch (error: any) {
           if (error?.httpStatus === 404) {
             return textResponse(`Session ${sessionId} not found. The build may have failed or been cancelled.`);
           }
           throw error;
         }
      }
      
      return textResponse(`Workflow build is still in progress after ${maxWaitSeconds} seconds. Session ID: ${sessionId}. Use get-session to check current status.`);
      
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
  const text = JSON.stringify(result, null, 2);
  if (process.stdout.isTTY) {
    console.error(text);
  }
  return textResponse(text);
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
