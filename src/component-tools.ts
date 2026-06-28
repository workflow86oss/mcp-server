import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deleteComponent } from "./client";
import { textResponse } from "./util.js";

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
