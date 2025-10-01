import { describe, it, expect, jest, beforeAll } from "@jest/globals";
import {
  callTool,
  parseResponse,
  isPlainTextResponse,
  QUERY_TIMEOUT,
} from "./test-utils";
import { WorkflowSummary } from "../../src/client";

// Allow long-running polling when workflows intentionally take time
jest.setTimeout(120000);

async function getAnyWorkflowId(): Promise<string | undefined> {
  try {
    const result = await callTool("list-workflows", {
      status: "ALL",
      pageNumber: 0,
    });
    const parsed = parseResponse(result.content![0].text!);
    if (!isPlainTextResponse(parsed)) {
      const workflows = parsed.workflows || [];
      return workflows[0]?.workflowId;
    }
  } catch {}
  return undefined;
}

async function getWorkflowComponents(
  workflowId: string,
): Promise<any[] | undefined> {
  // Try DEFAULT (server resolves), then fall back between PUBLISHED/DRAFT as needed
  const tryVersions = [undefined, "DRAFT", "PUBLISHED"] as const;
  for (const v of tryVersions) {
    try {
      const args: any = { workflowId };
      if (v) args.workflowVersion = v;
      const res = await callTool("get-workflow", args);
      const parsed = parseResponse(res.content![0].text!);
      if (!isPlainTextResponse(parsed)) {
        return parsed.components || [];
      }
    } catch {}
  }
  return undefined;
}

async function pollSession(
  sessionId: string,
  maxMs = 60000,
  intervalMs = 1500,
): Promise<any | undefined> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await callTool("get-session", { sessionId });
      const parsed = parseResponse(res.content![0].text!);
      if (!isPlainTextResponse(parsed)) {
        return parsed;
      }
    } catch (e) {
      // swallow transient lookup errors and keep polling
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return undefined;
}

