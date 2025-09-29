import { describe, it, expect } from "@jest/globals";
import { relinkSessionPage } from "../../src/session-links";
import {
  PageOfSessionSummary,
  SessionSummary,
} from "../../src/client/types.gen";

describe("Session link relinking", () => {
  describe("relinkSessionPage", () => {
    it("should build session page structure with links", () => {
      const mockSessionPage: PageOfSessionSummary = {
        _embedded: [
          {
            sessionId: "session-123",
            status: "SUCCESSFUL",
            workflowId: "workflow-123",
            workflowVersion: 1,
            sessionMode: "PROD",
            startedAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:01:00Z",
            _links: {},
          } as SessionSummary,
        ],
        _pageNumber: 0,
        _lastPage: true,
        _links: {},
      };

      const result = relinkSessionPage(mockSessionPage);

      expect(result).toHaveProperty("@pageNumber", 0);
      expect(result).toHaveProperty("@hasMorePages", false);
      expect(result).toHaveProperty("@links");
      expect(result).toHaveProperty("session");
      expect(result.session[0]).toHaveProperty("@links");
      expect(result).not.toHaveProperty("@schema");
      expect(result.session[0]).not.toHaveProperty("@schema");
      // Ensure no underscore-prefixed fields leak into MCP response
      expect(Object.keys(result).some((k) => k.startsWith("_"))).toBe(false);
    });
  });
});
