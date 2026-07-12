/**
 * Minimal dependency-free CSV generator.
 * Handles quoting, commas, newlines, and null/undefined values.
 */
export function toCSV<T extends Record<string, unknown>>(rows: T[], columns?: (keyof T)[]): string {
  if (rows.length === 0) return "";

  const keys = columns ?? (Object.keys(rows[0]) as (keyof T)[]);

  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = value instanceof Date ? value.toISOString() : String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = keys.map((k) => escape(String(k))).join(",");
  const body = rows.map((row) => keys.map((k) => escape(row[k])).join(",")).join("\n");

  return `${header}\n${body}`;
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
