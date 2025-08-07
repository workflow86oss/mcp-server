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
} from "./client/sdk.gen.js";
import {
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
import { addSchemaMetadataByType } from "./schema";
import {
  textResponse,
  jsonResponse,
  handleError,
  zodPageNumber,
} from "./util.js";

export function registerWorkflowTools(server: McpServer) {
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
    "Execute a workflow starting from a specified component with optional placeholder values. Supports both production runs and test runs of draft versions. Validates component existence and placeholder types before execution. Returns session details for tracking workflow progress. Can be used to restart workflows with data from previous sessions.",
    {
      workflowId: z.string().describe("The ID of the workflow to run"),
      componentId: z
        .string()
        .describe("The ID of the component to start running from"),
      // Simplify placeholderValues to a String -> String map rather than confusing AI with all the options
      placeholderValues: z
        .record(z.string(), z.string())
        .describe(
          "A object containing placeholder keys and values.\n" +
            "- Keys must be from the set of placeholders available to the specified component.\n" +
            "- All keys are optional at the API level, but omitting them may cause the workflow to fail.\n" +
            "- Values are validated against the placeholder type.\n" +
            "- datetime placeholders MUST be in ISO-8601 format, but may omit timezone, offset, or the whole time portion.\n" +
            '- list placeholders MUST be sent as a Bracketed String. eg. "[1,2,3]"\n' +
            "- Values MUST NOT be sent as JSON objects, instead keys should use dotted form.",
        )
        .optional(),
      workflowVersion: z
        .string()
        .describe(
          "Optional project version to run. If not provided, uses latest version based on session mode.",
        )
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
    "Reruns a workflow component from an existing session and copies placeholders" +
      " from the provided workflow session",
    {
      workflowId: z.string().describe("The ID of the workflow to rerun"),
      sessionId: z
        .string()
        .describe("The ID of the workflow session to copy values from"),
      componentId: z
        .string()
        .describe("The ID of the component to start running from"),
      projectVersion: z
        .string()
        .describe(
          "The project version to run. It will default to project version from the sessionId",
        )
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
    "Deploy the draft version of a workflow as the published version, making it available for production execution. If a published version already exists, this will replace it and increment the draft version number. Include a comment and description to document the deployment.",
    {
      workflowId: z.string().describe("The ID of the workflow to publish"),
      comment: z
        .string()
        .optional()
        .describe("Comment describing the changes in deployment of draft to published"),
      description: z
        .string()
        .optional()
        .describe("Normative description of the workflow, what it does, its purpose, and any other relevant explanatory information"),
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
    "Unpublish a published version of a workflow, making it unavailable for normal execution. This changes the status of the workflow to have no version deployed to published state, making only the draft version available. Useful for taking published workflows offline for any reason.",
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
}
