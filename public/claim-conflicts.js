// UTC instants use half-open intervals: a shift ending exactly when another
// starts is adjacent, not overlapping. No local clock-string comparisons.
export function intervalsOverlap(a, b) {
  return Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);
}
export function findClaimConflicts(shift, commitments) {
  return commitments.filter(item => item.id !== shift.id && intervalsOverlap(shift, item));
}
