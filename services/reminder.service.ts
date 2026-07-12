import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/services/email.service";

/**
 * Staged reminder windows, most urgent first. 0 = already expired.
 * Each (entity, threshold) pair fires exactly once, tracked via ReminderLog,
 * so a daily cron never re-sends the same notice twice.
 */
const THRESHOLDS = [7, 15, 30] as const;

function daysUntil(date: Date): number {
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

function thresholdLabel(threshold: number): string {
  return threshold === 0 ? "EXPIRED" : `${threshold}-day notice`;
}

/**
 * Returns the most urgent threshold that applies to daysUntilExpiry and has
 * not already been sent for this entity, or null if nothing qualifies.
 */
async function findQualifyingThreshold(
  entityType: "DRIVER_LICENSE" | "VEHICLE_DOCUMENT",
  entityId: string,
  daysUntilExpiry: number
): Promise<number | null> {
  const applicable = [...THRESHOLDS, 0].filter((t) => daysUntilExpiry <= t);
  if (applicable.length === 0) return null;

  const alreadySent = await prisma.reminderLog.findMany({
    where: { entityType, entityId, thresholdDays: { in: applicable } },
    select: { thresholdDays: true },
  });
  const sentSet = new Set(alreadySent.map((r: { thresholdDays: number }) => r.thresholdDays));

  const unsent = applicable.filter((t) => !sentSet.has(t)).sort((a, b) => a - b);
  return unsent.length > 0 ? unsent[0] : null;
}

/**
 * Marks every threshold that currently applies as sent, so once we notify at
 * the most urgent tier we don't later send a "higher window" notice that's
 * already stale (e.g. a 15-day notice arriving after a 7-day notice was sent).
 */
async function markThresholdsSent(
  entityType: "DRIVER_LICENSE" | "VEHICLE_DOCUMENT",
  entityId: string,
  daysUntilExpiry: number
) {
  const applicable = [...THRESHOLDS, 0].filter((t) => daysUntilExpiry <= t);
  await prisma.reminderLog.createMany({
    data: applicable.map((t) => ({ entityType, entityId, thresholdDays: t })),
    skipDuplicates: true,
  });
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Finds drivers and vehicle documents crossing a 30/15/7-day (or expired)
 * reminder threshold for the first time, emails a single digest to
 * REMINDER_EMAIL_TO, and records which thresholds were sent. Intended to be
 * called by a scheduled job (see app/api/cron/license-reminders/route.ts).
 */
export async function runExpiryReminderJob() {
  const [drivers, documents] = await Promise.all([
    prisma.driver.findMany({
      where: { status: { not: "SUSPENDED" } },
      orderBy: { licenseExpiryDate: "asc" },
    }),
    prisma.vehicleDocument.findMany({
      where: { expiryDate: { not: null } },
      include: { vehicle: true },
      orderBy: { expiryDate: "asc" },
    }),
  ]);

  const driverRows: { html: string; entityId: string; daysUntilExpiry: number }[] = [];
  for (const d of drivers) {
    const daysUntilExpiry = daysUntil(d.licenseExpiryDate);
    const threshold = await findQualifyingThreshold("DRIVER_LICENSE", d.id, daysUntilExpiry);
    if (threshold === null) continue;

    driverRows.push({
      entityId: d.id,
      daysUntilExpiry,
      html: `<tr>
        <td>${d.name}</td>
        <td>${d.licenseNumber}</td>
        <td>${formatDate(d.licenseExpiryDate)}</td>
        <td style="color:${threshold === 0 ? "#dc2626" : "#d97706"}">${thresholdLabel(threshold)}</td>
      </tr>`,
    });
  }

  const documentRows: { html: string; entityId: string; daysUntilExpiry: number }[] = [];
  for (const doc of documents) {
    const daysUntilExpiry = daysUntil(doc.expiryDate as Date);
    const threshold = await findQualifyingThreshold("VEHICLE_DOCUMENT", doc.id, daysUntilExpiry);
    if (threshold === null) continue;

    documentRows.push({
      entityId: doc.id,
      daysUntilExpiry,
      html: `<tr>
        <td>${doc.vehicle.registrationNumber}</td>
        <td>${doc.docType}</td>
        <td>${formatDate(doc.expiryDate as Date)}</td>
        <td style="color:${threshold === 0 ? "#dc2626" : "#d97706"}">${thresholdLabel(threshold)}</td>
      </tr>`,
    });
  }

  if (driverRows.length === 0 && documentRows.length === 0) {
    return { sent: false, driverCount: 0, documentCount: 0 };
  }

  const recipient = process.env.REMINDER_EMAIL_TO;
  if (!recipient) {
    throw new Error("REMINDER_EMAIL_TO is not configured in .env");
  }

  const html = `
    <h2>TransitOps — Compliance Reminder</h2>
    <p>The following items have crossed a 30/15/7-day expiry threshold:</p>
    ${
      driverRows.length
        ? `<h3>Driver Licenses (${driverRows.length})</h3>
           <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
             <tr><th>Driver</th><th>License #</th><th>Expiry</th><th>Status</th></tr>
             ${driverRows.map((r) => r.html).join("")}
           </table>`
        : ""
    }
    ${
      documentRows.length
        ? `<h3>Vehicle Documents (${documentRows.length})</h3>
           <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
             <tr><th>Vehicle</th><th>Document</th><th>Expiry</th><th>Status</th></tr>
             ${documentRows.map((r) => r.html).join("")}
           </table>`
        : ""
    }
  `;

  await sendEmail(recipient, "TransitOps: Upcoming license & document expirations", html);

  // Only record threshold state for entities actually included in this email.
  await Promise.all([
    ...driverRows.map((r) => markThresholdsSent("DRIVER_LICENSE", r.entityId, r.daysUntilExpiry)),
    ...documentRows.map((r) => markThresholdsSent("VEHICLE_DOCUMENT", r.entityId, r.daysUntilExpiry)),
  ]);

  return { sent: true, driverCount: driverRows.length, documentCount: documentRows.length };
}
