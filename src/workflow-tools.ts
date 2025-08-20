import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getWorkflowHistory,
  getWorkflowVersion,
  listWorkflows,
  runWorkflow,
  rerunWorkflow,
  publishWorkflow,
  unpublishWorkflow,
  listForms,
  listTasks,
} from "./client/sdk.gen.js";
import {
  FormSummaryDto,
  ListTasksResponse,
  PageOfFormSummaryDto,
  PageOfWorkflowHistory,
  WorkflowSummary,
  WorkflowVersionDetails,
} from "./client/types.gen.js";
import { client } from "./client/client.gen.js";
import {
  relinkWorkflowHistoryPage,
  relinkWorkflowPage,
  relinkWorkflowVersion,
} from "./links.js";
import { addSchemaMetadataByType, createSchemaDescriber } from "./schema";
import {
  textResponse,
  jsonResponse,
  handleError,
  zodPageNumber,
} from "./util.js";

export function registerWorkflowTools(server: McpServer) {
  // Create schema describers for cleaner lookup
  const runWorkflowSchema = createSchemaDescriber("RunWorkflowCommand");
  const rerunWorkflowSchema = createSchemaDescriber("RerunWorkflowCommand");
  const publishWorkflowSchema = createSchemaDescriber("PublishWorkflowCommand");
  server.tool(
    "list-workflows",
    "Get a paginated list of workflow summaries including workflow IDs, names, publication status, draft versions, and navigation links. Returns structured metadata for each workflow with pagination controls and links to detailed workflow information.",
    {
      status: z
        .enum(["ALL", "PUBLISHED"])
        .default("ALL")
        .describe("Optional parameter to filter results by publication status"),
      pageNumber: zodPageNumber,
    },
    async ({ status = "ALL", pageNumber = 0 }) => {
      try {
        const response = await listWorkflows({
          client: client,
          throwOnError: true,
          query: {
            status,
            pageNumber,
          },
        });

        const workflows: WorkflowSummary[] = response?.data?._embedded || [];
        if (workflows.length === 0) {
          if (pageNumber === 0) {
            return textResponse(
              "There are no workflows defined for this client",
            );
          } else {
            return textResponse("This page contains no additional workflows");
          }
        }

        return jsonResponse(relinkWorkflowPage(response.data));
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "get-workflow-history",
    "Retrieve a paginated history of all versions for a specific workflow, including version numbers, timestamps, status changes, and metadata for each version. Useful for tracking workflow evolution and accessing previous versions.",
    {
      workflowId: z
        .string()
        .describe("The ID of the workflow to get the details of"),
      pageNumber: zodPageNumber,
    },
    async ({ workflowId, pageNumber = 0 }) => {
      try {
        const response = await getWorkflowHistory({
          client: client,
          throwOnError: true,
          path: {
            workflowId,
          },
          query: {
            pageNumber,
          },
        });

        const workflowHistory: PageOfWorkflowHistory = response.data;
        return jsonResponse(
          relinkWorkflowHistoryPage(workflowId, workflowHistory),
        );
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "get-workflow",
    "Get comprehensive workflow details including metadata (ID, version, status, name), full workflow description with purpose and use cases, complete component definitions with types and descriptions, placeholder mappings for data flow between components, component connections and relationships, and links to related workflow operations like session management",
    {
      workflowId: z
        .string()
        .describe("The ID of the workflow to get the details of"),
      workflowVersion: z
        .string()
        .default("PUBLISHED")
        .describe("PUBLISHED, DRAFT, or an integer workflow version"),
    },
    async ({ workflowId, workflowVersion = "PUBLISHED" }) => {
      try {
        const response = await getWorkflowVersion({
          client: client,
          throwOnError: true,
          path: {
            workflowId,
            workflowVersion,
          },
        });

        const workflow: WorkflowVersionDetails = response.data;
        return jsonResponse(relinkWorkflowVersion(workflow));
      } catch (error: any) {
        if (error?.httpStatus === 410 && workflowVersion === "PUBLISHED") {
          return textResponse("This project has not been published");
        } else {
          return handleError(error);
        }
      }
    },
  );

  server.tool(
    "run-workflow",
    runWorkflowSchema.main(),
    {
      workflowId: z.string().describe("The ID of the workflow to run"),
      componentId: z
        .string()
        .describe(runWorkflowSchema.describe("componentId")),
      // Simplify placeholderValues to a String -> String map rather than confusing AI with all the options
      placeholderValues: z
        .record(z.string(), z.string())
        .describe(runWorkflowSchema.prop("placeholderValues"))
        .optional(),
      workflowVersion: z
        .string()
        .describe(runWorkflowSchema.prop("workflowVersion"))
        .optional(),
    },
    async ({ workflowId, componentId, placeholderValues, workflowVersion }) => {
      try {
        const response = await runWorkflow({
          client: client,
          throwOnError: true,
          path: {
            workflowId,
          },
          body: {
            componentId,
            //The API supports more natural JSON but we don't need that and simplify the MCP interface but need to cast to
            // more complicated type to keep typescript happy
            placeholderValues: placeholderValues as unknown as Record<
              string,
              Record<string, unknown>
            >,
            workflowVersion,
          },
        });

        return jsonResponse(
          addSchemaMetadataByType(response.data, "RunWorkflowResponse"),
        );
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "rerun-workflow",
    rerunWorkflowSchema.main(),
    {
      workflowId: z.string().describe("The ID of the workflow to rerun"),
      sessionId: z
        .string()
        .describe(rerunWorkflowSchema.prop("originalSessionId")),
      componentId: z
        .string()
        .describe(rerunWorkflowSchema.describe("componentId")),
      projectVersion: z
        .string()
        .describe(rerunWorkflowSchema.prop("workflowVersion"))
        .optional(),
    },
    async ({ workflowId, sessionId, componentId, projectVersion }) => {
      try {
        const response = await rerunWorkflow({
          client: client,
          throwOnError: true,
          path: {
            workflowId: workflowId,
          },
          body: {
            componentId: componentId,
            originalSessionId: sessionId,
            workflowVersion: projectVersion,
          },
        });

        return jsonResponse(
          addSchemaMetadataByType(response.data, "RunWorkflowResponse"),
        );
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "publish-workflow",
    "Publish an existing workflow DRAFT, making it available for production execution. Adds a comment and description to document the publication. Creates a new published version and increments the draft version number.",
    {
      workflowId: z.string().describe("The ID of the workflow to publish"),
      comment: z
        .string()
        .optional()
        .describe(publishWorkflowSchema.prop("comment")),
      description: z
        .string()
        .optional()
        .describe(publishWorkflowSchema.prop("description")),
    },
    async ({ workflowId, comment, description }) => {
      try {
        const response = await publishWorkflow({
          client: client,
          throwOnError: true,
          path: {
            workflowId,
          },
          body: {
            comment,
            description,
          },
        });

        return jsonResponse(
          addSchemaMetadataByType(response.data, "PublishWorkflowResponse"),
        );
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "unpublish-workflow",
    "Unpublish an existing workflow, making it unavailable for normal execution. This changes the status of the currently published version and makes only the draft version available. Useful for taking workflows offline for any reason.",
    {
      workflowId: z.string().describe("The ID of the workflow to unpublish"),
    },
    async ({ workflowId }) => {
      try {
        const response = await unpublishWorkflow({
          client: client,
          throwOnError: true,
          path: {
            workflowId,
          },
        });

        return jsonResponse(
          addSchemaMetadataByType(response.data, "UnpublishWorkflowResponse"),
        );
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "list-tasks",
    "Get a filtered list of task summaries with comprehensive filter options including text search, workflow filtering, status filtering, date range filtering, and pagination support. Returns task details with names, descriptions, URLs, workflow information, and navigation links for easy task management and tracking.",
    {
      queryString: z
        .string()
        .describe(
          "Text search query to filter tasks by content. Do not provide this parameter if there is no search query - omit it entirely rather than passing an empty string.",
        )
        .optional(),
      workflowId: z
        .string()
        .describe("Filter tasks by specific workflow ID")
        .optional(),
      statusToInclude: z
        .array(z.enum(["TODO", "DONE", "TERMINATED", "ERROR"]))
        .describe(
          "Array of task statuses to include in results (Can only be the following ['TODO', 'DONE', 'TERMINATED', 'ERROR'])",
        )
        .optional(),
      startDate: z
        .string()
        .describe(
          "Start date filter in ISO format (e.g., '2023-01-01T00:00:00Z')",
        )
        .optional(),
      endDate: z
        .string()
        .describe(
          "End date filter in ISO format (e.g., '2023-12-31T23:59:59Z')",
        )
        .optional(),
      lastTaskToken: z
        .string()
        .describe(
          "Pagination token in format 'ISO-date:taskId' (e.g., '2023-11-15T14:30:00Z:550e8400-e29b-41d4-a716-446655440000') from previous response for pagination",
        )
        .optional(),
    },
    async ({
      queryString,
      workflowId,
      statusToInclude,
      startDate,
      endDate,
      lastTaskToken,
    }) => {
      try {
        const query: any = {};

        if (queryString) {
          query.queryString = queryString;
        }

        if (workflowId) {
          query.workflowId = workflowId;
        }

        if (statusToInclude && statusToInclude.length > 0) {
          query.statusToInclude = statusToInclude;
        }

        if (startDate) {
          query.startDate = startDate;
        }

        if (endDate) {
          query.endDate = endDate;
        }

        if (lastTaskToken) {
          query.lastTaskToken = lastTaskToken;
        }

        const response = await listTasks({
          client: client,
          throwOnError: true,
          query: query,
        });

        const taskResponse: ListTasksResponse = response.data;
        const tasks = taskResponse?._embedded || [];
        if (tasks.length === 0) {
          if (!lastTaskToken) {
            if (
              statusToInclude &&
              statusToInclude.length === 1 &&
              statusToInclude[0] === "TODO"
            ) {
              return textResponse(
                "🎉 All tasks completed! No TODO items remaining.",
              );
            }
            return textResponse("No tasks match this query filter");
          } else {
            return textResponse("This page contains no additional tasks");
          }
        }

        return jsonResponse(taskResponse);
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "list-forms",
    "Get a paginated list of available forms including form names, URLs, associated workflow IDs and names. Returns form metadata with pagination support for easy form discovery and access. Useful for finding forms that users can submit or access.",
    {
      pageNumber: zodPageNumber,
    },
    async ({ pageNumber = 0 }) => {
      try {
        const response = await listForms({
          client: client,
          throwOnError: true,
          query: {
            pageNumber,
          },
        });

        const formsResponse: PageOfFormSummaryDto = response.data;
        const forms: FormSummaryDto[] = formsResponse?._embedded || [];
        if (forms.length === 0) {
          if (pageNumber === 0) {
            return textResponse("There are no forms available for this client");
          } else {
            return textResponse("This page contains no additional forms");
          }
        }

        return jsonResponse(formsResponse);
      } catch (error) {
        return handleError(error);
      }
    },
  );
}
