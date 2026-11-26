import { HttpError } from '../auth/errors.js';
export async function structuredResponse({apiKey, body, fetchImpl, timeoutMs, unavailable}) {
  const controller = new AbortController(); let timer;
  try {
    const work = async () => {
      const response = await fetchImpl('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body, signal: controller.signal });
      if (response.status === 404) throw new HttpError(503, 'The configured AI model is unavailable. Ask an administrator to check OPENAI_MODEL.');
      if (!response.ok && response.status !== 400) throw unavailable();
      // Bound response bytes as well as output tokens. Body consumption is in deadline.
      const reader = response.body.getReader(); const chunks = []; let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > 65536) { void reader.cancel(); throw unavailable(); }
          chunks.push(Buffer.from(value));
        }
      } finally { reader.releaseLock(); }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!response.ok) {
        if (['model_not_found', 'unsupported_model', 'invalid_model'].includes(data.error?.code) || data.error?.param === 'model') {
          throw new HttpError(503, 'The configured AI model is unavailable. Ask an administrator to check OPENAI_MODEL.');
        }
        throw unavailable();
      }
      if (data.status !== 'completed' || !Array.isArray(data.output)) throw unavailable();
      const content = data.output.filter(item => item.type === 'message').flatMap(item => item.content || []);
      if (content.some(part => part.type === 'refusal')) throw new HttpError(422, 'AI could not interpret that request. Rephrase it as one work shift, or use the manual workflow.');
      const parts = content.filter(part => part.type === 'output_text');
      if (parts.length !== 1 || typeof parts[0].text !== 'string') throw unavailable();
      return JSON.parse(parts[0].text);
    };
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(unavailable()); }, timeoutMs); });
    return await Promise.race([work(), deadline]);
  } finally { clearTimeout(timer); }
}
