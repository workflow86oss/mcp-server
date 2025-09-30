import { describe, it, expect } from "@jest/globals";
import {
  relinkTablePage,
  relinkTableDetails,
  relinkTableSummary,
} from "../../src/table-links";
import {
  PageOfTableSummary,
  TableDetails,
  TableSummary,
} from "../../src/client/types.gen";

describe("Table link relinking", () => {
  it("relinkTablePage builds pagination links and projections", () => {
    const page: PageOfTableSummary = {
      _embedded: [
        {
          tableId: "t-1",
          name: "T1",
          _links: {},
        } as TableSummary,
      ],
      _pageNumber: 1,
      _lastPage: false,
      _links: {},
    };

    const result = relinkTablePage(page);
    expect(result).toHaveProperty("@pageNumber", 1);
    expect(result).toHaveProperty("@hasMorePages", true);
    expect(result["@links"]).toHaveProperty("previousPage");
    expect(result["@links"]).toHaveProperty("nextPage");
    expect(result.tables[0]).toHaveProperty("@links");
    expect(Object.keys(result).some((k) => k.startsWith("_"))).toBe(false);
  });

  it("relinkTableDetails adds tool links", () => {
    const details: TableDetails = {
      tableId: "t-2",
      name: "T2",
      columns: [],
      _links: {},
    } as any;

    const result = relinkTableDetails(details);
    expect(result["@links"]).toHaveProperty("add-column");
    expect(result["@links"]).toHaveProperty("rename-column");
    expect(result["@links"]).toHaveProperty("delete-column");
  });
});
