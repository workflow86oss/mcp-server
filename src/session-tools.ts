import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getWorkflowSession,
  listWorkflowSessions,
  retryFailedComponent1,
  terminateComponent,
  terminateEntireSession,
} from "./client/sdk.gen.js";
import { SessionSummary } from "./client/types.gen.js";
import { client } from "./client/client.gen.js";
import { relinkSessionPage, relinkSessionResult } from "./links.js";
import { addSchemaMetadataByType } from "./schema";
import {
  textResponse,
  jsonResponse,
  handleError,
  zodPageNumber,
} from "./util.js";

export function registerSessionTools(server: McpServer) {
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

        return jsonResponse(relinkSessionResult(response.data));
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

        return jsonResponse(
          addSchemaMetadataByType(response.data, "RetryWorkflowResponse"),
        );
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

        return jsonResponse(
          addSchemaMetadataByType(response.data, "RetryWorkflowResponse"),
        );
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

        return jsonResponse(
          addSchemaMetadataByType(response.data, "RetryWorkflowResponse"),
        );
      } catch (error) {
        return handleError(error);
      }
    },
  );
}
