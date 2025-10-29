import { BillStatus, Role } from "@prisma/client";

export function nextStatusesForRole(role: Role, current: BillStatus): BillStatus[] {
  switch (role) {
    case "LEVEL1":
      if (current === "PENDING_L1") {
        return ["PENDING_L2", "RETURNED_L1", "REJECTED_L1"];
      }
      return [];
    case "LEVEL2":
      if (current === "PENDING_L2") {
        return ["PENDING_PAYMENT", "RETURNED_L2", "REJECTED_L2"];
      }
      return [];
    case "ACCOUNTS":
      if (current === "PENDING_PAYMENT") {
        return ["PAID"];
      }
      return [];
    default:
      return [];
  }
}

export function canCreateBill(role: Role) {
  return role === "OPERATOR";
}

export function canManageAdmin(role: Role) {
  return role === "ADMIN";
}
