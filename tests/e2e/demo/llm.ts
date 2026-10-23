/**
 * LLM for the API the tour starts: the local Ollama by default, as in
 * production, so nothing leaves the machine. DEMO_LLM_PROVIDER=env keeps the
 * repository .env as it is; gemini and anthropic also work.
 */
const DEFAULT_MODELS: Record<string, string> = {
  ollama: 'qwen2.5-coder:7b',
  gemini: 'gemini-2.5-flash-lite',
  anthropic: 'claude-3-haiku-20240307',
};

export type DemoLlm = { provider: string; model: string | null };

export function demoLlm(): DemoLlm {
  const provider = process.env.DEMO_LLM_PROVIDER ?? 'ollama';
  if (provider === 'env') return { provider: 'definido no .env', model: null };
  return { provider, model: process.env.DEMO_LLM_MODEL ?? DEFAULT_MODELS[provider] ?? null };
}

/** Variables for the API process. GEMINI_MODEL wins over LLM_MODEL in the Gemini client, so both are set. */
export function demoLlmEnv(): Record<string, string> {
  const { provider, model } = demoLlm();
  if (process.env.DEMO_LLM_PROVIDER === 'env' || !model) return {};
  return { LLM_PROVIDER: provider, LLM_MODEL: model, GEMINI_MODEL: model };
}
