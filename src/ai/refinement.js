// The validated structured draft is authoritative for unchanged fields.
export const refinementInstructions = `
The following field rules override the full-draft output rules when a pendingDraft is supplied. For a successful revision, return null for each unchanged field and a value only for each explicitly changed field. Preserve dates, overnight intent and constraints unless the user clearly changes them. If the day changes, update all affected date-bearing fields together, preserving unchanged clock times and overnight offsets. An empty string explicitly clears an optional field. If the user clearly describes a completely different draft, supply all fields explicitly and ask about missing required details. Ask one focused question if the latest request or its target is ambiguous. For clarification return null in every draft field and keep the existing question and kind requirements. Never treat conversational agreement as permission to perform an action. For a request to edit an already saved shift or rule, direct the user to the authorized Schedule or Saved availability controls, without proposing a replacement draft.`;

export function refinementFormat(schema, base) {
  if (!base) return schema;
  const properties = { ...schema.properties };
  for (const field of Object.keys(base)) {
    properties[field] = { anyOf: [properties[field], { type: 'null' }] };
  }
  return { ...schema, properties };
}

export function applyRefinement(result, base, unavailable) {
  if (!base) return result;
  const fields = Object.keys(base);
  if (!result || Array.isArray(result) || !fields.every(field => Object.hasOwn(result, field))) throw unavailable();
  if (result.kind === 'clarification') {
    if (fields.some(field => result[field] !== null)) throw unavailable();
    return { ...result, ...Object.fromEntries(fields.map(field => [field, typeof base[field] === 'number' ? 0 : ''])) };
  }
  return { ...result, ...Object.fromEntries(fields.map(field => [field, result[field] === null ? base[field] : result[field]])) };
}
