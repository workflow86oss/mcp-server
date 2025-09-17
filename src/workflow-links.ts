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
  RunWorkflowResponse,
} from "./client";
import { addSchemaMetadataByType } from "./schema";
import {
  PageOfWorkflowSummarySchema,
  PageOfWorkflowHistorySchema,
  WorkflowVersionDetailsSchema,
  PageOfSessionSummarySchema,
  SessionResultSchema,
  PageOfTableSummarySchema,
  RunWorkflowResponseSchema,
} from "./client/schemas.gen";
import { ToolCall } from "./links";
import { relinkTableSummary } from "./table-links";

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

  const { _links, tables, ...result } = workflow;
  let tableRecord = undefined;
  if (tables && tables.length > 0) {
    tableRecord = tables.map(relinkTableSummary);
  }
  return addSchemaMetadataByType(
    {
      ...result,
      tables: tableRecord,
      "@links": links,
    },
    WorkflowVersionDetailsSchema,
  );
}

export function transformRunWorkflowResponse(
  response: RunWorkflowResponse,
  workflowId: string,
): Record<string, any> {
  // Generate the correct app URL based on session mode
  const isTestMode = response.sessionMode === "TEST";
  const appSessionUrl = `https://app.workflow86.com/project/logs/progress_view/${workflowId}/${response.sessionId}?test=${isTestMode}`;
  
  const links: Record<string, ToolCall> = {};
  
  // Add link to get session details
  if (response.sessionId) {
    links["session-details"] = {
      name: "get-session",
      arguments: {
        sessionId: response.sessionId,
      },
    };
  }
  
  return addSchemaMetadataByType(
    {
      ...response,
      sessionUrl: appSessionUrl,
      "@links": links,
    },
    RunWorkflowResponseSchema,
  );
}
