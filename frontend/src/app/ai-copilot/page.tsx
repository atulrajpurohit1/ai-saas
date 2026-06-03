'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  AiConversationRecord,
  askCopilot,
  CopilotAnswer,
  getCopilotHistory,
  getCopilotSuggestedQuestions,
} from '@/lib/ai-copilot';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  Database,
  History,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Send,
  Sparkles,
} from 'lucide-react';

type ChatMessage =
  | { id: string; role: 'user'; content: string; createdAt: string }
  | { id: string; role: 'assistant'; content: string; createdAt: string; answer: CopilotAnswer };

function confidenceLabel(score: number) {
  if (score >= 0.85) return 'High';
  if (score >= 0.7) return 'Medium';
  return 'Low';
}

function confidenceClass(score: number) {
  if (score >= 0.85) return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200';
  if (score >= 0.7) return 'border-sky-400/20 bg-sky-400/10 text-sky-200';
  return 'border-amber-400/20 bg-amber-400/10 text-amber-200';
}

function sourceLabel(source: string) {
  return source.replace(/_/g, ' ');
}

export default function AiCopilotPage() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<AiConversationRecord[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const latestAnswer = useMemo(
    () => [...messages].reverse().find((message): message is Extract<ChatMessage, { role: 'assistant' }> => message.role === 'assistant'),
    [messages],
  );

  const loadSidebarData = async () => {
    setHistoryLoading(true);
    try {
      const [historyData, suggestionData] = await Promise.all([
        getCopilotHistory(15),
        getCopilotSuggestedQuestions(),
      ]);
      setHistory(historyData);
      setSuggestions(suggestionData);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load AI Copilot context.'));
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadSidebarData();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const submitQuestion = async (value = question) => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: now,
    };

    setMessages((current) => [...current, userMessage]);
    setQuestion('');
    setLoading(true);
    setError('');

    try {
      const answer = await askCopilot(trimmed);
      setMessages((current) => [
        ...current,
        {
          id: answer.conversationId || `assistant-${Date.now()}`,
          role: 'assistant',
          content: answer.answer,
          createdAt: answer.createdAt,
          answer,
        },
      ]);
      await loadSidebarData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'AI Copilot could not answer that question.'));
    } finally {
      setLoading(false);
    }
  };

  const hydrateFromHistory = (item: AiConversationRecord) => {
    setMessages([
      {
        id: `history-user-${item.id}`,
        role: 'user',
        content: item.question,
        createdAt: item.createdAt,
      },
      {
        id: item.id,
        role: 'assistant',
        content: item.answer,
        createdAt: item.createdAt,
        answer: {
          conversationId: item.id,
          question: item.question,
          answer: item.answer,
          confidenceScore: item.confidenceScore,
          source: 'rule_based',
          intent: 'general',
          sources: item.sourcesUsed,
          actions: item.sourcesUsed
            .filter((source) => source.url)
            .map((source) => ({
              label: `Open ${sourceLabel(source.type)}`,
              type: 'dashboard',
              url: source.url as string,
            })),
          suggestedQuestions: suggestions,
          createdAt: item.createdAt,
        },
      },
    ]);
  };

  return (
    <DashboardLayout allowedRoles={['admin', 'finance']}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <Bot className="text-sky-300" size={30} />
            AI Copilot
          </h2>
          <p className="mt-2 text-slate-400">Ask operational, staffing, incident, billing, and revenue questions in plain language.</p>
        </div>
        <button
          type="button"
          onClick={loadSidebarData}
          disabled={historyLoading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
        >
          {historyLoading ? <Loader2 className="animate-spin" size={17} /> : <RefreshCcw size={17} />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex min-h-[680px] flex-col rounded-2xl border border-white/10 bg-white/[0.04]">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
              <MessageSquare size={18} className="text-sky-300" />
              Conversation
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-6">
                <div className="mb-4 flex items-center gap-3 text-lg font-bold text-white">
                  <Sparkles className="text-indigo-300" size={22} />
                  Suggested Questions
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {suggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => submitQuestion(item)}
                      className="rounded-xl border border-white/10 bg-slate-950/35 px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:border-indigo-400/40 hover:bg-indigo-400/10"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-5 py-4 ${
                    message.role === 'user'
                      ? 'bg-indigo-500 text-white'
                      : 'border border-white/10 bg-slate-950/45 text-slate-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>

                  {message.role === 'assistant' && (
                    <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${confidenceClass(message.answer.confidenceScore)}`}>
                          {confidenceLabel(message.answer.confidenceScore)} confidence ({Math.round(message.answer.confidenceScore * 100)}%)
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                          {message.answer.source.replace('_', ' ')}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                          {message.answer.intent}
                        </span>
                      </div>

                      {message.answer.actions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {message.answer.actions.slice(0, 5).map((action) => (
                            <Link
                              key={`${action.label}-${action.url}`}
                              href={action.url}
                              className="inline-flex items-center gap-2 rounded-xl bg-sky-500/15 px-3 py-2 text-xs font-bold text-sky-100 transition hover:bg-sky-500/25"
                            >
                              {action.label}
                              <ArrowUpRight size={14} />
                            </Link>
                          ))}
                        </div>
                      )}

                      {message.answer.sources.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                            <Database size={14} />
                            Sources
                          </div>
                          <div className="space-y-2">
                            {message.answer.sources.slice(0, 6).map((source) => (
                              <div key={`${source.type}-${source.id || source.title}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="font-bold text-white">{source.title}</div>
                                  <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] font-semibold uppercase text-slate-400">
                                    {sourceLabel(source.type)}
                                  </span>
                                </div>
                                {source.snippet && (
                                  <p className="mt-2 text-xs leading-5 text-slate-400">{source.snippet}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-5 py-4 text-sm font-semibold text-slate-300">
                  <Loader2 className="animate-spin text-sky-300" size={18} />
                  Thinking through your data...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitQuestion();
            }}
            className="border-t border-white/10 p-4 sm:p-5"
          >
            <div className="flex gap-3">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submitQuestion();
                  }
                }}
                rows={2}
                className="min-h-12 flex-1 resize-none rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400"
                placeholder="Ask about incidents, invoices, guards, clients, sites, reports, or revenue..."
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Ask AI Copilot"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
              <CheckCircle2 className="text-emerald-300" size={20} />
              Quick Prompts
            </h3>
            <div className="space-y-2">
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => submitQuestion(item)}
                  disabled={loading}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/35 px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
              <History className="text-sky-300" size={20} />
              Recent Questions
            </h3>
            {historyLoading ? (
              <div className="py-10 text-center text-sm text-slate-500">
                <Loader2 className="mx-auto mb-2 animate-spin text-sky-300" size={20} />
                Loading history...
              </div>
            ) : history.length > 0 ? (
              <div className="space-y-2">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => hydrateFromHistory(item)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/35 p-3 text-left transition hover:bg-white/10"
                  >
                    <div className="line-clamp-2 text-sm font-bold text-white">{item.question}</div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <Clock size={13} />
                      {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
                No copilot history yet.
              </div>
            )}
          </section>

          {latestAnswer && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="mb-3 text-lg font-bold text-white">Last Answer</h3>
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${confidenceClass(latestAnswer.answer.confidenceScore)}`}>
                {Math.round(latestAnswer.answer.confidenceScore * 100)}% confidence
              </div>
              <p className="mt-3 line-clamp-5 text-sm leading-6 text-slate-300">
                {latestAnswer.content}
              </p>
            </section>
          )}
        </aside>
      </div>
    </DashboardLayout>
  );
}
