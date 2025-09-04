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
import { addSchemaMetadataByType } from "./schema";
import {
  PageOfWorkflowSummarySchema,
  PageOfWorkflowHistorySchema,
  WorkflowVersionDetailsSchema,
  PageOfSessionSummarySchema,
  SessionResultSchema,
  PageOfTableSummarySchema,
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
