/*
This class provides functionality related to removing HATEOAS metadata (_links, _pageNumber, _lastPage...) from Public API Responses and replacing them
with MCP Tool Call style @links, @pageNumber, @hasMorePages etc.

It's perfectly fine to either parse required information out of the HATEOAS _links or from the response (although the
response is weakly preferred as it is less likely to evolve).

We are using an informal standard to represent tool calls, but we haven't had any issues with MCP clients grokking responses.
*/
export class ToolCall {
  name: string;
  arguments: Record<string, any>;

  constructor(name: string, argumints: Record<string, any>) {
    this.name = name;
    this.arguments = argumints;
  }
}
