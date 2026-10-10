/** Share of the relevant ids found in the first `k` hits. */
export function recallAt(k: number, hits: string[], relevant: string[]): number {
  if (relevant.length === 0) return 1;
  const top = new Set(hits.slice(0, k));
  return relevant.filter((id) => top.has(id)).length / relevant.length;
}
