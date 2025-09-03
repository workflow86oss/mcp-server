import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listTables, createTable, getTableDetails } from "./client/sdk.gen.js";
import {
  TableSummary,
  TableDetails,
  PageOfTableSummary,
} from "./client/types.gen.js";
import { client } from "./client/client.gen.js";
import { addSchemaMetadataByType, createSchemaDescriber } from "./schema";
import {
  textResponse,
  jsonResponse,
  handleError,
  zodPageNumber,
} from "./util.js";

export function registerTableTools(server: McpServer) {
  server.tool(
    "list-tables",
    "Get a paginated list of all tables for the authenticated client. Returns table summaries including table IDs, names, and pagination controls for browsing through all available tables.",
    {
      pageNumber: zodPageNumber,
    },
    async ({ pageNumber = 0 }) => {
      try {
        const response = await listTables({
          client: client,
          throwOnError: true,
          query: { pageNumber },
        });

        if (!response.data) {
          return textResponse("No tables found");
        }

        const page = response.data as PageOfTableSummary;

        // Rename _embedded to tables for consistency
        const result = {
          ...page,
          tables: page._embedded,
        };
        delete (result as any)._embedded;

        // Add schema metadata
        const resultWithSchema = addSchemaMetadataByType(
          result,
          "PageOfTableSummary",
          "tables",
        );

        return jsonResponse(resultWithSchema);
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "create-table",
    "Create a new table with the specified name and column definitions. Column types must be one of: VARCHAR2, DECIMAL, BOOLEAN, DATETIME, LIST. Returns the created table details including the generated table ID.",
    {
      tableName: z.string().describe("The name for the new table"),
      columns: z
        .array(
          z.object({
            columnName: z.string().describe("The name of the column"),
            columnType: z
              .enum(["VARCHAR2", "DECIMAL", "BOOLEAN", "DATETIME", "LIST"])
              .describe("The data type of the column"),
          }),
        )
        .describe("Array of column definitions for the table"),
    },
    async ({ tableName, columns }) => {
      try {
        const response = await createTable({
          client: client,
          throwOnError: true,
          body: {
            tableName,
            columns,
          },
        });

        if (!response.data) {
          return textResponse("Table creation failed");
        }

        const tableDetails = response.data as TableDetails;

        // Add schema metadata
        const resultWithSchema = addSchemaMetadataByType(
          tableDetails,
          "TableDetails",
        );

        return jsonResponse(resultWithSchema);
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "get-table-details",
    "Retrieve detailed information about a specific table including its ID, name, and complete column definitions. Provides the full schema and metadata for the specified table.",
    {
      tableId: z
        .string()
        .describe("The UUID identifier of the table to retrieve"),
    },
    async ({ tableId }) => {
      try {
        const response = await getTableDetails({
          client: client,
          throwOnError: true,
          query: {
            tableId: tableId,
          },
        });

        if (!response.data) {
          return textResponse(`Table with ID ${tableId} not found`);
        }

        const tableDetails = response.data as TableDetails;

        // Add schema metadata
        const resultWithSchema = addSchemaMetadataByType(
          tableDetails,
          "TableDetails",
        );

        return jsonResponse(resultWithSchema);
      } catch (error) {
        return handleError(error);
      }
    },
  );
}
