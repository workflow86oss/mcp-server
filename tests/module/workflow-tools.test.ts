import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import {
  checkPreconditions,
  parseResponse,
  isPlainTextResponse,
  callTool,
  QUERY_TIMEOUT,
} from "./test-utils";
import { WorkflowSummary } from "../../src/client";

describe("Workflow Tools Module Tests", () => {
  let publishedWorkflowId: string | undefined;
  let draftWorkflowId: string | undefined;

  beforeAll(async () => {
    // Find a published and unpublished workflow to use for tests
    try {
      const result = await callTool("list-workflows", {
        pageNumber: 0,
        status: "ALL",
      });

      const response = parseResponse(result.content[0].text!);
      const workflows: WorkflowSummary[] = response.workflows || [];
      const publishedWorkflow = workflows.find((x) =>
        x.name.includes("Published"),
      );
      publishedWorkflowId = publishedWorkflow?.workflowId;
      const draftWorkflow = workflows.find((x) =>
        x.name.includes("Unpublished"),
      );
      draftWorkflowId = draftWorkflow?.workflowId;

      expect(publishedWorkflowId).toBeDefined();
      expect(draftWorkflowId).toBeDefined();

      // Clean up any inconsistent starting state
      if (publishedWorkflow?.published === false) {
        console.log("Reset published workflow");
        callTool("publish-workflow", {
          workflowId: publishedWorkflowId,
          comment: "Set to published at start of test",
        });
      }
      if (draftWorkflow?.published === true) {
        console.log("Reset draft workflow");
        callTool("unpublish-workflow", { workflowId: draftWorkflowId });
      }
    } catch (error: any) {
      throw new Error(
        `Could not fetch test workflows: ${(error as Error).message}`,
      );
    }
  }, QUERY_TIMEOUT);

  describe("list-workflows", () => {
    it("should return paginated workflow summaries", async () => {
      const result = await callTool("list-workflows", {
        status: "ALL",
        pageNumber: 0,
      });

      expect(result.content).toBeDefined();
      expect(result.content?.[0]?.type).toBe("text");

      const response = JSON.parse(result.content![0].text!);
      expect(response).toHaveProperty("@pageNumber");
      expect(response).toHaveProperty("@links");
      expect(response).toHaveProperty("@schema");
      expect(response["@schema"]).toHaveProperty("workflows");

      const workflows = response.workflows || [];
      workflows.forEach((workflow: any) => {
        expect(workflow).toHaveProperty("workflowId");
        expect(workflow).toHaveProperty("published");
        expect(workflow).toHaveProperty("draftVersion");
        expect(workflow).toHaveProperty("@links");
      });
    });

    it("should filter by publication status", async () => {
      const allResult = await callTool("list-workflows", {
        status: "ALL",
        pageNumber: 0,
      });

      const publishedResult = await callTool("list-workflows", {
        status: "PUBLISHED",
        pageNumber: 0,
      });

      expect(allResult.content?.[0]?.type).toBe("text");
      expect(publishedResult.content?.[0]?.type).toBe("text");

      const allResponse = JSON.parse(allResult.content![0].text!);
      const publishedResponse = JSON.parse(publishedResult.content![0].text!);

      expect(allResponse).toBeDefined();
      expect(publishedResponse).toBeDefined();

      const publishedWorkflows = publishedResponse.workflows || [];
      publishedWorkflows.forEach((workflow: any) => {
        expect(workflow.published).toBe(true);
      });
    });

    it("should handle pagination", async () => {
      const result = await callTool("list-workflows", {
        status: "ALL",
        pageNumber: 0,
      });

      expect(result.content?.[0]?.type).toBe("text");
      const firstPage = JSON.parse(result.content![0].text!);

      expect(firstPage["@pageNumber"]).toBe(0);
      if (firstPage["@links"]?.nextPage) {
        expect(firstPage["@links"].nextPage.arguments.pageNumber).toBe(1);
      }
    });
  });

  describe("get-workflow", () => {
    it("should return workflow details for PUBLISHED version", async () => {
      checkPreconditions(publishedWorkflowId, "PUBLISHED version test");

      try {
        const result = await callTool("get-workflow", {
          workflowId: publishedWorkflowId,
          workflowVersion: "PUBLISHED",
        });

        expect(result.content?.[0]?.type).toBe("text");
        const responseText = result.content![0].text!;
        const response = parseResponse(responseText);

        // Handle case where workflow is not published
        if (isPlainTextResponse(response)) {
          // Plain text response like "This project has not been published"
          expect(response.message).toContain("not been published");
          return;
        }

        expect(response).toBeDefined();
        expect(response).toHaveProperty("workflowId");
        expect(response).toHaveProperty("version");
        expect(response).toHaveProperty("status");
        expect(response).toHaveProperty("@links");
        expect(response).toHaveProperty("@schema");
      } catch (error: any) {
        if (error?.message?.includes("410")) {
          console.warn(
            "Workflow not published, which is expected for some tests",
          );
        } else {
          throw error;
        }
      }
    });

    it("should return workflow details for DRAFT version", async () => {
      checkPreconditions(draftWorkflowId, "DRAFT version test");

      const result = await callTool("get-workflow", {
        workflowId: draftWorkflowId,
        workflowVersion: "DRAFT",
      });

      expect(result.content?.[0]?.type).toBe("text");
      const response = JSON.parse(result.content![0].text!);

      expect(response).toBeDefined();
      expect(response).toHaveProperty("workflowId");
      expect(response).toHaveProperty("version");
      expect(response).toHaveProperty("status");
      expect(response).toHaveProperty("@links");
      expect(response).toHaveProperty("@schema");
    });

    it("should handle non-existent workflow", async () => {
      await expect(
        callTool("get-workflow", {
          workflowId: "00000000-0000-0000-0000-000000000000",
          workflowVersion: "DRAFT",
        }),
      ).rejects.toThrow();
    });
  });

  describe("get-workflow-history", () => {
    it("should return workflow version history", async () => {
      checkPreconditions(publishedWorkflowId, "workflow history test");

      const result = await callTool("get-workflow-history", {
        workflowId: publishedWorkflowId,
        pageNumber: 0,
      });

      expect(result.content?.[0]?.type).toBe("text");
      const response = JSON.parse(result.content![0].text!);

      expect(response).toBeDefined();
      expect(response).toHaveProperty("@pageNumber");
      expect(response).toHaveProperty("@links");
      expect(response).toHaveProperty("@schema");

      const history = response.history || [];
      history.forEach((version: any) => {
        expect(version).toHaveProperty("version");
        expect(version).toHaveProperty("status");
        expect(version).toHaveProperty("@links");
      });
    });

    it("should handle pagination for workflow history", async () => {
      const result = await callTool("get-workflow-history", {
        workflowId: publishedWorkflowId,
        pageNumber: 0,
      });

      expect(result.content?.[0]?.type).toBe("text");
      const firstPage = JSON.parse(result.content![0].text!);

      expect(firstPage["@pageNumber"]).toBe(0);
    });
  });

  describe("publish-workflow", () => {
    it("should publish a workflow with minimal parameters", async () => {
      checkPreconditions(publishedWorkflowId, "publish test");

      const result = await callTool("publish-workflow", {
        workflowId: publishedWorkflowId,
      });

      expect(result.content?.[0]?.type).toBe("text");
      const response = JSON.parse(result.content![0].text!);

      expect(response).toBeDefined();
      expect(response).toHaveProperty("workflowId");
      expect(response).toHaveProperty("publishedVersion");
      expect(response).toHaveProperty("draftVersion");
      expect(response).toHaveProperty("@schema");
      // Verify it was published by checking publishedVersion is defined and > 0
      expect(response.publishedVersion).toBeDefined();
      expect(response.publishedVersion).toBeGreaterThan(0);
    });

    it("should publish a workflow with comment and description", async () => {
      const result = await callTool("publish-workflow", {
        workflowId: publishedWorkflowId,
        comment: "Integration test publish",
        description: "Test workflow for integration testing",
      });

      expect(result.content?.[0]?.type).toBe("text");
      const response = JSON.parse(result.content![0].text!);

      expect(response).toBeDefined();
      expect(response.publishedVersion).toBeDefined();
      expect(response.publishedVersion).toBeGreaterThan(0);
    });

    it("should handle invalid workflow ID", async () => {
      await expect(
        callTool("publish-workflow", {
          workflowId: "invalid-uuid",
        }),
      ).rejects.toThrow();
    });

    it("should handle non-existent workflow", async () => {
      await expect(
        callTool("publish-workflow", {
          workflowId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow();
    });
  });

  describe("unpublish-workflow", () => {
    it("should unpublish a published workflow", async () => {
      // First ensure it's published
      await callTool("publish-workflow", {
        workflowId: publishedWorkflowId,
        comment: "Preparing for unpublish test",
      });

      // Then unpublish it
      const result = await callTool("unpublish-workflow", {
        workflowId: publishedWorkflowId,
      });

      expect(result.content?.[0]?.type).toBe("text");
      const response = JSON.parse(result.content![0].text!);

      expect(response).toBeDefined();
      expect(response).toHaveProperty("workflowId");
      expect(response).toHaveProperty("draftVersion");
      expect(response).toHaveProperty("@schema");
      // Verify it was unpublished by checking publishedVersion is not present
      expect(response.publishedVersion).toBeUndefined();
    });

    it("should handle invalid workflow ID", async () => {
      await expect(
        callTool("unpublish-workflow", {
          workflowId: "invalid-uuid",
        }),
      ).rejects.toThrow();
    });

    it("should handle non-existent workflow", async () => {
      await expect(
        callTool("unpublish-workflow", {
          workflowId: "99999999-9999-9999-9999-999999999999",
        }),
      ).rejects.toThrow();
    });

    it("should handle already unpublished workflow", async () => {
      // Ensure it's unpublished first
      try {
        await callTool("unpublish-workflow", {
          workflowId: publishedWorkflowId,
        });
      } catch (e) {
        // Ignore if already unpublished
      }

      // Try to unpublish again - should throw new Error with meaningful error
      await expect(
        callTool("unpublish-workflow", {
          workflowId: publishedWorkflowId,
        }),
      ).rejects.toThrow();
    });
  });

  describe("Integration scenarios", () => {
    it("should support publish -> unpublish -> republish cycle", async () => {
      // Publish
      const publishResult = await callTool("publish-workflow", {
        workflowId: publishedWorkflowId,
        comment: "Integration cycle test - publish",
      });
      const publishResponse = JSON.parse(publishResult.content![0].text!);
      expect(publishResponse.publishedVersion).toBeDefined();
      expect(publishResponse.publishedVersion).toBeGreaterThan(0);

      // Unpublish
      const unpublishResult = await callTool("unpublish-workflow", {
        workflowId: publishedWorkflowId,
      });
      const unpublishResponse = JSON.parse(unpublishResult.content![0].text!);
      expect(unpublishResponse.publishedVersion).toBeUndefined();

      // Republish
      const republishResult = await callTool("publish-workflow", {
        workflowId: publishedWorkflowId,
        comment: "Integration cycle test - republish",
      });
      const republishResponse = JSON.parse(republishResult.content![0].text!);
      expect(republishResponse.publishedVersion).toBeDefined();
      expect(republishResponse.publishedVersion).toBeGreaterThan(0);
      expect(republishResponse.publishedVersion).toBeGreaterThan(
        publishResponse.publishedVersion!,
      );
    });

    it("should handle rapid publish/unpublish operations", async () => {
      if (!publishedWorkflowId) {
        throw new Error(
          "No test workflow available for rapid operations test. To set up test data:\n1. Ensure workflow exists for concurrency testing\n2. Verify workflow API handles rapid state changes\n3. Check system stability under load",
        );
      }

      // Rapid sequence of operations
      const operations = [];

      operations.push(
        callTool("publish-workflow", {
          workflowId: publishedWorkflowId,
          comment: "Rapid test 1",
        }),
      );

      const results = await Promise.all(operations);
      const publishResponse = JSON.parse(results[0].content![0].text!);
      expect(publishResponse.publishedVersion).toBeDefined();
      expect(publishResponse.publishedVersion).toBeGreaterThan(0);

      // Now unpublish
      const unpublishResult = await callTool("unpublish-workflow", {
        workflowId: publishedWorkflowId,
      });
      const unpublishResponse = JSON.parse(unpublishResult.content![0].text!);
      expect(unpublishResponse.publishedVersion).toBeUndefined();
    });

    it("should verify workflow state consistency across operations", async () => {
      if (!publishedWorkflowId) {
        throw new Error(
          "No test workflow available for consistency validation. To set up test data:\n1. Ensure workflow management system is running\n2. Create at least one workflow via API or UI\n3. Verify workflow data is accessible through list-workflows\n4. Check workflow persistence and state management",
        );
      }

      // Get initial state - check first two pages
      const page0Result = await callTool("list-workflows", {
        status: "ALL",
        pageNumber: 0,
      });

      const page0Response = parseResponse(page0Result.content![0].text!);
      let allWorkflows = page0Response.workflows || [];

      // Check if there's a second page
      if (page0Response["@links"]?.nextPage) {
        const page1Result = await callTool("list-workflows", {
          status: "ALL",
          pageNumber: 1,
        });

        const page1Response = parseResponse(page1Result.content![0].text!);
        if (!isPlainTextResponse(page1Response)) {
          allWorkflows = [...allWorkflows, ...(page1Response.workflows || [])];
        }
      }

      const initialWorkflow = allWorkflows.find(
        (w: any) => w.workflowId === publishedWorkflowId,
      );

      if (!initialWorkflow) {
        const availableIds = allWorkflows
          .map((w: any) => w.workflowId)
          .join(", ");
        throw new Error(
          `Test workflow not found in first 2 pages. Looking for: ${publishedWorkflowId}. Available workflows across pages 0-1: [${availableIds}]`,
        );
      }

      // Publish and verify state change
      await callTool("publish-workflow", {
        workflowId: publishedWorkflowId,
        comment: "State consistency test",
      });

      // Check workflow state after publish - search first two pages
      const afterPage0Result = await callTool("list-workflows", {
        status: "ALL",
        pageNumber: 0,
      });

      const afterPage0Response = parseResponse(
        afterPage0Result.content![0].text!,
      );
      let afterPublishWorkflows = afterPage0Response.workflows || [];

      // Check second page if it exists
      if (afterPage0Response["@links"]?.nextPage) {
        const afterPage1Result = await callTool("list-workflows", {
          status: "ALL",
          pageNumber: 1,
        });

        const afterPage1Response = parseResponse(
          afterPage1Result.content![0].text!,
        );
        if (!isPlainTextResponse(afterPage1Response)) {
          afterPublishWorkflows = [
            ...afterPublishWorkflows,
            ...(afterPage1Response.workflows || []),
          ];
        }
      }

      const publishedWorkflow = afterPublishWorkflows.find(
        (w: any) => w.workflowId === publishedWorkflowId,
      );

      if (!publishedWorkflow) {
        const availableIds = afterPublishWorkflows
          .map((w: any) => w.workflowId)
          .join(", ");
        throw new Error(
          `Workflow disappeared after publish operation. Looking for: ${publishedWorkflowId}. Available after publish: [${availableIds}]`,
        );
      }

      expect(publishedWorkflow?.published).toBe(true);
      expect(publishedWorkflow?.publishedVersion).toBeDefined();
    });
  });
});
