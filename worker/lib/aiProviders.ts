import {
  AiProviderId,
  AiProviderInfo,
  buildCompactAiContext,
  getZeroTokenCatalogReply,
} from '../../src/lib/aiProductCatalog';

export interface AiEnvConfig {
  GEMINI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  APP_DOMAIN?: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

export interface AssistantRequestPayload {
  prompt: string;
  language?: string;
  history?: ChatTurn[];
  provider?: AiProviderId;
}

export interface AssistantResponsePayload {
  reply: string;
  providerUsed: AiProviderId;
  providerLabel: string;
  modelUsed: string;
  tokenOptimization: {
    estimatedFullTokens: number;
    estimatedCompactTokens: number;
    savingsPercent: number;
    tokensConsumedByLlm: boolean;
  };
  matchedServices: { slug: string; name: string; fee: number; govt: number }[];
  suggestions: string[];
}

export function getAvailableAiProviders(env: AiEnvConfig): AiProviderInfo[] {
  return [
    {
      id: 'auto',
      label: 'Auto (Low-Usage Smart Router)',
      tier: 'Recommended · Saves Quota',
      configured: true,
      model: 'compact-router',
    },
    {
      id: 'openrouter',
      label: 'OpenRouter Multi-Model',
      tier: 'Industry Cloud Gateway',
      configured: Boolean(env.OPENROUTER_API_KEY),
      model: env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
    },
    {
      id: 'gemini',
      label: 'Google Gemini 4 Hydrogen',
      tier: 'Low-Latency Flash',
      configured: Boolean(env.GEMINI_API_KEY),
      model: 'gemini-4-hydrogen',
    },
    {
      id: 'groq',
      label: 'Groq LPU Inference',
      tier: 'Ultra-Fast Llama',
      configured: Boolean(env.GROQ_API_KEY),
      model: env.GROQ_MODEL || 'llama-3.1-8b-instant',
    },
    {
      id: 'openai',
      label: 'OpenAI GPT-4o Mini',
      tier: 'Cost-Optimized',
      configured: Boolean(env.OPENAI_API_KEY),
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    {
      id: 'anthropic',
      label: 'Anthropic Claude Haiku',
      tier: 'Precision Guidance',
      configured: Boolean(env.ANTHROPIC_API_KEY),
      model: env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
    },
    {
      id: 'local_compact',
      label: 'Compact Product Catalog (0 Tokens)',
      tier: 'Instant · Zero API Cost',
      configured: true,
      model: 'deterministic-catalog-v2',
    },
  ];
}

function buildTrimmedHistory(history: ChatTurn[] = []): { role: 'user' | 'assistant'; content: string }[] {
  return history
    .filter((h) => h && typeof h.content === 'string' && h.content.trim().length > 0)
    .slice(-4)
    .map((h) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content.trim().slice(0, 220),
    }));
}

async function callOpenAiCompatible(params: {
  endpoint: string;
  apiKey: string;
  model: string;
  systemInstruction: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  prompt: string;
  extraHeaders?: Record<string, string>;
}): Promise<string> {
  const res = await fetch(params.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
      ...(params.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 320,
      temperature: 0.25,
      messages: [
        { role: 'system', content: params.systemInstruction },
        ...params.history,
        { role: 'user', content: params.prompt.slice(0, 500) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 160)}`);
  }

  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('Empty response content from provider');
  }
  return content.trim();
}

async function callAnthropicMessages(params: {
  apiKey: string;
  model: string;
  systemInstruction: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  prompt: string;
}): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 320,
      system: params.systemInstruction,
      messages: [
        ...params.history,
        { role: 'user', content: params.prompt.slice(0, 500) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic HTTP ${res.status}: ${errText.slice(0, 160)}`);
  }

  const data: any = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text || typeof text !== 'string') {
    throw new Error('Empty response from Anthropic');
  }
  return text.trim();
}

