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

export function errorResponse(code: number, message: string) {
  return {
    isError: true as const,
    content: [
      {
        type: "text" as const,
        text: message,
        code: code,
      },
    ],
  };
}

export function jsonResponse(result: object) {
  const text = JSON.stringify(result, null, 2);
  if (process.stdout.isTTY) {
    console.log(text);
    return textResponse("!snip!");
  } else {
    return textResponse(text);
  }
}

export function handleError(error: any) {
  if (error.httpStatus) {
    if (error.httpStatus >= 400 && error.httpStatus < 500 && error.message) {
      return errorResponse(-32600, error.message);
    } else {
      return errorResponse(
        -32603,
        `An unexpected HTTP ${error.httpStatus} error occurred: ${error?.message || JSON.stringify(error)}`,
      );
    }
  } else if (error instanceof Error) {
    console.error(error.name, error.message, error.stack);
    return errorResponse(
      -32603,
      `An unexpected error occurred: ${error.message}`,
    );
  } else {
    return errorResponse(
      -32603,
      `An unexpected failure occurred: ${error?.message || JSON.stringify(error)}`,
    );
  }
}
