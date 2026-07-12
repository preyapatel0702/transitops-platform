import { NextRequest } from "next/server";
import { auth } from "@/auth/auth";
import { generateTablePdf, pdfResponse, PdfSummaryItem } from "@/services/pdf.service";
import { ENTITY_HANDLERS } from "@/lib/report-entities";
import { getDashboardKPIs, getVehicleROIBreakdown } from "@/services/dashboard.service";

const ENTITY_TITLES: Record<string, string> = {
  vehicles: "Vehicle Registry Report",
  drivers: "Driver Registry Report",
  trips: "Trip Report",
  maintenance: "Maintenance Report",
  fuel: "Fuel Log Report",
  expenses: "Expense Report",
  documents: "Vehicle Document Report",
  dashboard: "Dashboard Summary Report",
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const entity = req.nextUrl.searchParams.get("entity");
  if (!entity || !ENTITY_HANDLERS[entity]) {
    return new Response(
      `Invalid entity. Supported: ${Object.keys(ENTITY_HANDLERS).join(", ")}`,
      { status: 400 }
    );
  }

  const title = ENTITY_TITLES[entity] ?? `TransitOps — ${entity} Report`;

  // Dashboard gets a dedicated layout: KPI summary cards + per-vehicle ROI table,
  // built entirely from the existing dashboard service (no duplicated logic).
  if (entity === "dashboard") {
    const [kpis, roiBreakdown] = await Promise.all([getDashboardKPIs(), getVehicleROIBreakdown()]);

    const summary: PdfSummaryItem[] = [
      { label: "Total Vehicles", value: kpis.totalVehicles },
      { label: "Available", value: kpis.availableVehicles },
      { label: "In Shop", value: kpis.vehiclesInShop },
      { label: "On Trip", value: kpis.vehiclesOnTrip },
      { label: "Active Trips", value: kpis.activeTrips },
      { label: "Pending Trips", value: kpis.pendingTrips },
      { label: "Drivers On Duty", value: kpis.driversOnDuty },
      { label: "Fleet Utilization", value: `${kpis.fleetUtilization}%` },
      { label: "Fuel Efficiency", value: kpis.fuelEfficiency },
      { label: "Operational Cost", value: kpis.totalOperationalCost },
      { label: "Fleet ROI", value: kpis.fleetROI },
      { label: "Licenses Expiring ≤30d", value: kpis.licensesExpiringSoon },
      { label: "Licenses Expired", value: kpis.licensesExpired },
      { label: "Documents Expiring ≤30d", value: kpis.documentsExpiringSoon },
      { label: "Documents Expired", value: kpis.documentsExpired },
    ];

    const buffer = await generateTablePdf(
      title,
      roiBreakdown as unknown as Record<string, unknown>[],
      summary
    );
    return pdfResponse(buffer, `dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const rows = await ENTITY_HANDLERS[entity]();
  const buffer = await generateTablePdf(title, rows);

  return pdfResponse(buffer, `${entity}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
