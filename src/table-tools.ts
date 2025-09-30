import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  listTables,
  createTable,
  getTableDetails,
  renameColumn,
  addColumn,
  deleteColumn,
} from "./client/sdk.gen";
import { ColumnDetails, TableDetails, TableSummary } from "./client/types.gen";
import { client } from "./client/client.gen";
import { addSchemaMetadataByType, schemaToZod } from "./schema";
import {
  textResponse,
  jsonResponse,
  handleError,
  zodPageNumber,
} from "./util.js";
import { relinkTableDetails, relinkTablePage } from "./table-links";
import {
  ColumnDetailsSchema,
  CreateColumnCommandSchema,
  CreateTableCommandSchema,
} from "./client/schemas.gen";

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

        const tables: TableSummary[] = response?.data?._embedded || [];
        if (tables.length === 0) {
          if (pageNumber === 0) {
            return textResponse("There are no tables defined for this client");
          } else {
            return textResponse("This page contains no additional tables");
          }
        }

        return jsonResponse(
          addSchemaMetadataByType(
            relinkTablePage(response.data),
            "PageOfTableSummary",
          ),
        );
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "get-table",
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
          path: {
            tableId: tableId,
          },
        });

        const tableDetails = response.data as TableDetails;

        // Add schema metadata
        const resultWithSchema = addSchemaMetadataByType(
          relinkTableDetails(tableDetails),
          "TableDetails",
        );

        return jsonResponse(resultWithSchema);
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "create-table",
    "Create a new Table with the given name and columns",
    {
      tableName: schemaToZod(CreateTableCommandSchema.properties.tableName),
      columns: z.array(
        z.object({
          columnName: schemaToZod(ColumnDetailsSchema.properties.columnName),
          columnType: schemaToZod(ColumnDetailsSchema.properties.columnType),
        }),
      ),
    },
    async ({ tableName, columns }) => {
      try {
        const response = await createTable({
          client: client,
          throwOnError: true,
          body: {
            tableName,
            columns: columns as Array<ColumnDetails>,
          },
        });

        const tableDetails = response.data as TableDetails;

        // Add schema metadata
        const resultWithSchema = addSchemaMetadataByType(
          relinkTableDetails(tableDetails),
          "TableDetails",
        );

        return jsonResponse(resultWithSchema);
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "add-column",
    "Add a column to an existing table.",
    {
      tableId: z
        .string()
        .describe("The UUID identifier of the table to add to"),
      name: z.string().describe("The name of the column to add"),
      type: schemaToZod(CreateColumnCommandSchema.properties.columnType),
    },
    async ({ tableId, name, type }) => {
      try {
        const response = await addColumn({
          client: client,
          throwOnError: true,
          path: {
            tableId,
          },
          body: {
            columnName: name,
            columnType: type,
          },
        });

        const tableDetails = response.data as TableDetails;

        const resultWithSchema = addSchemaMetadataByType(
          relinkTableDetails(tableDetails),
          "TableDetails",
        );

        return jsonResponse(resultWithSchema);
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "rename-column",
    "Rename a column in an existing table.",
    {
      tableId: z.string().describe("The UUID identifier of the table to edit"),
      originalColumnName: z
        .string()
        .describe("The name of the existing column to rename"),
      newColumnName: z.string().describe("The new name for the column"),
    },
    async ({ tableId, originalColumnName, newColumnName }) => {
      try {
        const response = await renameColumn({
          client: client,
          throwOnError: true,
          path: {
            tableId,
            originalColumnName,
          },
          query: {
            newColumnName,
          },
        });

        const tableDetails = response.data as TableDetails;

        // Add schema metadata
        const resultWithSchema = addSchemaMetadataByType(
          relinkTableDetails(tableDetails),
          "TableDetails",
        );

        return jsonResponse(resultWithSchema);
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.tool(
    "delete-column",
    "Delete a column from an existing table.",
    {
      tableId: z.string().describe("The UUID identifier of the table to edit"),
      columnName: z.string().describe("The name of the column to delete"),
    },
    async ({ tableId, columnName }) => {
      try {
        const response = await deleteColumn({
          client: client,
          throwOnError: true,
          path: {
            tableId,
            columnName,
          },
        });

        const tableDetails = response.data as TableDetails;

        // Add schema metadata
        const resultWithSchema = addSchemaMetadataByType(
          relinkTableDetails(tableDetails),
          "TableDetails",
        );

        return jsonResponse(resultWithSchema);
      } catch (error) {
        return handleError(error);
      }
    },
  );
}
