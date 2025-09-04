import { PageOfTableSummary, TableDetails, TableSummary } from "./client";
import { addSchemaMetadataByType } from "./schema";
import { PageOfTableSummarySchema } from "./client/schemas.gen";
import { ToolCall } from "./links";

export function relinkTablePage(page: PageOfTableSummary): Record<string, any> {
  const links: Record<string, ToolCall> = {};
  if (page._pageNumber > 0) {
    links.previousPage = {
      name: "list-tables",
      arguments: {
        pageNumber: page._pageNumber - 1,
      },
    };
  }
  if (!page._lastPage) {
    links.nextPage = {
      name: "list-tables",
      arguments: {
        pageNumber: page._pageNumber + 1,
      },
    };
  }
  return addSchemaMetadataByType(
    {
      tables: page._embedded.map(relinkTableSummary),
      "@pageNumber": page._pageNumber,
      "@links": links,
    },
    PageOfTableSummarySchema,
    "tables",
  );
}

export function relinkTableSummary(
  table: TableSummary | TableDetails,
): Record<string, any> {
  const links: Record<string, ToolCall> = {};
  links["table-details"] = {
    name: "get-table",
    arguments: {
      tableId: table.tableId,
    },
  };

  const { _links, ...result } = table;
  return {
    ...result,
    "@links": links,
  };
}

export function relinkTableDetails(table: TableDetails): Record<string, any> {
  const result = relinkTableSummary(table);

  result["@links"]["add-column"] = {
    name: "add-column",
    arguments: {
      tableId: table.tableId,
    },
  };
  result["@links"]["rename-column"] = {
    name: "rename-column",
    arguments: {
      tableId: table.tableId,
      originalColumnName: "{originalColumnName}",
      newColumnName: "{newColumnName}",
    },
  };
  result["@links"]["delete-column"] = {
    name: "delete-column",
    arguments: {
      tableId: table.tableId,
    },
  };

  return result;
}
