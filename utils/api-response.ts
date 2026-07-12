import { ZodError } from "zod";
import { AuthError, ForbiddenError } from "@/utils/rbac";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { success: false, error, fieldErrors };
}

/**
 * Wraps a server action's business logic, normalizing thrown errors
 * (Zod validation, auth, business rule violations) into ActionResult.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (err) {
    if (err instanceof ZodError) {
      return fail("Validation failed", err.flatten().fieldErrors as Record<string, string[]>);
    }
    if (err instanceof AuthError) {
      return fail(err.message);
    }
    if (err instanceof ForbiddenError) {
      return fail(err.message);
    }
    if (err instanceof BusinessRuleError) {
      return fail(err.message);
    }
    console.error("[ACTION_ERROR]", err);
    return fail(err instanceof Error ? err.message : "Unexpected error occurred");
  }
}

export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleError";
  }
}
