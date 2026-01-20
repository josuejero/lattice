export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/orgs/:path*",
    "/api/orgs/:path*",
    "/api/org-scoped/:path*",
  ],
};
