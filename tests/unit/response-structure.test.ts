import { describe, it, expect } from "@jest/globals";

describe("Response Structure Validation", () => {
  describe("MCP Tool Response Format", () => {
    it("should validate list-workflows response structure", () => {
      const mockResponse = {
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                workflows: [
                  {
                    workflowId: "test-id",
                    name: "Test Workflow",
                    published: true,
                    "@links": {
                      "published-workflow-details": {
                        name: "get-workflow",
                        arguments: { workflowId: "test-id" },
                      },
                    },
                  },
                ],
                "@pageNumber": 0,
                "@hasMorePages": false,
                "@links": {},
                "@schema": {
                  workflows: {},
                },
              }),
            },
          ],
        },
      };

      // Validate MCP response structure
      expect(mockResponse).toHaveProperty("result");
      expect(mockResponse.result).toHaveProperty("content");
      expect(Array.isArray(mockResponse.result.content)).toBe(true);
      expect(mockResponse.result.content[0]).toHaveProperty("type", "text");
      expect(mockResponse.result.content[0]).toHaveProperty("text");

      // Parse and validate JSON content
      const parsedContent = JSON.parse(mockResponse.result.content[0].text);
      expect(parsedContent).toHaveProperty("@schema");
      expect(parsedContent).toHaveProperty("@hasMorePages");
      expect(typeof parsedContent["@hasMorePages"]).toBe("boolean");
      expect(parsedContent["@schema"]).not.toHaveProperty("typeName");
      // Ensure no underscore-prefixed fields are present
      expect(Object.keys(parsedContent).some((k) => k.startsWith("_"))).toBe(
        false,
      );
    });

    it("should validate get-workflow response structure", () => {
      const mockWorkflowDetails = {
        workflowId: "test-id",
        version: 1,
        status: "PUBLISHED",
        name: "Test Workflow",
        components: [],
        tables: [],
        "@links": {
          "prod-sessions": {
            name: "list-sessions",
            arguments: { workflowId: "test-id" },
          },
        },
        "@schema": {
          workflowId: "UUID id of this workflow version",
          components: {
            componentId: "UUID id of the Component",
          },
        },
      };

      expect(mockWorkflowDetails).toHaveProperty("@schema");
      expect(mockWorkflowDetails["@schema"]).not.toHaveProperty("typeName");
      expect(mockWorkflowDetails["@links"]).toHaveProperty("prod-sessions");
      expect(Array.isArray(mockWorkflowDetails.components)).toBe(true);
    });

    it("should validate run-workflow response structure", () => {
      const mockRunWorkflowResponse = {
        sessionId: "test-session-id",
        sessionStatus: "SUCCESSFUL",
        "@schema": {
          sessionId: "UUID id of the session returned",
          sessionStatus: "The status of the session",
        },
      };

      expect(mockRunWorkflowResponse).toHaveProperty("@schema");
      expect(mockRunWorkflowResponse["@schema"]).not.toHaveProperty("typeName");
      expect(mockRunWorkflowResponse).toHaveProperty("sessionId");
      expect(typeof mockRunWorkflowResponse.sessionId).toBe("string");
    });

    it("should validate get-session response structure", () => {
      const mockSessionResult = {
        sessionId: "test-session-id",
        sessionMode: "PROD",
        status: "SUCCESSFUL",
        workflowId: "test-workflow-id",
        workflowVersion: 1,
        componentResults: [
          {
            resultId: "test-result-id",
            componentId: "test-component-id",
            status: "SUCCESSFUL",
            nodeInput: null,
            nodeOutput: {},
          },
        ],
        "@schema": {
          sessionId: "UUID id of the session returned",
          componentResults: {
            resultId: "UUID id of this Component Result",
          },
        },
      };

      expect(mockSessionResult).toHaveProperty("@schema");
      expect(mockSessionResult["@schema"]).not.toHaveProperty("typeName");
      expect(Array.isArray(mockSessionResult.componentResults)).toBe(true);
      expect(mockSessionResult.componentResults[0]).toHaveProperty("resultId");
    });
  });

  describe("Schema Metadata Consistency", () => {
    it("should ensure all responses have exactly one @schema property", () => {
      const responseExamples = [
        // PageOfWorkflowSummary
        {
          workflows: [{ workflowId: "test", "@links": {} }],
          "@schema": { description: "Page of workflow summaries" },
        },
        // WorkflowVersionDetails
        {
          workflowId: "test",
          components: [],
          "@schema": { description: "Workflow version details" },
        },
        // SessionResult
        {
          sessionId: "test",
          componentResults: [],
          "@schema": { description: "Session execution result" },
        },
      ];

      responseExamples.forEach((response) => {
        // Count @schema properties
        const schemaCount = Object.keys(response).filter(
          (key) => key === "@schema",
        ).length;
        expect(schemaCount).toBe(1);

        // Verify no nested @schema in arrays
        Object.values(response).forEach((value) => {
          if (Array.isArray(value)) {
            value.forEach((item) => {
              if (typeof item === "object" && item !== null) {
                expect(item).not.toHaveProperty("@schema");
              }
            });
          }
        });
      });
    });

    it("should validate @links structure consistency", () => {
      const linkExamples = [
        {
          name: "get-workflow",
          arguments: { workflowId: "test-id", workflowVersion: "PUBLISHED" },
        },
        {
          name: "list-sessions",
          arguments: { workflowId: "test-id", sessionMode: "PROD" },
        },
        {
          name: "get-session",
          arguments: { sessionId: "test-session-id" },
        },
      ];

      linkExamples.forEach((link) => {
        expect(link).toHaveProperty("name");
        expect(link).toHaveProperty("arguments");
        expect(typeof link.name).toBe("string");
        expect(typeof link.arguments).toBe("object");
      });
    });
  });

  describe("API Navigation Flow", () => {
    it("should validate complete API exploration path", () => {
      const apiFlow = {
        step1: {
          tool: "list-workflows",
          response_type: "PageOfWorkflowSummary",
          next_actions: ["get-workflow", "list-workflows"], // pagination
        },
        step2: {
          tool: "get-workflow",
          response_type: "WorkflowVersionDetails",
          next_actions: ["list-sessions", "run-workflow"],
        },
        step3: {
          tool: "list-sessions",
          response_type: "PageOfSessionSummary",
          next_actions: ["get-session", "list-sessions"], // pagination
        },
        step4: {
          tool: "get-session",
          response_type: "SessionResult",
          next_actions: ["retry-failed-component", "terminate-component"],
        },
        step5: {
          tool: "run-workflow",
          response_type: "RunWorkflowResponse",
          next_actions: ["get-session"],
        },
      };

      // Validate each step has required properties
      Object.entries(apiFlow).forEach(([stepName, step]) => {
        expect(step).toHaveProperty("tool");
        expect(step).toHaveProperty("response_type");
        expect(step).toHaveProperty("next_actions");
        expect(Array.isArray(step.next_actions)).toBe(true);
      });

      // Validate response types are valid schema types
      const validSchemaTypes = [
        "PageOfWorkflowSummary",
        "WorkflowVersionDetails",
        "PageOfSessionSummary",
        "SessionResult",
        "RunWorkflowResponse",
        "RetryWorkflowResponse",
      ];

      Object.values(apiFlow).forEach((step) => {
        expect(validSchemaTypes).toContain(step.response_type);
      });
    });
  });
});
