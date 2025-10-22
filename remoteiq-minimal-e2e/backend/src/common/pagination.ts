// src/common/pagination.ts
export function encodeCursor(val: string | number | Date): string {
  const s = typeof val === "string" ? val : (val instanceof Date ? val.toISOString() : String(val));
  return Buffer.from(s, "utf8").toString("base64url");
}
export function decodeCursor(cursor?: string): string | undefined {
  if (!cursor) return undefined;
  try { return Buffer.from(cursor, "base64url").toString("utf8"); }
  catch { return undefined; }
}
