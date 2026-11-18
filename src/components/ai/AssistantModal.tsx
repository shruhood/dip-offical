import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Bot,
  ArrowRight,
  Cpu,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import {
  AiProviderId,
  AiProviderInfo,
  getZeroTokenCatalogReply,
} from '../../lib/aiProductCatalog';

interface MatchedServiceLink {
  slug: string;
  name: string;
  fee: number;
  govt: number;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  providerBadge?: string;
  savingsBadge?: string;
  matchedServices?: MatchedServiceLink[];
  suggestions?: string[];
}

const DEFAULT_PROVIDERS: AiProviderInfo[] = [
  { id: 'auto', label: 'Auto (Low-Usage Router)', tier: 'Saves Quota', configured: true },
  { id: 'openrouter', label: 'OpenRouter Multi-Model', tier: 'Industry Cloud', configured: false },
  { id: 'gemini', label: 'Google Gemini 4 Hydrogen', tier: 'Low-Latency', configured: false },
  { id: 'groq', label: 'Groq LPU Inference', tier: 'Fast Llama', configured: false },
  { id: 'openai', label: 'OpenAI GPT-4o Mini', tier: 'Compact', configured: false },
  { id: 'anthropic', label: 'Anthropic Claude Haiku', tier: 'Precision', configured: false },
  { id: 'local_compact', label: 'Compact Product KB (0 Tokens)', tier: 'Instant Offline', configured: true },
];

