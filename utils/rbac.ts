import { auth } from "@/auth/auth";

export const ROLES = {
  ADMIN: "ADMIN",
  FLEET_MANAGER: "FLEET_MANAGER",
  DRIVER: "DRIVER",
  SAFETY_OFFICER: "SAFETY_OFFICER",
  FINANCIAL_ANALYST: "FINANCIAL_ANALYST",
} as const;

export type RoleType = keyof typeof ROLES;

export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden: insufficient permissions") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Ensures a user is logged in. Returns the session or throws.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new AuthError();
  return session;
}

/**
 * Ensures a user is logged in AND has one of the allowed roles.
 */
export async function requireRole(allowedRoles: RoleType[]) {
  const session = await requireAuth();
  if (!allowedRoles.includes(session.user.role as RoleType)) {
    throw new ForbiddenError();
  }
  return session;
}

// Convenience role groups used across actions
export const CAN_MANAGE_FLEET: RoleType[] = ["ADMIN", "FLEET_MANAGER"];
export const CAN_MANAGE_DRIVERS: RoleType[] = ["ADMIN", "FLEET_MANAGER", "SAFETY_OFFICER"];
export const CAN_MANAGE_TRIPS: RoleType[] = ["ADMIN", "FLEET_MANAGER"];
export const CAN_MANAGE_MAINTENANCE: RoleType[] = ["ADMIN", "FLEET_MANAGER", "SAFETY_OFFICER"];
export const CAN_MANAGE_FINANCE: RoleType[] = ["ADMIN", "FINANCIAL_ANALYST", "FLEET_MANAGER"];
export const CAN_VIEW_ALL: RoleType[] = [
  "ADMIN",
  "FLEET_MANAGER",
  "DRIVER",
  "SAFETY_OFFICER",
  "FINANCIAL_ANALYST",
];
