import { ToolCall } from "./links.js";

export function relinkComponentEditResponse(
  response: any,
): Record<string, any> {
  const links: Record<string, ToolCall> = {};

  if (response.sessionId) {
    links["check-status"] = {
      name: "get-component-edit-status",
      arguments: {
        sessionId: response.sessionId,
      },
    };
  }

  return {
    ...response,
    "@links": links,
  };
}

export function relinkComponentEditStatusResponse(
  response: any,
): Record<string, any> {
  const links: Record<string, ToolCall> = {};

  if (response.status === "in_progress" && response.sessionId) {
    links["check-status-again"] = {
      name: "get-component-edit-status",
      arguments: {
        sessionId: response.sessionId,
      },
    };
  }

  if (response.componentId) {
    links["get-workflow"] = {
      name: "get-workflow",
      arguments: {
        workflowId: "workflow-containing-component",
        workflowVersion: "PUBLISHED",
      },
    };
  }

  return {
    ...response,
    "@links": links,
  };
}
