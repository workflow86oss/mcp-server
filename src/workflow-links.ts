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
  return {
    workflows: page._embedded.map(relinkWorkflowSummary),
    "@pageNumber": page._pageNumber,
    "@hasMorePages": !page._lastPage,
    "@links": links,
  };
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
  return {
    workflowId,
    history: page._embedded.map((entry) =>
      relinkWorkflowHistory(workflowId, entry),
    ),
    "@pageNumber": page._pageNumber,
    "@hasMorePages": !page._lastPage,
    "@links": links,
  };
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
  if (workflow.status === "DRAFT") {
    links["delete-component"] = {
      name: "delete-component",
      arguments: {
        workflowId: workflow.workflowId,
        componentId: "{{components.componentId}}",
      },
    };
  }

  const { _links, tables, ...result } = workflow;
  let tableRecord = undefined;
  if (tables && tables.length > 0) {
    tableRecord = tables.map(relinkTableSummary);
  }
  return {
    ...result,
    tables: tableRecord,
    "@links": links,
  };
}
