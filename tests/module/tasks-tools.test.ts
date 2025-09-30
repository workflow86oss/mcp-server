import { describe, it, expect, jest } from "@jest/globals";
import { callTool, parseResponse, isPlainTextResponse } from "./test-utils";

describe("Tasks Tools Module Tests", () => {
  /*
    describe("list-forms", () => {
      it("returns paginated forms or an empty-state message", async () => {
        const result = await callTool("list-forms", { pageNumber: 0 });

        expect(result.content?.[0]?.type).toBe("text");
        const response = parseResponse(result.content![0].text!);

        if (isPlainTextResponse(response)) {
          // Accept informative message like "There are no forms available for this user"
          expect(typeof response.message).toBe("string");
          expect(response.message.length).toBeGreaterThan(0);
          return;
        }

        // JSON case (raw API shape)
        expect(response).toHaveProperty("_pageNumber");
        expect(response).toHaveProperty("_lastPage");
        const forms = response._embedded || [];
        expect(Array.isArray(forms)).toBe(true);
      });

      it("handles next page or returns an informative empty message", async () => {
        // Start at page 0 to determine paging behavior
        const first = await callTool("list-forms", { pageNumber: 0 });
        expect(first.content?.[0]?.type).toBe("text");
        const firstParsed = parseResponse(first.content![0].text!);

        if (isPlainTextResponse(firstParsed)) {
          // Accept informative plain-text for empty-state
          expect(typeof firstParsed.message).toBe("string");
          expect(firstParsed.message.length).toBeGreaterThan(0);
          return;
        }

        // If JSON, try the immediate next page rather than an arbitrarily high page
        const nextPage = (firstParsed._pageNumber ?? 0) + 1;
        const second = await callTool("list-forms", { pageNumber: nextPage });
        expect(second.content?.[0]?.type).toBe("text");
        const secondParsed = parseResponse(second.content![0].text!);

        if (isPlainTextResponse(secondParsed)) {
          // Accept informative message such as "This page contains no additional forms"
          expect(typeof secondParsed.message).toBe("string");
          expect(secondParsed.message.length).toBeGreaterThan(0);
          return;
        }

        const forms = secondParsed._embedded || [];
        expect(Array.isArray(forms)).toBe(true);
      });
    });*/

  describe("list-tasks", () => {
    it("returns a filtered task list or informative message", async () => {
      const result = await callTool("list-tasks", {
        statusToInclude: ["TODO"],
      });

      expect(result.content?.[0]?.type).toBe("text");
      const response = parseResponse(result.content![0].text!);

      if (isPlainTextResponse(response)) {
        // Accept messages like "🎉 All tasks completed!" or empty state
        expect(typeof response.message).toBe("string");
        expect(response.message.length).toBeGreaterThan(0);
        return;
      }

      // JSON case (raw API shape)
      expect(response).toHaveProperty("_pageNumber");
      expect(response).toHaveProperty("_lastPage");
      const tasks = response._embedded || [];
      expect(Array.isArray(tasks)).toBe(true);
    });

    it("accepts pagination tokens or yields empty page/message", async () => {
      // Supply a syntactically valid but likely non-existent token
      const token = "2023-01-01T00:00:00Z:00000000-0000-0000-0000-000000000000";
      const result = await callTool("list-tasks", { lastTaskToken: token });

      expect(result.content?.[0]?.type).toBe("text");
      const response = parseResponse(result.content![0].text!);

      if (!isPlainTextResponse(response)) {
        const tasks = response._embedded || [];
        expect(Array.isArray(tasks)).toBe(true);
      }
    });
  });
});
