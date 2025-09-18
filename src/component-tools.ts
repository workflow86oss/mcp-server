import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "./client/client.gen.js";
import { textResponse, jsonResponse, handleError } from "./util.js";
import { deleteComponent } from "./client";

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
}