describe("Session Tools Module Tests", () => {
  let terminatableWorkflowId: string | undefined;

  beforeAll(async () => {
    // Find a published and unpublished workflow to use for tests
    try {
      const result = await callTool("list-workflows", {
        pageNumber: 0,
        status: "ALL",
      });

      const response = parseResponse(result.content[0].text!);
      const workflows: WorkflowSummary[] = response.workflows || [];
      const terminatableWorkflow = workflows.find((x) =>
        x.name.includes("Terminatable"),
      );
      terminatableWorkflowId = terminatableWorkflow?.workflowId;

      expect(terminatableWorkflowId).toBeDefined();
    } catch (error: any) {
      throw new Error(
        `Could not fetch test workflows: ${(error as Error).message}`,
      );
    }
  }, QUERY_TIMEOUT);

  describe("list-sessions", () => {
    it("returns paginated session summaries for PROD (or an empty-state message)", async () => {
      expect(terminatableWorkflowId).toBeDefined();

      const result = await callTool("list-sessions", {
        workflowId: terminatableWorkflowId!,
        sessionMode: "PROD",
        pageNumber: 0,
      });

      // The CLI prints JSON when not TTY
      expect(result.content?.[0]?.type).toBe("text");
      const response = parseResponse(result.content![0].text!);

      // If no sessions or workflow mismatch, tool returns a plain text message
      if (isPlainTextResponse(response)) {
        expect(response.message.length).toBeGreaterThan(0);
        return;
      }

      // JSON case
      expect(response).toHaveProperty("@pageNumber", 0);
      expect(response).toHaveProperty("@hasMorePages");
      expect(typeof response["@hasMorePages"]).toBe("boolean");
      expect(response).toHaveProperty("@links");
      expect(Object.keys(response).some((k) => k.startsWith("_"))).toBe(false);

      const sessions = response.session || [];
      if (sessions.length > 0) {
        const s = sessions[0];
        expect(s).toHaveProperty("sessionId");
        expect(s).toHaveProperty("workflowId");
        expect(s).toHaveProperty("@links");
      }
    });

    it("supports TEST mode and pagination links when present", async () => {
      expect(terminatableWorkflowId).toBeDefined();

      const result = await callTool("list-sessions", {
        workflowId: terminatableWorkflowId!,
        sessionMode: "TEST",
        pageNumber: 0,
      });

      expect(result.content?.[0]?.type).toBe("text");
      const response = parseResponse(result.content![0].text!);

      if (isPlainTextResponse(response)) {
        // Accept informative message
        expect(response.message.length).toBeGreaterThan(0);
        return;
      }

      expect(response).toHaveProperty("@pageNumber", 0);
      expect(response).toHaveProperty("@hasMorePages");
      expect(response).toHaveProperty("@links");
      // If a next page exists, validate the link argument
      if (response["@links"]?.nextPage) {
        expect(response["@links"].nextPage.arguments.pageNumber).toBe(1);
      }
    });
  });

  describe("get-session", () => {
    it("returns a valid error for non-existent sessionId", async () => {
      await expect(
        callTool("get-session", {
          sessionId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow();
    });
  });

  describe("run-workflow and poll session", () => {
    it("starts a workflow and eventually returns a session result", async () => {
      expect(terminatableWorkflowId).toBeDefined();
      const components = await getWorkflowComponents(terminatableWorkflowId!);
      expect(Array.isArray(components) && components.length > 0).toBe(true);
      const componentId = components![0]?.componentId as string;
      expect(typeof componentId).toBe("string");

      const runResult = await callTool("run-workflow", {
        workflowId: terminatableWorkflowId!,
        componentId,
      });
      const runParsedResponse = parseResponse(runResult.content![0].text!);
      expect(isPlainTextResponse(runParsedResponse)).toBe(false);
      const sessionId = runParsedResponse.sessionId as string | undefined;
      expect(sessionId).toBeDefined();

      const session = await pollSession(sessionId!);
      expect(session).toBeDefined();
      expect(session).toHaveProperty("sessionId", sessionId);
      expect(session).toHaveProperty("@links");
    });
  });

  describe("terminate-entire-session", () => {
    it("returns an error for invalid sessionId", async () => {
      await expect(
        callTool("terminate-entire-session", {
          sessionId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow();
    });

    it("can terminate a waiting session for a terminatable workflow", async () => {
      expect(terminatableWorkflowId).toBeDefined();

      const components = await getWorkflowComponents(terminatableWorkflowId!);
      expect(Array.isArray(components) && components.length > 0).toBe(true);
      const componentId = components![0]?.componentId as string;
      expect(typeof componentId).toBe("string");

      const runResult = await callTool("run-workflow", {
        workflowId: terminatableWorkflowId!,
        componentId,
      });
      const runParsedResponse = parseResponse(runResult.content![0].text!);
      expect(isPlainTextResponse(runParsedResponse)).toBe(false);
      const sessionId = runParsedResponse.sessionId as string | undefined;
      expect(sessionId).toBeDefined();

      const terminateResult = await callTool("terminate-entire-session", {
        sessionId: sessionId!,
      });
      const terminateParsedResponse = parseResponse(
        terminateResult.content![0].text!,
      );
      // Expect a structured JSON response (RetryWorkflowResponse)
      expect(isPlainTextResponse(terminateParsedResponse)).toBe(false);
    });
  });

  describe("terminate-component", () => {
    it("returns an error for invalid session/component/thread", async () => {
      await expect(
        callTool("terminate-component", {
          sessionId: "00000000-0000-0000-0000-000000000000",
          componentId: "00000000-0000-0000-0000-000000000000",
          threadId: "root",
        }),
      ).rejects.toThrow();
    });

    /* it("can terminate a specific component in a waiting session", async () => {
      expect(terminatableWorkflowId).toBeDefined();

      const components = await getWorkflowComponents(terminatableWorkflowId!);
      expect(Array.isArray(components) && components.length > 0).toBe(true);
      const startComponentId = components![0].componentId as string;
      expect(typeof startComponentId).toBe("string");

      const runResult = await callTool("run-workflow", {
        workflowId: terminatableWorkflowId!,
        componentId: startComponentId,
      });
      const runParsedResponse = parseResponse(runResult.content![0].text!);
      expect(isPlainTextResponse(runParsedResponse)).toBe(false);
      const sessionId = runParsedResponse.sessionId as string | undefined;
      expect(sessionId).toBeDefined();

      const session = await pollSession(sessionId!);
      expect(session && Array.isArray(session.componentResults)).toBe(true);

      const terminateComponentResult = await callTool("terminate-component", {
        sessionId: sessionId!,
        componentId: components![1].componentId as string,
      });
      const terminateComponentParsedResponse = parseResponse(
        terminateComponentResult.content![0].text!,
      );
      expect(isPlainTextResponse(terminateComponentParsedResponse)).toBe(false);
    });*/
  });

  describe("retry-failed-component", () => {
    it("returns an error for invalid session/component/thread", async () => {
      await expect(
        callTool("retry-failed-component", {
          sessionId: "00000000-0000-0000-0000-000000000000",
          componentId: "00000000-0000-0000-0000-000000000000",
          threadId: "root",
        }),
      ).rejects.toThrow();
    });
  });
});
