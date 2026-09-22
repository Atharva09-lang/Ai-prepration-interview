export function findUncoveredRequirements(requirements, questions) {
  const covered = new Set(questions.flatMap((q) => q.requirement_ids));
  return requirements.filter((r) => !covered.has(r.id)).map((r) => r.id);
}

/**
 *
 * @param {unknown} raw       
 * @param {Set<string>} validIds 
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