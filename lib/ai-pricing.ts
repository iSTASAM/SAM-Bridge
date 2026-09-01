/** Approximate USD pricing per 1M tokens, converted to THB for display/storage. */
type Price = { input: number; output: number };

const DEFAULT_PRICE: Price = { input: 1.0, output: 3.0 };

/** USD → THB rate used for estimated spend. Override with AI_USD_TO_THB. */
export const USD_TO_THB = Number(process.env.AI_USD_TO_THB || 35) || 35;

const MODEL_PRICES: Array<{ match: RegExp; price: Price }> = [
  { match: /gpt-5/i, price: { input: 1.25, output: 10 } },
  { match: /gpt-4\.1-mini/i, price: { input: 0.4, output: 1.6 } },
  { match: /gpt-4\.1-nano/i, price: { input: 0.1, output: 0.4 } },
  { match: /gpt-4\.1/i, price: { input: 2, output: 8 } },
  { match: /gpt-4o-mini/i, price: { input: 0.15, output: 0.6 } },
  { match: /gpt-4o/i, price: { input: 2.5, output: 10 } },
  { match: /o3-mini/i, price: { input: 1.1, output: 4.4 } },
  { match: /o1-mini/i, price: { input: 1.1, output: 4.4 } },
  { match: /o1/i, price: { input: 15, output: 60 } },
  { match: /claude-opus-4|claude-4-opus/i, price: { input: 15, output: 75 } },
  { match: /claude-sonnet-4|claude-4-sonnet/i, price: { input: 3, output: 15 } },
  { match: /claude-3-5-sonnet|claude-3\.5-sonnet/i, price: { input: 3, output: 15 } },
  { match: /claude-3-5-haiku|claude-3\.5-haiku/i, price: { input: 0.8, output: 4 } },
  { match: /claude-3-opus/i, price: { input: 15, output: 75 } },
  { match: /claude-3-haiku/i, price: { input: 0.25, output: 1.25 } },
  { match: /gemini-2\.5-pro|gemini-2\.0-pro/i, price: { input: 1.25, output: 10 } },
  { match: /gemini-2\.5-flash|gemini-2\.0-flash/i, price: { input: 0.15, output: 0.6 } },
  { match: /gemini-1\.5-pro/i, price: { input: 1.25, output: 5 } },
  { match: /gemini-1\.5-flash/i, price: { input: 0.075, output: 0.3 } },
  { match: /gemini/i, price: { input: 0.5, output: 1.5 } },
];

const PROVIDER_FALLBACK: Record<string, Price> = {
  openai: { input: 2.5, output: 10 },
  anthropic: { input: 3, output: 15 },
  gemini: { input: 0.5, output: 1.5 },
  openrouter: { input: 1, output: 3 },
  custom: DEFAULT_PRICE,
};

export function resolveModelPrice(model: string, providerId?: string): Price {
  const id = model.trim();
  for (const row of MODEL_PRICES) {
    if (row.match.test(id)) return row.price;
  }
  if (providerId && PROVIDER_FALLBACK[providerId]) return PROVIDER_FALLBACK[providerId];
  return DEFAULT_PRICE;
}

export function estimateCostUsd(input: {
  model: string;
  providerId?: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  const price = resolveModelPrice(input.model, input.providerId);
  const prompt = Math.max(0, input.promptTokens);
  const completion = Math.max(0, input.completionTokens);
  const usd = (prompt / 1_000_000) * price.input + (completion / 1_000_000) * price.output;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

/** Estimated spend in Thai Baht (from USD list prices × FX). */
export function estimateCostThb(input: {
  model: string;
  providerId?: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  const thb = estimateCostUsd(input) * USD_TO_THB;
  return Math.round(thb * 100) / 100;
}
