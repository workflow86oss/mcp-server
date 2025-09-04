import { afterAll, describe, expect, it } from "@jest/globals";
import { callTool, isPlainTextResponse, parseResponse } from "./test-utils";

describe("Table Tools Module Tests", () => {
  let createdTableId: string | null = null;

  afterAll(async () => {
    // Clean up any created tables
    if (createdTableId) {
      try {
        // Note: There's no delete-table endpoint in the current API
        // Tables would need to be cleaned up manually if needed
      } catch (error) {
        // Cleanup failed, but don't fail the test
      }
    }
  });

  describe("list-tables", () => {
    it("should return paginated table summaries", async () => {
      const result = await callTool("list-tables", { pageNumber: 0 });

      expect(result.content).toBeDefined();
      expect(result.content?.[0]?.type).toBe("text");

      const responseText = result.content![0].text!;
      const response = parseResponse(responseText);

      // Handle case where no tables exist
      if (isPlainTextResponse(response)) {
        expect(response.message).toBeDefined();
        return;
      }

      // Validate response structure
      expect(response).toBeDefined();
      expect(response).toHaveProperty("@pageNumber");
      expect(response).toHaveProperty("@links");
      expect(response).toHaveProperty("@schema");

      const tables = response._embedded || [];
      tables.forEach((table: any) => {
        expect(table).toHaveProperty("tableId");
        expect(table).toHaveProperty("name");
        expect(typeof table.tableId).toBe("string");
        expect(typeof table.name).toBe("string");
      });
    });

    it("should handle pagination for tables", async () => {
      const result = await callTool("list-tables", { pageNumber: 0 });

      expect(result.content).toBeDefined();
      expect(result.content?.[0]?.type).toBe("text");

      const responseText = result.content![0].text!;
      const response = parseResponse(responseText);

      if (!isPlainTextResponse(response)) {
        expect(response["@pageNumber"]).toBe(0);
        expect(response).toHaveProperty("@links");

        // Test pagination structure
        if (response["@links"]?.nextPage) {
          expect(response["@links"].nextPage.arguments.pageNumber).toBe(1);
        }
      }
    });

    it("should handle empty table list", async () => {
      const result = await callTool(
        "list-tables",
        { pageNumber: 999 }, // Very high page number likely to be empty
      );

      expect(result.content).toBeDefined();
      expect(result.content?.[0]?.type).toBe("text");

      const responseText = result.content![0].text!;
      const response = parseResponse(responseText);

      if (!isPlainTextResponse(response)) {
        const tables = response._embedded || [];
        expect(Array.isArray(tables)).toBe(true);
        expect(tables.length).toBe(0);
      }
    });
  });

  describe("create-table", () => {
    it("should create a new table with columns", async () => {
      const testTableName = `Test Table ${Date.now()}`;
      const columns = [
        { columnName: "id", columnType: "VARCHAR2" },
        { columnName: "name", columnType: "VARCHAR2" },
        { columnName: "created_at", columnType: "DATETIME" },
        { columnName: "is_active", columnType: "BOOLEAN" },
      ];

      const result = await callTool("create-table", {
        tableName: testTableName,
        columns: columns,
      });

      expect(result.content).toBeDefined();
      expect(result.content?.[0]?.type).toBe("text");

      const responseText = result.content![0].text!;
      const response = parseResponse(responseText);

      if (!isPlainTextResponse(response)) {
        expect(response).toHaveProperty("tableId");
        expect(response).toHaveProperty("name");
        expect(response.name).toBe(testTableName);
        expect(typeof response.tableId).toBe("string");

        // Store for cleanup and further testing
        createdTableId = response.tableId;
      }
    });

    it("should handle invalid column types", async () => {
      await expect(
        callTool("create-table", {
          tableName: `Invalid Table ${Date.now()}`,
          columns: [{ columnName: "id", columnType: "INVALID_TYPE" }],
        }),
      ).rejects.toThrow();
    });

    it("should handle empty table name", async () => {
      const columns = [{ columnName: "id", columnType: "VARCHAR2" }];

      await expect(
        callTool("create-table", {
          tableName: "",
          columns: columns,
        }),
      ).rejects.toThrow();
    });

    it("should handle duplicate column names", async () => {
      const testTableName = `Duplicate Columns ${Date.now()}`;
      const duplicateColumns = [
        { columnName: "dupe", columnType: "VARCHAR2" },
        { columnName: "id", columnType: "VARCHAR2" },
        { columnName: "dupe", columnType: "VARCHAR2" },
      ];

      await expect(
        callTool("create-table", {
          tableName: testTableName,
          columns: duplicateColumns,
        }),
      ).rejects.toThrow();
    });
  });

  describe("get-table", () => {
    it("should return table details for existing table", async () => {
      if (!createdTableId) {
        throw new Error(
          "No test table available. Create table test must run first.",
        );
      }

      const result = await callTool("get-table", {
        tableId: createdTableId,
      });

      expect(result.content).toBeDefined();
      expect(result.content?.[0]?.type).toBe("text");

      const responseText = result.content![0].text!;
      const response = parseResponse(responseText);

      if (!isPlainTextResponse(response)) {
        expect(response).toHaveProperty("tableId");
        expect(response).toHaveProperty("name");
        expect(response).toHaveProperty("columns");
        expect(response.tableId).toBe(createdTableId);
        expect(Array.isArray(response.columns)).toBe(true);

        // Validate column structure
        response.columns.forEach((column: any) => {
          expect(column).toHaveProperty("columnName");
          expect(column).toHaveProperty("columnType");
          expect(typeof column.columnName).toBe("string");
          expect(
            ["VARCHAR2", "DATETIME", "BOOLEAN", "DECIMAL", "LIST"].includes(
              column.columnType,
            ),
          ).toBe(true);
        });
      }
    });

    it("should handle non-existent table ID", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      await expect(
        callTool("get-table", { tableId: nonExistentId }),
      ).rejects.toThrow();
    });

    it("should handle invalid table ID format", async () => {
      const invalidId = "not-a-uuid";

      await expect(
        callTool("get-table", { tableId: invalidId }),
      ).rejects.toThrow();
    });
  });
});
