export type OrgRole = "OWNER" | "ADMIN" | "LEADER" | "MEMBER";

const ROLE_RANK: Record<OrgRole, number> = {
  MEMBER: 0,
  LEADER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function roleAtLeast(actual: OrgRole, required: OrgRole) {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export function isOrgAdmin(role: OrgRole) {
  return role === "OWNER" || role === "ADMIN";
}
