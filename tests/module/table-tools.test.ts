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
          tableName: " ",
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

  describe("add-column", () => {
    it("should add a new column to an existing table", async () => {
      if (!createdTableId) {
        throw new Error(
          "No test table available. Create table test must run first.",
        );
      }

      const result = await callTool("add-column", {
        tableId: createdTableId,
        name: "new_test_column",
        type: "VARCHAR2",
      });

      expect(result.content).toBeDefined();
      expect(result.content?.[0]?.type).toBe("text");

      const responseText = result.content![0].text!;
      const response = parseResponse(responseText);

      if (!isPlainTextResponse(response)) {
        expect(response).toHaveProperty("tableId");
        expect(response.tableId).toBe(createdTableId);
        expect(response).toHaveProperty("columns");
        expect(Array.isArray(response.columns)).toBe(true);

        // Check that the new column was added
        const newColumn = response.columns.find(
          (col: any) => col.columnName === "new_test_column",
        );
        expect(newColumn).toBeDefined();
        expect(newColumn.columnType).toBe("VARCHAR2");
      }
    });

    it("should handle adding different column types", async () => {
      if (!createdTableId) {
        throw new Error(
          "No test table available. Create table test must run first.",
        );
      }

      const columnTypes = ["DATETIME", "BOOLEAN", "DECIMAL"];

      for (const columnType of columnTypes) {
        const columnName = `test_${columnType.toLowerCase()}_col`;
        const result = await callTool("add-column", {
          tableId: createdTableId,
          name: columnName,
          type: columnType,
        });

        expect(result.content).toBeDefined();
        const responseText = result.content![0].text!;
        const response = parseResponse(responseText);

        if (!isPlainTextResponse(response)) {
          const addedColumn = response.columns.find(
            (col: any) => col.columnName === columnName,
          );
          expect(addedColumn).toBeDefined();
          expect(addedColumn.columnType).toBe(columnType);
        }
      }
    });

    it("should handle adding column with duplicate name", async () => {
      if (!createdTableId) {
        throw new Error(
          "No test table available. Create table test must run first.",
        );
      }

      await expect(
        callTool("add-column", {
          tableId: createdTableId,
          name: "id", // This should already exist from table creation
          type: "VARCHAR2",
        }),
      ).rejects.toThrow(/Column names must be unique/i);
    });

    it("should handle invalid table ID", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      await expect(
        callTool("add-column", {
          tableId: nonExistentId,
          name: "test_column",
          type: "VARCHAR2",
        }),
      ).rejects.toThrow(/not found/i);
    });

    it("should handle invalid column type", async () => {
      if (!createdTableId) {
        throw new Error(
          "No test table available. Create table test must run first.",
        );
      }

      await expect(
        callTool("add-column", {
          tableId: createdTableId,
          name: "invalid_type_column",
          type: "INVALID_TYPE",
        }),
      ).rejects.toThrow(/invalid.*type/i);
    });

    it("should handle empty column name", async () => {
      if (!createdTableId) {
        throw new Error(
          "No test table available. Create table test must run first.",
        );
      }

      await expect(
        callTool("add-column", {
          tableId: createdTableId,
          name: " ",
          type: "VARCHAR2",
        }),
      ).rejects.toThrow(/must not be blank/i);
    });
  });

  describe("rename-column", () => {
    it("should rename an existing column", async () => {
      if (!createdTableId) {
        throw new Error(
          "No test table available. Create table test must run first.",
        );
      }

      const result = await callTool("rename-column", {
        tableId: createdTableId,
        originalColumnName: "name", // Original column from table creation
        newColumnName: "full_name",
      });

      expect(result.content).toBeDefined();
      expect(result.content?.[0]?.type).toBe("text");

      const responseText = result.content![0].text!;
      const response = parseResponse(responseText);

      if (!isPlainTextResponse(response)) {
        expect(response).toHaveProperty("tableId");
        expect(response.tableId).toBe(createdTableId);
        expect(response).toHaveProperty("columns");
        expect(Array.isArray(response.columns)).toBe(true);

        // Check that the column was renamed
        const renamedColumn = response.columns.find(
          (col: any) => col.columnName === "full_name",
        );
        expect(renamedColumn).toBeDefined();

        // Check that the old name is gone
        const oldColumn = response.columns.find(
          (col: any) => col.columnName === "name",
        );
        expect(oldColumn).toBeUndefined();
      }
    });

    it("should handle renaming non-existent column", async () => {
      if (!createdTableId) {
        throw new Error(
          "No test table available. Create table test must run first.",
        );
      }

      await expect(
        callTool("rename-column", {
          tableId: createdTableId,
          originalColumnName: "non_existent_column",
          newColumnName: "new_name",
        }),
      ).rejects.toThrow(/not found/i);
    });

    it("should handle renaming to existing column name", async () => {
      if (!createdTableId) {
        throw new Error(
          "No test table available. Create table test must run first.",
        );
      }

      await expect(
        callTool("rename-column", {
          tableId: createdTableId,
          originalColumnName: "full_name", // From previous rename test
          newColumnName: "id", // This should already exist
        }),
      ).rejects.toThrow(/must be unique/i);
    });

    it("should handle invalid table ID for rename column", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      await expect(
        callTool("rename-column", {
          tableId: nonExistentId,
          originalColumnName: "test_column",
          newColumnName: "renamed_column",
        }),
      ).rejects.toThrow(/not found/i);
    });

    it("should handle empty column names", async () => {
      if (!createdTableId) {
        throw new Error(
          "No test table available. Create table test must run first.",
        );
      }

      await expect(
        callTool("rename-column", {
          tableId: createdTableId,
          originalColumnName: " ",
          newColumnName: "new_name",
        }),
      ).rejects.toThrow(/must not be blank/i);

      await expect(
        callTool("rename-column", {
          tableId: createdTableId,
          originalColumnName: "full_name",
          newColumnName: " ",
        }),
      ).rejects.toThrow(/must not be blank/i);
    });
  });

  describe("delete-column", () => {
    it("should delete an existing column", async () => {
      if (!createdTableId) {
        throw new Error(
          "No test table available. Create table test must run first.",
        );
      }

      const result = await callTool("delete-column", {
        tableId: createdTableId,
        columnName: "new_test_column", // Column added in add-column test
      });

      expect(result.content).toBeDefined();
      expect(result.content?.[0]?.type).toBe("text");

      const responseText = result.content![0].text!;
      const response = parseResponse(responseText);

      if (!isPlainTextResponse(response)) {
        expect(response).toHaveProperty("tableId");
        expect(response.tableId).toBe(createdTableId);
        expect(response).toHaveProperty("columns");
        expect(Array.isArray(response.columns)).toBe(true);

        // Check that the column was deleted
        const deletedColumn = response.columns.find(
          (col: any) => col.columnName === "new_test_column",
        );
        expect(deletedColumn).toBeUndefined();
      }
    });

    it("should delete multiple columns sequentially", async () => {
      if (!createdTableId) {
        throw new Error(
          "No test table available. Create table test must run first.",
        );
      }

      const columnsToDelete = [
        "test_datetime_col",
        "test_boolean_col",
        "test_decimal_col",
      ];

      for (const columnName of columnsToDelete) {
        const result = await callTool("delete-column", {
          tableId: createdTableId,
          columnName: columnName,
        });

        expect(result.content).toBeDefined();
        const responseText = result.content![0].text!;
        const response = parseResponse(responseText);

        if (!isPlainTextResponse(response)) {
          const deletedColumn = response.columns.find(
            (col: any) => col.columnName === columnName,
          );
          expect(deletedColumn).toBeUndefined();
        }
      }
    });

    it("should handle deleting non-existent column", async () => {
      if (!createdTableId) {
        throw new Error(
          "No test table available. Create table test must run first.",
        );
      }

      await expect(
        callTool("delete-column", {
          tableId: createdTableId,
          columnName: "non_existent_column",
        }),
      ).rejects.toThrow(/not found/i);
    });

    it("should handle invalid table ID for delete column", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      await expect(
        callTool("delete-column", {
          tableId: nonExistentId,
          columnName: "test_column",
        }),
      ).rejects.toThrow(/not found/i);
    });

    it("should handle empty column name", async () => {
      if (!createdTableId) {
        throw new Error(
          "No test table available. Create table test must run first.",
        );
      }

      await expect(
        callTool("delete-column", {
          tableId: createdTableId,
          columnName: " ",
        }),
      ).rejects.toThrow(/must not be blank/i);
    });

    it("should handle deleting the last column edge case", async () => {
      // This test might need to be adjusted based on business rules
      // Some databases don't allow tables with zero columns
      if (!createdTableId) {
        throw new Error(
          "No test table available. Create table test must run first.",
        );
      }

      // First, get the current table state to see remaining columns
      const tableResult = await callTool("get-table", {
        tableId: createdTableId,
      });

      const tableResponseText = tableResult.content![0].text!;
      const tableResponse = parseResponse(tableResponseText);

      if (!isPlainTextResponse(tableResponse)) {
        const remainingColumns = tableResponse.columns || [];

        if (remainingColumns.length === 1) {
          // If only one column remains, deletion might be restricted
          const lastColumn = remainingColumns[0];

          // This might throw an error or succeed based on business rules
          try {
            const result = await callTool("delete-column", {
              tableId: createdTableId,
              columnName: lastColumn.columnName,
            });
            // If it succeeds, verify the behavior
            expect(result.content).toBeDefined();
          } catch (error) {
            // If it fails, that's also valid behavior for this edge case
            expect(error).toBeDefined();
          }
        } else {
          // Delete one of the remaining columns
          const result = await callTool("delete-column", {
            tableId: createdTableId,
            columnName: remainingColumns[0].columnName,
          });
          expect(result.content).toBeDefined();
        }
      }
    });
  });
});
