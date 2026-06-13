/**
 * LINE 1:1 permission model.
 *
 * Two tiers for linked users:
 *   Linked (STAFF or ADMIN) — all non-admin actions
 *   ADMIN — all actions including admin-only
 *
 * Anonymous (not linked): nothing is allowed — login-required for everything.
 */

import type { Role } from "@prisma/client";

// ── Action types ────────────────────────────────────────────────────

export type LineAction =
  // All linked users
  | "general_chat"
  | "search_parts"
  | "view_part_detail"
  | "image_search"
  | "read_stock_quantity"
  | "group_summary"
  | "create_part"
  | "update_part"
  | "stock_in"
  | "stock_out"
  | "stock_adjust"
  | "confirm_ai_add"
  | "edit_ai_suggestion"
  // Admin-only
  | "delete_part"
  | "bulk_import"
  | "user_management";

// ── Action labels (Thai) ────────────────────────────────────────────

const ACTION_LABELS: Record<LineAction, string> = {
  general_chat: "คุยทั่วไป",
  search_parts: "ค้นหาอะไหล่",
  view_part_detail: "ดูรายละเอียดอะไหล่",
  image_search: "ค้นหาอะไหล่จากรูป",
  read_stock_quantity: "ดูจำนวนสต็อก",
  group_summary: "ดูสรุปกลุ่ม",
  create_part: "เพิ่มอะไหล่ใหม่",
  update_part: "แก้ไขข้อมูลอะไหล่",
  stock_in: "รับเข้าสต็อก",
  stock_out: "เบิก/ตัดสต็อก",
  stock_adjust: "ปรับจำนวนสต็อก",
  confirm_ai_add: "ยืนยันเพิ่มอะไหล่จาก AI",
  edit_ai_suggestion: "แก้ไขข้อมูลจาก AI",
  delete_part: "ลบอะไหล่",
  bulk_import: "นำเข้าข้อมูล",
  user_management: "จัดการผู้ใช้",
};

// ── Permission sets ─────────────────────────────────────────────────

/** Anonymous (not linked) — nothing is permitted. Every interaction returns login-required. */
const ANONYMOUS_ACTIONS: ReadonlySet<LineAction> = new Set([]);

/** Actions that require ADMIN role */
const ADMIN_ACTIONS: ReadonlySet<LineAction> = new Set([
  "delete_part",
  "bulk_import",
  "user_management",
]);

/** All actions that are NOT admin-only — any linked user can perform these */
const DEFAULT_ACTIONS: ReadonlySet<LineAction> = new Set(
  (Object.keys(ACTION_LABELS) as LineAction[]).filter((a) => !ADMIN_ACTIONS.has(a)),
);

// ── Result types ────────────────────────────────────────────────────

export type LinePermissionAllowed = {
  allowed: true;
  role: Role;
};

export type LinePermissionDenied = {
  allowed: false;
  reason: "login_required" | "insufficient_role";
  requiredRole?: Role;
};

export type LinePermissionResult = LinePermissionAllowed | LinePermissionDenied;

// ── Core check ──────────────────────────────────────────────────────

/**
 * Check whether a LINE user can perform an action.
 * Pass `null` for anonymous (not linked) users — always denied.
 */
export function checkLinePermission(
  user: { role: Role } | null,
  action: LineAction,
): LinePermissionResult {
  // Anonymous / not linked — nothing allowed
  if (!user) {
    return { allowed: false, reason: "login_required" };
  }

  // Admin can do everything
  if (user.role === "ADMIN") {
    return { allowed: true, role: "ADMIN" };
  }

  // Linked user (STAFF or any other role): allowed for all non-admin actions
  if (DEFAULT_ACTIONS.has(action)) {
    return { allowed: true, role: user.role };
  }

  // Admin-only actions for non-admin users
  return { allowed: false, reason: "insufficient_role", requiredRole: "ADMIN" };
}

/**
 * Check permission, throw if denied.
 * Use this at the top of postback handlers for state-changing actions.
 */
export function requireLinePermission(
  user: { role: Role } | null,
  action: LineAction,
): { role: Role } {
  const result = checkLinePermission(user, action);
  if (!result.allowed) {
    if (result.reason === "login_required") {
      throw new LinePermissionError("ต้องล็อกอินก่อน", "login_required", action);
    }
    throw new LinePermissionError(
      `การกระทำนี้ต้องใช้สิทธิ์ ${result.requiredRole}`,
      "insufficient_role",
      action,
      result.requiredRole,
    );
  }
  return { role: result.role };
}

/**
 * Check whether a user can delete a specific part.
 * ADMIN can delete any part. Other linked users can only delete parts they created.
 */
export function canDeletePart(
  user: { id: string; role: string } | null,
  partCreatedBy: string,
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return user.id === partCreatedBy;
}

// ── Error class ─────────────────────────────────────────────────────

export class LinePermissionError extends Error {
  constructor(
    message: string,
    public reason: "login_required" | "insufficient_role",
    public action: LineAction,
    public requiredRole?: Role,
  ) {
    super(message);
    this.name = "LinePermissionError";
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Get Thai label for an action */
export function getActionLabel(action: LineAction): string {
  return ACTION_LABELS[action] || action;
}

/** Check if an action requires login */
export function requiresLogin(action: LineAction): boolean {
  return !ANONYMOUS_ACTIONS.has(action);
}

/** Check if an action requires admin role */
export function requiresAdmin(action: LineAction): boolean {
  return ADMIN_ACTIONS.has(action);
}
