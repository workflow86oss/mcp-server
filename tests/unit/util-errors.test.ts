import {
  getHeaderValueCaseInsensitive,
  getMaskedSecret,
  handleError,
  maskSecret,
} from "../../src/util";

describe("util: maskSecret", () => {
  it("masks empty and short strings", () => {
    expect(maskSecret(undefined)).toBe("<none>");
    expect(maskSecret("")).toBe("<none>");
    expect(maskSecret("a")).toBe("*");
    expect(maskSecret("ab")).toBe("**");
  });

  it("masks medium and long strings with patterns", () => {
    expect(maskSecret("abcdef")).toMatch(/^a\*\*\*f$/);
    expect(maskSecret("abcdefgh")).toMatch(/^a\*\*\*h$/);
    expect(maskSecret("abcdefghijkl")).toBe("abcd...ijkl");
  });
});

describe("util: getHeaderValueCaseInsensitive", () => {
  it("finds values in plain objects regardless of case", () => {
    const headers = {
      "X-API-KEY": "abc123",
      "Content-Type": "application/json",
    };
    expect(getHeaderValueCaseInsensitive(headers, "x-api-key")).toBe("abc123");
    expect(getHeaderValueCaseInsensitive(headers, "content-type")).toBe(
      "application/json",
    );
    expect(getHeaderValueCaseInsensitive(headers, "missing")).toBeUndefined();
  });

  it("works with Headers when available", () => {
    // Skip if global Headers is not available in this runtime
    // Node 20+/22 should have it, but guard just in case.
    // @ts-ignore
    if (typeof Headers === "undefined") {
      return;
    }
    // @ts-ignore
    const h = new Headers();
    // @ts-ignore
    h.set("X-API-KEY", "value123");
    // @ts-ignore
    h.set("Content-Type", "text/plain");
    expect(getHeaderValueCaseInsensitive(h, "x-api-key")).toBe("value123");
    expect(getHeaderValueCaseInsensitive(h, "content-type")).toBe("text/plain");
    expect(getHeaderValueCaseInsensitive(h, "missing")).toBeUndefined();
  });
});

describe("util: getMaskedSecret", () => {
  it("prefers header value, otherwise falls back to env", () => {
    const headers = { "x-api-key": "secret-key-1234" };
    const maskedFromHeader = getMaskedSecret(headers, "fallback", "x-api-key");
    expect(maskedFromHeader).toMatch(/\*{3}|\.\.\./); // masked

    const maskedFromEnv = getMaskedSecret({}, "fallback-secret", "x-api-key");
    expect(maskedFromEnv).toMatch(/\*{3}|<none>|\.\.\./);
  });
});

describe("util: handleError", () => {
  it("maps string with HTTP prefix to client error code (-32600)", () => {
    const res = handleError("HTTP 404 Not Found");
    expect(res.isError).toBe(true);
    expect(res.content[0].code).toBe(-32600);
    expect(res.content[0].text).toMatch(/404/);
  });

  it("maps Error instance with cause", () => {
    const err = new Error("Top");
    // @ts-ignore
    err.cause = new Error("Root cause");
    const res = handleError(err);
    expect(res.isError).toBe(true);
    expect(res.content[0].code).toBe(-32603);
    expect(res.content[0].text).toMatch(/Top/);
    expect(res.content[0].text).toMatch(/Root cause/);
  });

  it("uses httpStatus special handling for 4xx with message", () => {
    const res = handleError({ httpStatus: 400, message: "Bad request" });
    expect(res.isError).toBe(true);
    expect(res.content[0].code).toBe(-32600);
    expect(res.content[0].text).toBe("Bad request");
  });

  it("formats httpStatus with empty body into server error (-32603) including HTTP prefix", () => {
    const res = handleError({ httpStatus: 404 });
    expect(res.isError).toBe(true);
    expect(res.content[0].code).toBe(-32603);
    expect(res.content[0].text).toMatch(/^HTTP 404:/);
  });

  it("extracts messages from common API error shapes", () => {
    const shapes = [
      { error: { message: "wrapped message" } },
      { error_description: "desc" },
      { detail: "detail msg" },
      { title: "title msg" },
      { errors: [{ message: "msg1" }, { message: "msg2" }] },
    ];
    for (const s of shapes) {
      const res = handleError(s as any);
      expect(res.isError).toBe(true);
      expect(res.content[0].code).toBe(-32603);
      expect(res.content[0].text.length).toBeGreaterThan(0);
    }
  });
});

describe("util: jsonResponse", () => {
  it.skip("prints to console and returns !snip! when TTY is true", () => {
    const { jsonResponse } = require("../../src/util");
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      const res = jsonResponse({ a: 1 });
      expect(spy).toHaveBeenCalled();
      expect(res.content[0].text).toBe("!snip!");
    } finally {
      spy.mockRestore();
      // Restore
    }
  });

  it("returns serialized JSON when not a TTY", () => {
    const { jsonResponse } = require("../../src/util");
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      const res = jsonResponse({ a: 1 });
      expect(spy).not.toHaveBeenCalled();
      expect(JSON.parse(res.content[0].text)).toEqual({ a: 1 });
    } finally {
      spy.mockRestore();
    }
  });
});
