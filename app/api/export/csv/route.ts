import { NextRequest } from "next/server";
import { auth } from "@/auth/auth";
import { toCSV, csvResponse } from "@/services/csv.service";
import { ENTITY_HANDLERS } from "@/lib/report-entities";

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

  const rows = await ENTITY_HANDLERS[entity]();
  const csv = toCSV(rows);

  return csvResponse(csv, `${entity}-${new Date().toISOString().slice(0, 10)}.csv`);
}
