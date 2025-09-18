import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  FormSummary,
  listForms,
  listTasks,
  PageOfFormSummary,
  PageOfTaskSummary,
} from "./client";
import { client } from "./client/client.gen";
import { handleError, jsonResponse, textResponse, zodPageNumber } from "./util";

export function registerTasksTools(server: McpServer) {
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

        const taskResponse: PageOfTaskSummary = response.data;
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

        const formsResponse: PageOfFormSummary = response.data;
        const forms: FormSummary[] = formsResponse?._embedded || [];
        if (forms.length === 0) {
          if (pageNumber === 0) {
            return textResponse("There are no forms available for this user");
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
