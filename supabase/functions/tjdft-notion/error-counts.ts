export function summarizeActiveErrors(states: Array<string | null | undefined>) {
  const recordsPresent = states.length > 0;
  const hasUnclassifiedState = states.some((state) => !String(state || "").trim());
  const activeCount = !recordsPresent || hasUnclassifiedState
    ? null
    : states.filter((state) => !/Resolvido|Arquivado|Validado|Fechado/i.test(String(state).trim())).length;
  return {
    records_present: recordsPresent,
    active_count: activeCount,
  };
}