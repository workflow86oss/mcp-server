import { describe, it, expect } from "@jest/globals";
import { callTool } from "./test-utils";

describe("Component Tools Module Tests", () => {
  describe("delete-component", () => {
    it("returns an error for invalid workflow/component IDs", async () => {
      await expect(
        callTool("delete-component", {
          workflowId: "00000000-0000-0000-0000-000000000000",
          componentId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow();
    });

    it("returns an error for non-UUID identifiers", async () => {
      await expect(
        callTool("delete-component", {
          workflowId: "not-a-uuid",
          componentId: "also-not-a-uuid",
        }),
      ).rejects.toThrow();
    });
  });
});
