import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';

/**
 * Returns plain-language warnings for a half-configured AI setup. Never
 * includes the key itself. An empty list means AI is fully on or fully off.
 * `model` is the raw OPENAI_MODEL value (undefined when not set).
 */
export async function aiStartupWarnings({ apiKey, model, usageDirectory }) {
  const warnings = [];
  const hasKey = Boolean(apiKey?.trim());
  if (!hasKey && model?.trim()) {
    warnings.push('OPENAI_MODEL is set but OPENAI_API_KEY is missing, so AI features are off.');
  }
  if (hasKey && model !== undefined && !model.trim()) {
    warnings.push('OPENAI_API_KEY is set but OPENAI_MODEL is blank, so AI features are off. Remove OPENAI_MODEL to use the default model.');
  }
  if (hasKey) {
    try {
      await mkdir(usageDirectory, { recursive: true, mode: 0o700 });
      await access(usageDirectory, constants.W_OK);
    } catch {
      warnings.push('The AI usage folder cannot be written, so every AI request will fail. Check permissions on DATA_DIRECTORY/ai-usage.');
    }
  }
  return warnings;
}
