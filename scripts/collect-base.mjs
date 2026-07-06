export function mergeBaseForScan(existing, since) {
  if (since) return existing;
  return {
    meta: { machines: existing.meta?.machines || [] },
    byDay: {},
  };
}
