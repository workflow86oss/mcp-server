import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "./client/client.gen.js";
import { textResponse, jsonResponse, handleError } from "./util.js";
import { deleteComponent, generateComponent } from "./client";
import {addSchemaMetadataByType} from "./schema";

export function registerComponentTools(server: McpServer) {
  server.tool(
    "delete-component",
    "Delete a component from a draft workflow, removing all links to and from the component.",
    {
      workflowId: z.string(),
      componentId: z.string(),
    },
    async ({ workflowId, componentId }) => {
      await deleteComponent({ path: { workflowId, componentId } });
      return textResponse("Component componentId deleted");
    },
  );

  server.tool(
    "generate-component",
    "Generate or edit a workflow component using AI. When workflowId and componentId are provided, edits an existing component. When only workflowId is provided, creates a new component in the existing workflow. Returns a session ID that can be used to poll for the generation results.",
    {
      workflowId: z.string().describe("UUID identifier of the workflow"),
      componentId: z
        .string()
        .optional()
        .describe(
          "UUID identifier of the component to edit (optional - if not provided, creates new component)",
        ),
      type: z
        .string()
        .optional()
        .describe(
          "Type of component to create (optional - only used when creating new component)",
        ),
      userRequirement: z
        .string()
        .describe(
          "Description of what the component should do or how it should be modified",
        ),
      context: z
        .string()
        .optional()
        .describe("Additional context for the AI generation (optional)"),
    },
    async ({ workflowId, componentId, type, userRequirement, context }) => {
      try {
        const response = await generateComponent({
          path: { workflowId },
          query: {
            componentId,
            type,
            userRequirement,
          },
          body: context,
        });

        return jsonResponse(
            addSchemaMetadataByType(response.data, "GenerateWorkflowResponse"),
        );
      } catch (error) {
        return handleError(error);
      }
    },
  );
}
