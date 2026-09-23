export function findUncoveredRequirements(requirements, questions) {
  const covered = new Set(questions.flatMap((q) => q.requirement_ids));
  return requirements.filter((r) => !covered.has(r.id)).map((r) => r.id);
}

/**
 * Keeps only the requirement ids that actually exist, de-duplicated and in
 * order. LLM output is untrusted: it can invent ids ("r9") or return a
 * non-array, and either would make the whole kit fail structural validation.
 * Filtering here turns that into a repaired item (or a dropped one) instead of
 * a fatal INVALID_KIT.
 *
 * @param {unknown} raw       Raw requirement_ids value from the model
 * @param {Set<string>} validIds  Set of requirement ids that exist in the kit
 * @returns {string[]}
 */
export function filterValidRequirementIds(raw, validIds) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const id of raw) {
    if (typeof id === 'string' && validIds.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}