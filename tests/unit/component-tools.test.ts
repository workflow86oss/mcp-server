import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { registerComponentTools } from "../../src/component-tools";

// Mock deleteComponent API
jest.mock("../../src/client", () => {
  const fn = (jest.fn() as any).mockResolvedValue(undefined);
  return { deleteComponent: fn };
});

const { deleteComponent } = require("../../src/client");

describe("component-tools", () => {
  beforeEach(() => {
    (deleteComponent as jest.Mock).mockClear();
  });

  it("registers delete-component and returns confirmation text", async () => {
    const registered: any[] = [];
    const fakeServer: any = {
      tool: (name: string, _desc: string, _schema: any, cb: Function) => {
        registered.push({ name, cb });
      },
    };

    registerComponentTools(fakeServer);
    const entry = registered.find((r) => r.name === "delete-component");
    expect(entry).toBeDefined();

    const result = await entry.cb({ workflowId: "w-1", componentId: "c-1" });
    expect(deleteComponent).toHaveBeenCalledWith({
      path: { workflowId: "w-1", componentId: "c-1" },
    });
    expect(result).toEqual({
      content: [{ type: "text", text: "Component componentId deleted" }],
    });
  });
});
