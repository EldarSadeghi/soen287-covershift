export class RequestFailure extends Error {
  constructor(message, { uncertain = false, timedOut = false } = {}) {
    super(message); this.uncertain = uncertain; this.timedOut = timedOut;
  }
}
// The deadline includes headers AND JSON body consumption. Racing also protects
// callers from transports that ignore abort; late results never reach the UI.
// Never retry here: aborting a request cannot roll back a server-side save.
export function createJSONRequester({ fetchImpl = (...args) => fetch(...args), timeoutMs = 15000, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  return async function requestJSON(url, options = {}) {
    const { readOnly = false, acceptServerErrors = false, ...init } = options;
    const mutation = !readOnly && !['GET', 'HEAD'].includes((init.method || 'GET').toUpperCase());
    const controller = new AbortController(); let timer;
    const failure = timedOut => new RequestFailure(mutation
      ? 'We couldn’t confirm whether the change was saved. Check the latest saved information before trying again.'
      : timedOut ? 'This request took too long. Please try again.' : 'We couldn’t load this information. Check your connection and try again.', { uncertain: mutation, timedOut });
    const deadline = new Promise((_, reject) => { timer = setTimer(() => { reject(failure(true)); controller.abort(); }, timeoutMs); });
    const work = async () => {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      const data = response.status === 204 || response.status === 205 || init.method?.toUpperCase() === 'HEAD' ? null : await response.json();
      // A server failure cannot establish that a mutation was never committed.
      if (response.status >= 500 && !(readOnly && acceptServerErrors)) throw failure(false);
      return { ok: response.ok, status: response.status, data };
    };
    try { return await Promise.race([work(), deadline]); }
    catch (error) { if (error instanceof RequestFailure) throw error; throw failure(false); }
    finally { clearTimer(timer); }
  };
}
export const requestJSON = createJSONRequester();
