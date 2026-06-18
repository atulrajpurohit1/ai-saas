'use client';

import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import {
  getCallTranscriptionStatus,
  transcribeCallAudio,
  type CallTranscriptionStatus,
  type CallTranscriptionResult,
} from '@/lib/call-transcription';
import { analyzeDiscoveryCall, coachDiscoveryCall } from '@/lib/sales-accelerator';
import { AlertTriangle, BrainCircuit, CheckCircle2, FileAudio, Loader2, Mic, Save, Upload } from 'lucide-react';

interface LeadOption {
  id: string;
  name: string;
  company: string;
}

interface DealOption {
  id: string;
  name: string;
  lead: { name: string; company: string };
}

export default function SalesCallsPage() {
  const [entityType, setEntityType] = useState<'leads' | 'deals'>('deals');
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [entityId, setEntityId] = useState('');
  const [transcript, setTranscript] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<CallTranscriptionStatus | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<CallTranscriptionResult | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [coach, setCoach] = useState<any>(null);
  const [loading, setLoading] = useState<'data' | 'transcribe' | 'coach' | 'analysis' | null>('data');
  const [error, setError] = useState('');

  const options = useMemo(() => {
    return entityType === 'deals'
      ? deals.map((deal) => ({ id: deal.id, label: `${deal.name} - ${deal.lead.company}` }))
      : leads.map((lead) => ({ id: lead.id, label: `${lead.company} (${lead.name})` }));
  }, [deals, entityType, leads]);

  useEffect(() => {
    const loadData = async () => {
      setError('');
      setLoading('data');
      try {
        const [leadRes, dealRes, transcriptionData] = await Promise.all([
          api.get('leads'),
          api.get('deals'),
          getCallTranscriptionStatus(),
        ]);
        setLeads(leadRes.data);
        setDeals(dealRes.data);
        setTranscriptionStatus(transcriptionData);
        setEntityId(dealRes.data?.[0]?.id || leadRes.data?.[0]?.id || '');
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Unable to load leads and deals.');
      } finally {
        setLoading(null);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const nextId = options[0]?.id || '';
    if (!options.some((option) => option.id === entityId)) {
      setEntityId(nextId);
    }
  }, [entityId, options]);

  const runCoach = async () => {
    if (!entityId) return;
    setError('');
    setLoading('coach');
    try {
      setCoach(await coachDiscoveryCall(entityType, entityId, transcript));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Live coaching failed.');
    } finally {
      setLoading(null);
    }
  };

  const transcribeAudio = async () => {
    if (!audioFile) return;
    setError('');
    setTranscriptionResult(null);
    setLoading('transcribe');
    try {
      const result = await transcribeCallAudio(audioFile);
      setTranscriptionResult(result);
      setTranscript(result.transcript);
      setAnalysis(null);
      setCoach(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Audio transcription failed.');
    } finally {
      setLoading(null);
    }
  };

  const runAnalysis = async () => {
    if (!entityId) return;
    setError('');
    setLoading('analysis');
    try {
      setAnalysis(await analyzeDiscoveryCall(entityType, entityId, transcript));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Discovery call analysis failed.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold sm:text-3xl">Sales Calls</h2>
          <p className="text-muted-foreground">Paste call notes or transcripts for live coaching and discovery capture.</p>
        </div>
        <div className="grid w-full grid-cols-2 rounded-lg border border-white/10 bg-white/5 p-1 sm:inline-flex sm:w-auto">
          {(['deals', 'leads'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setEntityType(item);
                setAnalysis(null);
                setCoach(null);
              }}
              className={`rounded-md px-4 py-2 text-sm font-bold capitalize transition ${
                entityType === item ? 'bg-primary text-white' : 'text-muted-foreground hover:text-white'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-rose-100">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)] xl:gap-6">
        <section className="glass-card min-w-0 rounded-lg border border-white/10 p-4 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
              <Mic size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Transcript Capture</h3>
              <p className="text-sm text-muted-foreground">Use text from phone, Zoom, or manual notes.</p>
            </div>
          </div>

          <div className="space-y-4">
            <select
              value={entityId}
              onChange={(event) => setEntityId(event.target.value)}
              disabled={loading === 'data'}
              className="min-h-11 w-full rounded-lg border border-white/10 bg-[#111827] px-3 text-white outline-none focus:border-indigo-400 disabled:opacity-50"
            >
              {options.length === 0 && <option value="">No records available</option>}
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 font-bold text-white">
                    <FileAudio size={18} className="text-indigo-300" />
                    Audio Transcription
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {transcriptionStatus?.configured
                      ? `${transcriptionStatus.provider} ${transcriptionStatus.model}, max ${transcriptionStatus.max_file_mb}MB`
                      : 'Configure OPENAI_API_KEY to enable audio transcription.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={transcribeAudio}
                  disabled={!audioFile || !transcriptionStatus?.configured || loading !== null}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-50 sm:w-auto"
                >
                  {loading === 'transcribe' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Transcribe
                </button>
              </div>

              <label className="flex min-h-20 cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/15 bg-white/5 p-4 text-center transition hover:bg-white/10">
                <span className="text-sm text-slate-300">
                  {audioFile ? audioFile.name : 'Choose MP3, WAV, M4A, MP4, WebM, OGG, or FLAC'}
                </span>
                <input
                  type="file"
                  accept="audio/*,video/mp4,video/webm,.m4a,.mp3,.wav,.webm,.ogg,.flac,.mp4"
                  className="hidden"
                  onChange={(event) => {
                    setAudioFile(event.target.files?.[0] || null);
                    setTranscriptionResult(null);
                  }}
                />
              </label>

              {transcriptionResult && (
                <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                  Transcribed {Math.round(transcriptionResult.size_bytes / 1024)}KB in {Math.round(transcriptionResult.elapsed_ms / 1000)}s.
                </div>
              )}
            </div>

            <textarea
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Paste discovery call transcript or notes..."
              className="min-h-56 w-full rounded-lg border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white outline-none focus:border-indigo-400 sm:min-h-72"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={runCoach}
                disabled={!entityId || loading !== null}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                {loading === 'coach' ? <Loader2 size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
                Live Coach
              </button>
              <button
                type="button"
                onClick={runAnalysis}
                disabled={!entityId || transcript.trim().length < 20 || loading !== null}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {loading === 'analysis' ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Analyze & Save
              </button>
            </div>
          </div>
        </section>

        <section className="min-w-0 space-y-5 xl:space-y-6">
          <ResultPanel
            title="Live Coach"
            empty="Run live coaching to see missed questions, next best question, and proposal pause guidance."
            data={coach}
            fields={['nextBestQuestion', 'coachingNote', 'completenessScore', 'shouldPauseProposal']}
          />
          <ResultPanel
            title="Discovery Analysis"
            empty="Analyze and save the call to capture discovery signals on the selected lead or deal."
            data={analysis}
            fields={['summary', 'recommendedNextAction', 'confidenceScore']}
          />
        </section>
      </div>
    </DashboardLayout>
  );
}

function ResultPanel({
  title,
  empty,
  data,
  fields,
}: {
  title: string;
  empty: string;
  data: any;
  fields: string[];
}) {
  return (
    <div className="glass-card rounded-lg border border-white/10 p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <CheckCircle2 size={18} className="text-emerald-300" />
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      {!data ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          {fields.map((field) => (
            <div key={field} className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{field}</p>
              <p className="whitespace-pre-wrap text-slate-100">{String(data[field] ?? 'Not captured')}</p>
            </div>
          ))}
          {Array.isArray(data.missedQuestions) && data.missedQuestions.length > 0 && (
            <ListBlock title="Missed Questions" items={data.missedQuestions} />
          )}
          {Array.isArray(data.unansweredQuestions) && data.unansweredQuestions.length > 0 && (
            <ListBlock title="Unanswered Questions" items={data.unansweredQuestions} />
          )}
          {Array.isArray(data.buyingSignals) && data.buyingSignals.length > 0 && (
            <ListBlock title="Buying Signals" items={data.buyingSignals} />
          )}
          {Array.isArray(data.riskSignals) && data.riskSignals.length > 0 && (
            <ListBlock title="Risk Signals" items={data.riskSignals} />
          )}
        </div>
      )}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="space-y-2 text-slate-100">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
