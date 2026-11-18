// Expiry is a read-time view of an unresolved request, not a saved decision.
// Use UTC instants: expiry begins exactly at shift start, including overnight/DST.
export function coverageDisplayState(request, shift, now) {
  const expired = ['open', 'pending'].includes(request.status) && Date.parse(shift.startsAt) <= now;
  return { displayStatus: expired ? 'expired' : request.status, expiredAt: expired ? shift.startsAt : null };
}
