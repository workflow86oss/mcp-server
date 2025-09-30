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
  generateWorkflowPlan,
  getWorkflowPlan,
  applyWorkflowPlanSkeleton,
  updateWorkflowDetails,
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
} from "./workflow-links.js";
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
      orderBy: z
        .enum(["name", "lastModified"])
        .default("name")
        .describe("Field to sort by"),
      orderDirection: z
        .enum(["ASC", "DESC"])
        .default("ASC")
        .describe("Sort direction"),
    },
    async ({
      status = "ALL",
      pageNumber = 0,
      orderBy = "name",
      orderDirection = "ASC",
    }) => {
      try {
        const response = await listWorkflows({
          client: client,
          throwOnError: true,
          query: {
            status,
            pageNumber,
            orderBy,
            orderDirection,
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

        return jsonResponse(
          addSchemaMetadataByType(
            relinkWorkflowPage(response.data),
            "PageOfWorkflowSummary",
          ),
        );
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
          addSchemaMetadataByType(
            relinkWorkflowHistoryPage(workflowId, workflowHistory),
            "PageOfWorkflowHistory",
          ),
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
        .default("DEFAULT")
        .describe("DEFAULT, PUBLISHED, DRAFT, or an integer workflow version"),
    },
    async ({ workflowId, workflowVersion = "DEFAULT" }) => {
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
        return jsonResponse(
          addSchemaMetadataByType(
            relinkWorkflowVersion(workflow),
            "WorkflowVersionDetails",
          ),
        );
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
        .describe("Comment describing the changes in this publication"),
      description: z
        .string()
        .optional()
        .describe("Normative description of this workflow"),
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
    "generate-workflow-plan",
    "Generate a workflow edit plan using AI. Takes a workflow ID (optional, leave blank for new workflow) and user requirement description to create an edit plan. Returns a session ID that can be used to poll for the generated plan results.",
    {
      workflowId: z
        .string()
        .optional()
        .describe(
          "The ID of an existing workflow to edit, or leave blank for new workflow",
        ),
      userRequirement: z
        .string()
        .describe(
          "Description of what the workflow should do or how it should be modified",
        ),
      context: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          "Optional context object with additional information for the AI",
        ),
    },
    async ({ workflowId, userRequirement, context }) => {
      try {
        const response = await generateWorkflowPlan({
          client: client,
          throwOnError: true,
          query: {
            workflowId,
            userRequirement,
          },
          body: context ? JSON.stringify(context) : undefined,
        });

        return jsonResponse(
          addSchemaMetadataByType(response.data, "GenerateWorkflowResponse"),
        );
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "get-workflow-plan",
    "Retrieve the status and results of a workflow plan generation using the session ID. Returns the current status (in_progress, success) and the latest AI response containing the plan or questions.",
    {
      sessionId: z
        .string()
        .describe("Session ID returned from generate-workflow-plan"),
    },
    async ({ sessionId }) => {
      try {
        const response = await getWorkflowPlan({
          client: client,
          throwOnError: true,
          path: {
            planSessionId: sessionId,
          },
        });

        return jsonResponse(
          addSchemaMetadataByType(response.data, "GetWorkflowPlanResponse"),
        );
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "apply-workflow-plan-skeleton",
    "Apply AI workflow edit changes for a given session. Takes a session ID and applies the workflow edit changes generated by the AI. Returns a session ID that can be used to track the application of changes.",
    {
      sessionId: z
        .string()
        .describe("Session ID returned from generate-workflow-plan"),
    },
    async ({ sessionId }) => {
      try {
        const response = await applyWorkflowPlanSkeleton({
          client: client,
          throwOnError: true,
          path: {
            sessionId,
          },
        });

        return jsonResponse(
          addSchemaMetadataByType(response.data, "GenerateWorkflowResponse"),
        );
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "update-workflow-details",
    "Update workflow name and/or description. Only provided fields will be updated, omitted fields will remain unchanged.",
    {
      workflowId: z.string().describe("The ID of the workflow to update"),
      workflowName: z
        .string()
        .optional()
        .describe(
          "Optional new name for the workflow. If not provided, the name will not be changed",
        ),
      workflowDescription: z
        .string()
        .optional()
        .describe(
          "Optional new description for the workflow. If not provided, the description will not be changed",
        ),
    },
    async ({ workflowId, workflowName, workflowDescription }) => {
      try {
        const response = await updateWorkflowDetails({
          client: client,
          throwOnError: true,
          path: {
            workflowId,
          },
          body: {
            workflowName,
            workflowDescription,
          },
        });

        const workflow: WorkflowVersionDetails = response.data;
        return jsonResponse(
          addSchemaMetadataByType(
            relinkWorkflowVersion(workflow),
            "WorkflowVersionDetails",
          ),
        );
      } catch (error) {
        return handleError(error);
      }
    },
  );
}
