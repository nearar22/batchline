export const clean = value => value instanceof Map
  ? Object.fromEntries([...value].map(([key, item]) => [key, clean(item)]))
  : Array.isArray(value) ? value.map(clean)
  : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]))
  : typeof value === "bigint" ? Number(value) : value;
export const short = value => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "";
export const gateTone = value => value === "OPEN" ? "open" : "blocked";
export function actionsFor(record, account) {
  if (!record) return [];
  const actor = (account || "").toLowerCase(), owner = (record.owner || "").toLowerCase(), reviewer = (record.reviewer || "").toLowerCase();
  if (record.status === "EVIDENCE_PENDING") return ["freeze"];
  if (record.status === "FROZEN") return ["inspect"];
  if (record.status === "QUARANTINED" && actor === owner) return ["quarantine"];
  if (record.status === "AWAITING_RELEASE" && actor === reviewer) return ["release"];
  return [];
}
