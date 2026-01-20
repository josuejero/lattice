import { describe, expect, it } from "vitest";
import { roleAtLeast } from "@/lib/rbac";

describe("roleAtLeast", () => {
  it("orders roles correctly", () => {
    expect(roleAtLeast("OWNER", "ADMIN")).toBe(true);
    expect(roleAtLeast("ADMIN", "OWNER")).toBe(false);
    expect(roleAtLeast("LEADER", "MEMBER")).toBe(true);
    expect(roleAtLeast("MEMBER", "LEADER")).toBe(false);
  });
});