export const AssistantModal: React.FC<{ onNavigateToService?: (slug: string) => void }> = ({
  onNavigateToService,
}) => {
  const { lang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AiProviderId>('auto');
  const [providers, setProviders] = useState<AiProviderInfo[]>(DEFAULT_PROVIDERS);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text:
        lang === 'hi'
          ? 'नमस्ते! मैं डिजिटल इंडिया प्रोजेक्ट का एआई सहायक हूँ। मैं कम-टोकन स्मार्ट कैटलॉग और OpenRouter/Gemini के माध्यम से पैन, जीएसटी, उद्यम, फ़ूड लाइसेंस, और डन्स नंबर की सटीक जानकारी देता हूँ।'
          : 'Namaste! I am the Digital India Project Assistant powered by our low-usage Compact Product Catalog and Multi-Provider AI (OpenRouter, Gemini, Groq, OpenAI, Claude). How can I guide you?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      providerBadge: 'Compact KB Ready',
      suggestions: [
        'Documents required for PAN Card?',
        'GST Registration fees & docs?',
        'Company GSTIN & Udyam details?',
        'How to track my application status?',
      ],
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      fetch('/api/ai/providers')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.providers && Array.isArray(data.providers)) {
            setProviders(data.providers);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          language: lang,
          provider: selectedProvider,
          history: messages.slice(-4).map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text.slice(0, 220),
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('AI Gateway returned non-OK status');
      }

      const data = await response.json();
      const opt = data.tokenOptimization;
      const savingsBadge = opt
        ? opt.tokensConsumedByLlm
          ? `${opt.savingsPercent}% fewer prompt tokens`
          : '0 LLM tokens used'
        : undefined;

      const assistantMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        providerBadge: data.providerLabel || 'AI Assistant',
        savingsBadge,
        matchedServices: data.matchedServices || [],
        suggestions: data.suggestions || [],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      // Deterministic client-side compact catalog fallback
      const localRes = getZeroTokenCatalogReply(textToSend, lang);
      const assistantMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: localRes.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        providerBadge: 'Compact Product KB',
        savingsBadge: '0 LLM tokens used',
        matchedServices: localRes.matchedProducts.map((p) => ({
          slug: p.slug,
          name: p.name,
          fee: p.fee,
          govt: p.govt,
        })),
        suggestions: localRes.suggestions,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Compact Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-[4.5rem] right-3.5 lg:bottom-4 lg:right-6 z-40 bg-[#FF671F] hover:bg-[#E55B1B] text-white w-10 h-10 sm:w-auto sm:h-9 sm:px-3 p-0 rounded-full shadow-lg hover:shadow-xl transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
        aria-label="Open Digital India AI Assistant"
      >
        <div className="relative flex items-center justify-center">
          <Bot className="w-4 h-4 sm:w-4 sm:h-4" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#138808] ring-2 ring-white" />
        </div>
        <span className="text-[11px] font-bold hidden sm:inline">AI Help</span>
      </button>

      {/* Smaller Compact Chat Popup */}
      {isOpen && (
        <div className="fixed bottom-[7.5rem] lg:bottom-15 left-3 right-3 sm:left-auto sm:right-6 z-50 sm:w-[328px] h-[370px] max-h-[56vh] lg:max-h-[62vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
          {/* Compact Header */}
          <div className="bg-[#202124] text-white px-3 py-2 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#FF671F] flex items-center justify-center text-white shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold truncate">
                  Digital India Assistant
                </div>
                <div className="text-[9px] text-slate-400 truncate">
                  Compact Product AI · EN / हिंदी
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Multi-Provider Selector Strip */}
          <div className="bg-[#FFFDF8] dark:bg-slate-950 border-b border-[#F1E8D9] dark:border-slate-800 px-2.5 py-1.5 flex items-center justify-between gap-1.5 text-[10px] shrink-0">
            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 shrink-0 font-semibold">
              <Cpu className="w-3 h-3 text-[#FF671F]" />
              <span>Engine:</span>
            </div>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as AiProviderId)}
              className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#FF671F]"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} {p.configured ? '●' : '(Fallback)'}
                </option>
              ))}
            </select>
          </div>

          {/* Messages list */}
          <div className="flex-1 p-2.5 overflow-y-auto space-y-2 text-[11px] bg-[#F7F8FA] dark:bg-slate-950/60">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-xl p-2 leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-[#FF671F] text-white rounded-br-none shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-bl-none shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>

                  {/* Clickable Matched Services */}
                  {m.matchedServices && m.matchedServices.length > 0 && onNavigateToService && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
                      {m.matchedServices.slice(0, 2).map((srv) => (
                        <button
                          key={srv.slug}
                          type="button"
                          onClick={() => {
                            onNavigateToService(srv.slug);
                            setIsOpen(false);
                          }}
                          className="w-full text-left px-2 py-1 rounded-md bg-[#FFF5EE] dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 text-[10px] font-semibold text-[#FF671F] flex items-center justify-between gap-1.5 transition cursor-pointer"
                        >
                          <span className="truncate">
                            {srv.name} (₹{srv.fee}{srv.govt ? ` + ₹${srv.govt}` : ''})
                          </span>
                          <ArrowRight className="w-3 h-3 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-400 mt-0.5 px-1">
                  <span>{m.timestamp}</span>
                  {m.providerBadge && <span>· {m.providerBadge}</span>}
                  {m.savingsBadge && <span className="text-[#138808] font-semibold">· {m.savingsBadge}</span>}
                </div>

                {/* Quick follow-up prompts */}
                {m.suggestions && m.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 max-w-[96%]">
                    {m.suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => handleSend(sug)}
                        className="text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] hover:text-[#FF671F] text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded-md transition text-left cursor-pointer"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div
                role="status"
                aria-busy="true"
                className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 w-44 space-y-1.5"
              >
                <div className="h-2 w-4/5 rounded skeleton-shimmer bg-slate-200 dark:bg-slate-800" />
                <div className="h-2 w-3/5 rounded skeleton-shimmer bg-slate-200 dark:bg-slate-800" />
                <div className="text-[9px] text-slate-400">Routing compact query...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                placeholder={lang === 'hi' ? 'अपना सवाल यहाँ पूछें...' : 'Ask fees, docs, status...'}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#FF671F] focus:bg-white dark:focus:bg-slate-950"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || loading}
                className="bg-[#FF671F] hover:bg-[#E55B1B] text-white p-2 rounded-lg disabled:opacity-40 transition cursor-pointer shrink-0"
                aria-label="Send message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
