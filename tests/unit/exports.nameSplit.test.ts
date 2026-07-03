import { describe, expect, it } from "vitest";
import { splitDisplayName } from "@/server/domain/exports/exportService";

describe("splitDisplayName", () => {
  it("splits a two-word name on the last whitespace boundary", () => {
    expect(splitDisplayName("Grace Hopper")).toEqual({ firstName: "Grace", lastName: "Hopper" });
  });

  it("treats everything before the last space as the first name", () => {
    expect(splitDisplayName("Mary Ann Smith")).toEqual({ firstName: "Mary Ann", lastName: "Smith" });
  });

  it("uses the whole name as last name when there is no space", () => {
    expect(splitDisplayName("Cher")).toEqual({ firstName: "", lastName: "Cher" });
  });
});
