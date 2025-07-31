import {
  PageOfSessionSummary,
  PageOfWorkflowHistory,
  PageOfWorkflowSummary,
  SessionSummary,
  WorkflowHistory,
  WorkflowSummary,
  WorkflowVersionDetails,
  SessionResult,
} from "./client";
import { addSchemaMetadataByType } from "./schema";
import {
  PageOfWorkflowSummarySchema,
  PageOfWorkflowHistorySchema,
  WorkflowVersionDetailsSchema,
  PageOfSessionSummarySchema,
  SessionResultSchema,
} from "./client/schemas.gen";

/*
This class provides functionality related to removing HATEOAS metadata (_links, _pageNumber...) from Public API Responses and replacing them
with MCP Tool Call style @links, @pageNumber etc.

It's perfectly fine to either parse required information out of the HATEOAS _links or from the response (although the
response is weakly preferred as it is less likely to evolve).

We are using an informal standard to represent tool calls, but we haven't had any issues with MCP clients grokking responses.
*/
export class ToolCall {
  name: string;
  arguments: Record<string, any>;

  constructor(name: string, argumints: Record<string, any>) {
    this.name = name;
    this.arguments = argumints;
  }
}

export function relinkWorkflowPage(
  page: PageOfWorkflowSummary,
): Record<string, any> {
  const links: Record<string, ToolCall> = {};
  if (page._pageNumber > 0) {
    links.previousPage = {
      name: "list-workflows",
      arguments: {
        pageNumber: page._pageNumber - 1,
      },
    };
  }
  if (!page._lastPage) {
    links.nextPage = {
      name: "list-workflows",
      arguments: {
        pageNumber: page._pageNumber + 1,
      },
    };
  }
  return addSchemaMetadataByType(
    {
      workflows: page._embedded.map(relinkWorkflowSummary),
      "@pageNumber": page._pageNumber,
      "@links": links,
    },
    PageOfWorkflowSummarySchema,
    "workflows",
  );
}

function relinkWorkflowSummary(workflow: WorkflowSummary): Record<string, any> {
  const links: Record<string, ToolCall> = {};
  if (workflow.published) {
    links["published-workflow-details"] = {
      name: "get-workflow",
      arguments: {
        workflowId: workflow.workflowId,
        workflowVersion: "PUBLISHED",
      },
    };
  }
  links["draft-workflow-details"] = {
    name: "get-workflow",
    arguments: {
      workflowId: workflow.workflowId,
      workflowVersion: "DRAFT",
    },
  };
  links["prod-sessions"] = {
    name: "list-sessions",
    arguments: {
      workflowId: workflow.workflowId,
      sessionMode: "PROD",
    },
  };
  links["test-sessions"] = {
    name: "list-sessions",
    arguments: {
      workflowId: workflow.workflowId,
      sessionMode: "TEST",
    },
  };

  const { _links, ...result } = workflow;
  return {
    ...result,
    "@links": links,
  };
}

export function relinkWorkflowHistoryPage(
  workflowId: string,
  page: PageOfWorkflowHistory,
): Record<string, any> {
  const links: Record<string, ToolCall> = {};

  if (page._pageNumber > 0) {
    links.previousPage = {
      name: "get-workflow-history",
      arguments: {
        workflowId,
        pageNumber: page._pageNumber - 1,
      },
    };
  }
  if (!page._lastPage) {
    links.nextPage = {
      name: "get-workflow-history",
      arguments: {
        workflowId,
        pageNumber: page._pageNumber + 1,
      },
    };
  }
  return addSchemaMetadataByType(
    {
      workflowId,
      history: page._embedded.map((entry) =>
        relinkWorkflowHistory(workflowId, entry),
      ),
      "@pageNumber": page._pageNumber,
      "@links": links,
    },
    PageOfWorkflowHistorySchema,
    "history",
  );
}
function relinkWorkflowHistory(
  workflowId: string,
  entry: WorkflowHistory,
): Record<string, any> {
  const links: Record<string, ToolCall> = {};
  links[`version-${entry.version}-details`] = {
    name: "get-workflow",
    arguments: {
      workflowId: workflowId,
      workflowVersion: entry.version,
    },
  };

  const { _links, ...result } = entry;
  return {
    ...result,
    "@links": links,
  };
}

export function relinkWorkflowVersion(
  workflow: WorkflowVersionDetails,
): Record<string, any> {
  const links: Record<string, ToolCall> = {};

  links["prod-sessions"] = {
    name: "list-sessions",
    arguments: {
      workflowId: workflow.workflowId,
      sessionMode: "PROD",
    },
  };
  links["test-sessions"] = {
    name: "list-sessions",
    arguments: {
      workflowId: workflow.workflowId,
      sessionMode: "TEST",
    },
  };

  const { _links, ...result } = workflow;
  return addSchemaMetadataByType(
    {
      ...result,
      "@links": links,
    },
    WorkflowVersionDetailsSchema,
  );
}

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

  return addSchemaMetadataByType(
    {
      session: sessions._embedded.map(relinkSessionSummary),
      "@pageNumber": sessions._pageNumber,
      "@links": links,
    },
    PageOfSessionSummarySchema,
    "session",
  );
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
            thread: result.thread,
          },
        };
      }

      if (result._links?.retryFailedComponent) {
        componentLinks.retryFailedComponent = {
          name: "retry-failed-component",
          arguments: {
            sessionId: sessionResult.sessionId,
            componentId: result.componentId,
            thread: result.thread,
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
  return addSchemaMetadataByType(
    {
      ...sessionWithoutLinks,
      componentResults: relinkedComponentResults,
      "@links": links,
    },
    SessionResultSchema,
  );
}

function getWorkflowId(url: string): string {
  const match = url.match(/\/v1\/workflow\/([a-f0-9-]{36})\/sessions/);
  return match ? match[1] : "unknown";
}
