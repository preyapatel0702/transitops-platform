import { NextRequest } from "next/server";
import { runExpiryReminderJob } from "@/services/reminder.service";

/**
 * Triggered daily by Vercel Cron (see vercel.json). Protected by CRON_SECRET
 * so it can't be called by anyone who doesn't have it.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runExpiryReminderJob();
    return Response.json(result);
  } catch (err) {
    console.error("[LICENSE_REMINDER_CRON_ERROR]", err);
    return new Response(err instanceof Error ? err.message : "Reminder job failed", { status: 500 });
  }
}
