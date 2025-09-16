import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "./client/client.gen.js";
import { textResponse, jsonResponse, handleError } from "./util.js";
import {
  relinkComponentEditResponse,
  relinkComponentEditStatusResponse,
} from "./component-links.js";

// Component edit API functions (using direct fetch until endpoints are in OpenAPI spec)
async function startComponentEdit(request: {
  workflowId: string;
  type?: string;
  componentId?: string;
  userRequirement: string;
  context?: any;
  availableCredentials?: string[];
  availableDatabase?: string[];
  triggerApps?: string[];
}): Promise<Response> {
  const config = client.getConfig();
  const headers = config.headers as Record<string, string>;
  const apiKey = headers?.["x-api-key"];

  if (!apiKey) {
    throw new Error("API key not configured");
  }

  return fetch(`${config.baseUrl}/v1/component/edit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(request),
  });
}

async function getComponentEditStatus(sessionId: string): Promise<Response> {
  const config = client.getConfig();
  const headers = config.headers as Record<string, string>;
  const apiKey = headers?.["x-api-key"];

  if (!apiKey) {
    throw new Error("API key not configured");
  }

  return fetch(`${config.baseUrl}/v1/component/edit/${sessionId}`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
    },
  });
}

export function registerComponentTools(server: McpServer) {
  server.tool(
    "edit-component",
    "Edit an existing workflow component or create a new one using AI assistance. Returns a session ID for polling the edit status.",
    {
      workflowId: z
        .string()
        .describe("The ID of the workflow (use 'new' for new workflows)"),
      type: z
        .string()
        .optional()
        .describe("Component type (required if workflowId is 'new')"),
      componentId: z
        .string()
        .optional()
        .describe("ID of component to edit (optional for new components)"),
      userRequirement: z
        .string()
        .describe("User requirement or problem description"),
      context: z
        .record(z.any())
        .optional()
        .describe("Context from previous messages or chat history"),
      availableCredentials: z
        .array(z.string())
        .optional()
        .describe("Available credentials for API/code components"),
      availableDatabase: z
        .array(z.string())
        .optional()
        .describe("Available databases for DB components"),
      triggerApps: z
        .array(z.string())
        .optional()
        .describe("Available trigger apps for external app components"),
    },
    async ({
      workflowId,
      type,
      componentId,
      userRequirement,
      context,
      availableCredentials,
      availableDatabase,
      triggerApps,
    }) => {
      try {
        const response = await startComponentEdit({
          workflowId,
          type,
          componentId,
          userRequirement,
          context,
          availableCredentials,
          availableDatabase,
          triggerApps,
        });

        if (!response.ok) {
          const errorText = await response.text();
          return textResponse(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        return jsonResponse(relinkComponentEditResponse(result));
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "get-component-edit-status",
    "Get the status of a component edit operation. Returns questions if AI needs clarification, or component ID if edit was successful.",
    {
      sessionId: z.string().describe("Session ID from edit-component response"),
    },
    async ({ sessionId }) => {
      try {
        const response = await getComponentEditStatus(sessionId);

        if (!response.ok) {
          const errorText = await response.text();
          return textResponse(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        return jsonResponse(relinkComponentEditStatusResponse(result));
      } catch (error) {
        return handleError(error);
      }
    },
  );
}