async function callGeminiRest(params: {
  apiKey: string;
  systemInstruction: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  prompt: string;
}): Promise<string> {
  const contents = [
    ...params.history.map((h) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }],
    })),
    { role: 'user', parts: [{ text: params.prompt.slice(0, 500) }] },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-4-hydrogen:generateContent?key=${encodeURIComponent(
      params.apiKey
    )}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'aistudio-build',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.systemInstruction }] },
        contents,
        generationConfig: {
          thinkingConfig: { thinkingLevel: 'LOW' },
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 160)}`);
  }

  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || typeof text !== 'string') {
    throw new Error('Empty Gemini response');
  }
  return text.trim();
}

export async function runMultiProviderAssistant(params: {
  payload: AssistantRequestPayload;
  env: AiEnvConfig;
  geminiCustomCaller?: (input: {
    systemInstruction: string;
    history: { role: 'user' | 'assistant'; content: string }[];
    prompt: string;
  }) => Promise<string>;
}): Promise<AssistantResponsePayload> {
  const { payload, env, geminiCustomCaller } = params;
  const prompt = String(payload.prompt || '').trim();
  const language = payload.language === 'hi' ? 'hi' : 'en';
  const requestedProvider: AiProviderId = payload.provider || 'auto';
  const trimmedHistory = buildTrimmedHistory(payload.history);

  const compactContext = buildCompactAiContext(prompt, language);
  const zeroToken = getZeroTokenCatalogReply(prompt, language);

  const matchedServices = compactContext.matchedProducts.map((p) => ({
    slug: p.slug,
    name: p.name,
    fee: p.fee,
    govt: p.govt,
  }));

  const defaultSuggestions =
    zeroToken.suggestions.length > 0
      ? zeroToken.suggestions
      : [
          'Documents required for PAN Card',
          'GST Registration fees & SLA',
          'Track application status',
        ];

  // Explicit 0-token local catalog mode
  if (requestedProvider === 'local_compact') {
    return {
      reply: zeroToken.reply,
      providerUsed: 'local_compact',
      providerLabel: 'Compact Product KB (0 Tokens)',
      modelUsed: 'deterministic-catalog-v2',
      tokenOptimization: {
        estimatedFullTokens: compactContext.estimatedFullTokens,
        estimatedCompactTokens: 0,
        savingsPercent: 100,
        tokensConsumedByLlm: false,
      },
      matchedServices,
      suggestions: defaultSuggestions,
    };
  }

  // In Auto mode: if it's a single-turn crisp factual query matching exact catalog/corporate ID/tracking, serve immediately at 0 LLM token cost
  const looksComplex =
    trimmedHistory.length >= 2 ||
    prompt.length > 95 ||
    /\b(compare|difference|which|why|explain|eligibility|help me choose|suggest|rejected|error|how to)\b/i.test(
      prompt
    );

  if (requestedProvider === 'auto' && zeroToken.isExactMatch && !looksComplex) {
    return {
      reply: zeroToken.reply,
      providerUsed: 'local_compact',
      providerLabel: 'Auto · Zero-Token Product KB Hit',
      modelUsed: 'deterministic-catalog-v2',
      tokenOptimization: {
        estimatedFullTokens: compactContext.estimatedFullTokens,
        estimatedCompactTokens: 0,
        savingsPercent: 100,
        tokensConsumedByLlm: false,
      },
      matchedServices,
      suggestions: defaultSuggestions,
    };
  }

  // Order candidate providers cleanly
  const providerOrder: AiProviderId[] =
    requestedProvider === 'auto'
      ? ['openrouter', 'gemini', 'groq', 'openai', 'anthropic']
      : [requestedProvider, 'openrouter', 'gemini', 'groq', 'openai', 'anthropic'];

  const tried = new Set<AiProviderId>();

  for (const candidate of providerOrder) {
    if (tried.has(candidate)) continue;
    tried.add(candidate);

    try {
      if (candidate === 'openrouter' && env.OPENROUTER_API_KEY) {
        const model = env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
        const reply = await callOpenAiCompatible({
          endpoint: 'https://openrouter.ai/api/v1/chat/completions',
          apiKey: env.OPENROUTER_API_KEY,
          model,
          systemInstruction: compactContext.systemInstruction,
          history: trimmedHistory,
          prompt,
          extraHeaders: {
            'HTTP-Referer': env.APP_DOMAIN || 'https://digitalindiaproject.com',
            'X-Title': 'Digital India Project',
          },
        });
        return {
          reply,
          providerUsed: 'openrouter',
          providerLabel: 'OpenRouter',
          modelUsed: model,
          tokenOptimization: {
            estimatedFullTokens: compactContext.estimatedFullTokens,
            estimatedCompactTokens: compactContext.estimatedCompactTokens,
            savingsPercent: compactContext.savingsPercent,
            tokensConsumedByLlm: true,
          },
          matchedServices,
          suggestions: defaultSuggestions,
        };
      }

      if (candidate === 'gemini' && env.GEMINI_API_KEY) {
        const reply = geminiCustomCaller
          ? await geminiCustomCaller({
              systemInstruction: compactContext.systemInstruction,
              history: trimmedHistory,
              prompt,
            })
          : await callGeminiRest({
              apiKey: env.GEMINI_API_KEY,
              systemInstruction: compactContext.systemInstruction,
              history: trimmedHistory,
              prompt,
            });
        return {
          reply,
          providerUsed: 'gemini',
          providerLabel: 'Gemini 4 Hydrogen',
          modelUsed: 'gemini-4-hydrogen',
          tokenOptimization: {
            estimatedFullTokens: compactContext.estimatedFullTokens,
            estimatedCompactTokens: compactContext.estimatedCompactTokens,
            savingsPercent: compactContext.savingsPercent,
            tokensConsumedByLlm: true,
          },
          matchedServices,
          suggestions: defaultSuggestions,
        };
      }

      if (candidate === 'groq' && env.GROQ_API_KEY) {
        const model = env.GROQ_MODEL || 'llama-3.1-8b-instant';
        const reply = await callOpenAiCompatible({
          endpoint: 'https://api.groq.com/openai/v1/chat/completions',
          apiKey: env.GROQ_API_KEY,
          model,
          systemInstruction: compactContext.systemInstruction,
          history: trimmedHistory,
          prompt,
        });
        return {
          reply,
          providerUsed: 'groq',
          providerLabel: 'Groq LPU',
          modelUsed: model,
          tokenOptimization: {
            estimatedFullTokens: compactContext.estimatedFullTokens,
            estimatedCompactTokens: compactContext.estimatedCompactTokens,
            savingsPercent: compactContext.savingsPercent,
            tokensConsumedByLlm: true,
          },
          matchedServices,
          suggestions: defaultSuggestions,
        };
      }

      if (candidate === 'openai' && env.OPENAI_API_KEY) {
        const model = env.OPENAI_MODEL || 'gpt-4o-mini';
        const reply = await callOpenAiCompatible({
          endpoint: 'https://api.openai.com/v1/chat/completions',
          apiKey: env.OPENAI_API_KEY,
          model,
          systemInstruction: compactContext.systemInstruction,
          history: trimmedHistory,
          prompt,
        });
        return {
          reply,
          providerUsed: 'openai',
          providerLabel: 'OpenAI',
          modelUsed: model,
          tokenOptimization: {
            estimatedFullTokens: compactContext.estimatedFullTokens,
            estimatedCompactTokens: compactContext.estimatedCompactTokens,
            savingsPercent: compactContext.savingsPercent,
            tokensConsumedByLlm: true,
          },
          matchedServices,
          suggestions: defaultSuggestions,
        };
      }

      if (candidate === 'anthropic' && env.ANTHROPIC_API_KEY) {
        const model = env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
        const reply = await callAnthropicMessages({
          apiKey: env.ANTHROPIC_API_KEY,
          model,
          systemInstruction: compactContext.systemInstruction,
          history: trimmedHistory,
          prompt,
        });
        return {
          reply,
          providerUsed: 'anthropic',
          providerLabel: 'Anthropic Claude',
          modelUsed: model,
          tokenOptimization: {
            estimatedFullTokens: compactContext.estimatedFullTokens,
            estimatedCompactTokens: compactContext.estimatedCompactTokens,
            savingsPercent: compactContext.savingsPercent,
            tokensConsumedByLlm: true,
          },
          matchedServices,
          suggestions: defaultSuggestions,
        };
      }
    } catch (err) {
      console.warn(`AI provider "${candidate}" failed, trying next fallback:`, err);
    }
  }

  // Guaranteed deterministic compact catalog fallback
  return {
    reply: zeroToken.reply,
    providerUsed: 'local_compact',
    providerLabel: 'Compact Product KB (Fallback · 0 Tokens)',
    modelUsed: 'deterministic-catalog-v2',
    tokenOptimization: {
      estimatedFullTokens: compactContext.estimatedFullTokens,
      estimatedCompactTokens: 0,
      savingsPercent: 100,
      tokensConsumedByLlm: false,
    },
    matchedServices,
    suggestions: defaultSuggestions,
  };
}
