"use server";

import { requireRole, CAN_VIEW_ALL } from "@/utils/rbac";
import { runAction } from "@/utils/api-response";
import { getDashboardKPIs, getVehicleROIBreakdown, DashboardFilters } from "@/services/dashboard.service";

export async function getDashboardData(filters?: DashboardFilters) {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    return getDashboardKPIs(filters);
  });
}

export async function getVehicleROIData() {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    return getVehicleROIBreakdown();
  });
}
