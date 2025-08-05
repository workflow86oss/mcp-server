import { z } from "zod";

export const zodPageNumber = z
  .number()
  .default(0)
  .describe("The zero-indexed page number of the response data");

export function textResponse(text: string) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
  };
}

export function jsonResponse(result: object) {
  const text = JSON.stringify(result, null, 2);
  if (process.stdout.isTTY) {
    console.error(text);
  }
  return textResponse(text);
}

export function handleError(error: any) {
  if (error.httpStatus) {
    return textResponse(
      `An unexpected HTTP ${error.httpStatus} error occurred: ${error?.message || JSON.stringify(error)}`,
    );
  } else if (error instanceof Error) {
    console.error(error.name, error.message, error.stack);
    return textResponse(`An unexpected error occurred: ${error.message}`);
  } else {
    return textResponse(
      `An unexpected failure occurred: ${error?.message || error?.toString() || JSON.stringify(error)}`,
    );
  }
}
