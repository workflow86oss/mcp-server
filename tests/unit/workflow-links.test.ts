import { describe, it, expect } from "@jest/globals";
import {
  relinkWorkflowPage,
  relinkWorkflowHistoryPage,
  relinkWorkflowVersion,
} from "../../src/workflow-links";
import {
  PageOfWorkflowSummary,
  PageOfWorkflowHistory,
  WorkflowVersionDetails,
  WorkflowSummary,
  WorkflowHistory,
} from "../../src/client/types.gen";

describe("Workflow link relinking", () => {
  describe("relinkWorkflowPage", () => {
    it("should build workflow page structure with links", () => {
      const mockPage: PageOfWorkflowSummary = {
        _embedded: [
          {
            workflowId: "123",
            name: "Test Workflow",
            description: "Test Description",
            published: true,
            draftVersion: 1,
            publishedVersion: 1,
            _links: {},
          } as WorkflowSummary,
        ],
        _pageNumber: 0,
        _lastPage: true,
        _links: {},
      };

      const result = relinkWorkflowPage(mockPage);

      expect(result).toHaveProperty("workflows");
      expect(result).toHaveProperty("@pageNumber", 0);
      expect(result).toHaveProperty("@links");
      expect(result.workflows[0]).toHaveProperty("@links");
      expect(result).not.toHaveProperty("@schema");
      expect(result.workflows[0]).not.toHaveProperty("@schema");
    });

    it("should handle pagination links correctly", () => {
      const mockPage: PageOfWorkflowSummary = {
        _embedded: [],
        _pageNumber: 1,
        _lastPage: false,
        _links: {},
      };

      const result = relinkWorkflowPage(mockPage);

      expect(result["@links"]).toHaveProperty("previousPage");
      expect(result["@links"]).toHaveProperty("nextPage");
      expect(result["@links"].previousPage.arguments.pageNumber).toBe(0);
      expect(result["@links"].nextPage.arguments.pageNumber).toBe(2);
    });
  });

  describe("relinkWorkflowVersion", () => {
    it("should include links on workflow version details, without schema", () => {
      const mockWorkflow: WorkflowVersionDetails = {
        workflowId: "123",
        version: 1,
        status: "PUBLISHED",
        name: "Test Workflow",
        description: "Test Description",
        workflowAppViewUrl: "https://example.com/workflow/blah",
        components: [],
        tables: [],
        _links: {},
      };

      const result = relinkWorkflowVersion(mockWorkflow);
      expect(result).toHaveProperty("@links");
      expect(result).not.toHaveProperty("@schema");
    });
  });

  describe("relinkWorkflowHistoryPage", () => {
    it("should build workflow history page structure with links", () => {
      const mockHistoryPage: PageOfWorkflowHistory = {
        _embedded: [
          {
            version: 1,
            status: "PUBLISHED",
            name: "Test Version",
            description: "Test Description",
            publishedAt: "2024-01-01T00:00:00Z",
            _links: {},
          } as WorkflowHistory,
        ],
        _pageNumber: 0,
        _lastPage: true,
        _links: {},
      };

      const result = relinkWorkflowHistoryPage("workflow-123", mockHistoryPage);

      expect(result).toHaveProperty("workflowId", "workflow-123");
      expect(result).toHaveProperty("history");
      expect(result).toHaveProperty("@links");
      expect(result).toHaveProperty("@pageNumber", 0);
      expect(result.history[0]).toHaveProperty("@links");
      expect(result).not.toHaveProperty("@schema");
      expect(result.history[0]).not.toHaveProperty("@schema");
    });
  });
});
