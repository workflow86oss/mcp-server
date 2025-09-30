import {
  PageOfSessionSummary,
  PageOfWorkflowHistory,
  PageOfWorkflowSummary,
  SessionSummary,
  WorkflowHistory,
  WorkflowSummary,
  WorkflowVersionDetails,
  SessionResult,
  PageOfTableSummary,
  TableSummary,
} from "./client";
import { ToolCall } from "./links";

export function relinkSessionPage(
  sessions: PageOfSessionSummary,
): Record<string, any> {
  const links: Record<string, ToolCall> = {};
  if (sessions._links.previousPage) {
    links.previousPage = {
      name: "list-sessions",
      arguments: {
        workflowId: getWorkflowId(sessions._links.previousPage),
        pageNumber: sessions._pageNumber - 1,
      },
    };
  }
  if (sessions._links.nextPage) {
    links.nextPage = {
      name: "list-sessions",
      arguments: {
        workflowId: getWorkflowId(sessions._links.nextPage),
        pageNumber: sessions._pageNumber + 1,
      },
    };
  }

  return {
    session: sessions._embedded.map(relinkSessionSummary),
    "@pageNumber": sessions._pageNumber,
    "@hasMorePages": !sessions._lastPage,
    "@links": links,
  };
}

function relinkSessionSummary(session: SessionSummary): Record<string, any> {
  const links: Record<string, ToolCall> = {
    details: {
      name: "get-session",
      arguments: {
        sessionId: session.sessionId,
      },
    },
  };
  const { _links, ...result } = session;
  return {
    ...result,
    "@links": links,
  };
}

export function relinkSessionResult(
  sessionResult: SessionResult,
): Record<string, any> {
  const links: Record<string, ToolCall> = {};

  const relinkedComponentResults = sessionResult.componentResults?.map(
    (result) => {
      const componentLinks: Record<string, ToolCall> = {};

      if (result._links?.terminateComponent) {
        componentLinks.terminateComponent = {
          name: "terminate-component",
          arguments: {
            sessionId: sessionResult.sessionId,
            componentId: result.componentId,
            threadId: result.thread,
          },
        };
      }

      if (result._links?.retryFailedComponent) {
        componentLinks.retryFailedComponent = {
          name: "retry-failed-component",
          arguments: {
            sessionId: sessionResult.sessionId,
            componentId: result.componentId,
            threadId: result.thread,
          },
        };
      }

      const { _links, ...resultWithoutLinks } = result;
      return {
        ...resultWithoutLinks,
        "@links": componentLinks,
      };
    },
  );

  const { _links, ...sessionWithoutLinks } = sessionResult;
  return {
    ...sessionWithoutLinks,
    componentResults: relinkedComponentResults,
    "@links": links,
  };
}

function getWorkflowId(url: string): string {
  const match = url.match(/\/v1\/workflow\/([a-f0-9-]{36})\/sessions/);
  return match ? match[1] : "unknown";
}
