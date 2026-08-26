export type ProviderAccessCategory = "verified-recurring" | "conditional-free" | "account-specific" | "paid-or-unknown" | "custom"

export type NexusApiKeyProvider = {
  id:
    | "groq"
    | "openrouter"
    | "cloudflare-workers-ai"
    | "nvidia-nim"
    | "deepseek"
    | "gemini"
    | "cerebras"
    | "openai"
    | "opencode"
    | "anthropic"
    | "xai"
    | "mistral"
    | "togetherai"
    | "perplexity"
    | "cohere"
    | "fireworks"
    | "moonshotai"
    | "custom"
  name: string
  /** Local product policy only; never an account balance or live billing result. */
  access: ProviderAccessCategory
  /** Lower values are presented first in the existing picker. */
  rank: number
  /**
   * Recurring free daily allocation published by the provider itself.
   * Only set when the provider documents one fixed figure; never estimated,
   * inferred from an account, or treated as a guaranteed entitlement.
   */
  freeDaily?: { amount: number; unit: string }
  badge?: string
  detail?: string
}

export const NEXUS_API_KEY_PROVIDERS: NexusApiKeyProvider[] = [
  {
    id: "cloudflare-workers-ai",
    name: "Cloudflare Workers AI",
    access: "verified-recurring",
    rank: 10,
    freeDaily: { amount: 10_000, unit: "Neurons/day" },
    badge: "Verified daily allocation",
    detail: "10k Neurons/day; some models and account plans have conditions",
  },
  {
    id: "groq",
    name: "Groq",
    access: "verified-recurring",
    rank: 11,
    badge: "Free plan — model limits",
    detail: "Limits vary by model and organization; inspect your account for current values",
  },
  {
    id: "gemini",
    name: "Gemini",
    access: "verified-recurring",
    rank: 12,
    badge: "Free tier — project/model limits",
    detail: "Limits vary by project, model, and account tier",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    access: "conditional-free",
    rank: 20,
    freeDaily: { amount: 1_000, unit: "free-model requests/day" },
    badge: "Up to 1k free req/day",
    detail: "50 req/day under $10 all-time credits, then 1,000; free-model caps and credit conditions apply",
  },
  { id: "nvidia-nim", name: "NVIDIA NIM", access: "account-specific", rank: 30, badge: "Account/model access" },
  { id: "cerebras", name: "Cerebras", access: "paid-or-unknown", rank: 40 },
  { id: "deepseek", name: "DeepSeek", access: "paid-or-unknown", rank: 41 },
  { id: "fireworks", name: "Fireworks AI", access: "paid-or-unknown", rank: 42 },
  { id: "mistral", name: "Mistral AI", access: "paid-or-unknown", rank: 43 },
  { id: "moonshotai", name: "Moonshot AI (Kimi)", access: "paid-or-unknown", rank: 44 },
  { id: "togetherai", name: "Together AI", access: "paid-or-unknown", rank: 45 },
  { id: "cohere", name: "Cohere", access: "paid-or-unknown", rank: 46 },
  { id: "perplexity", name: "Perplexity", access: "paid-or-unknown", rank: 47 },
  { id: "openai", name: "OpenAI", access: "paid-or-unknown", rank: 48 },
  { id: "anthropic", name: "Anthropic", access: "paid-or-unknown", rank: 49 },
  { id: "xai", name: "xAI (Grok)", access: "paid-or-unknown", rank: 50 },
  { id: "opencode", name: "OpenCode", access: "paid-or-unknown", rank: 51 },
  { id: "custom", name: "Custom OpenAI-compatible API", access: "custom", rank: 90, badge: "Custom" },
]

export function rankedApiKeyProviders() {
  return [...NEXUS_API_KEY_PROVIDERS].sort(
    (left, right) =>
      left.rank - right.rank ||
      (right.freeDaily?.amount ?? 0) - (left.freeDaily?.amount ?? 0) ||
      left.name.localeCompare(right.name),
  )
}
