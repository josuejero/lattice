import { describe, expect, it } from "vitest";

import { GET as getOpenApi } from "@/app/api/openapi/route";

describe("OpenAPI route", () => {
  it("returns a document that defines the API", async () => {
    const response = await getOpenApi();
    expect(response.status).toBe(200);

    const spec = await response.json();
    expect(spec).toHaveProperty("openapi");
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec).toHaveProperty("info");
    expect(spec.paths).toHaveProperty("/api/health");
    expect(spec.paths).toHaveProperty("/api/orgs");
  });
});
