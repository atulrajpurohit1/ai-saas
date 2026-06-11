'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BrainCircuit,
  Briefcase,
  CalendarPlus,
  Clock3,
  ClipboardList,
  FileText,
  Loader2,
  PhoneCall,
  Save,
  Sparkles,
  Target,
} from 'lucide-react';
import api from '@/lib/api';

type EntityType = 'lead' | 'deal';

interface DiscoverySession {
  id: string;
  propertyType: string | null;
  buyerRole: string | null;
  currentProvider: string | null;
  guardCount: number | null;
  serviceHours: string | null;
  painPoints: string[];
  riskConcerns: string[];
  decisionTimeline: string | null;
  budgetSensitivity: string | null;
  objections: string[];
  notes: string | null;
  createdAt: string;
}

interface SalesAssessment {
  id: string;
  leadScore: number | null;
  priorityTier: string | null;
  closeReadinessScore: number | null;
  discoveryQualityScore: number | null;
  riskProfile: string | null;
  proposalAngle: string | null;
  recommendedNextAction: string | null;
  missingQuestions: string[];
  objectionRisks: string[];
  summary: string | null;
  createdAt: string;
}

interface DiscoveryGuide {
  questions: string[];
  talkingPoints: string[];
  followUpAngles: string[];
  qualificationChecklist: string[];
}

interface OutreachPlan {
  callOpener: string;
  talkingPoints: string[];
  voicemailScript: string;
  emailSubject: string;
  emailBody: string;
  gatekeeperStrategy: string;
  bestCallWindow: string;
  followUpPlan: string[];
}

interface CallDiscoveryDraft {
  propertyType: string | null;
  buyerRole: string | null;
  currentProvider: string | null;
  guardCount: number | null;
  serviceHours: string | null;
  painPoints: string[];
  riskConcerns: string[];
  decisionTimeline: string | null;
  budgetSensitivity: string | null;
  objections: string[];
  notes: string | null;
}

interface DiscoveryCallIntelligence {
  summary: string;
  discovery: CallDiscoveryDraft;
  buyingSignals: string[];
  riskSignals: string[];
  unansweredQuestions: string[];
  objections: string[];
  decisionMakers: string[];
  recommendedNextAction: string;
  confidenceScore: number;
}

interface DiscoveryLiveCoach {
  completenessScore: number;
  nextBestQuestion: string;
  missedQuestions: string[];
  livePrompts: string[];
  qualificationGaps: string[];
  riskPrompts: string[];
  followUpAngles: string[];
  coachingNote: string;
  confidenceScore: number;
  shouldPauseProposal: boolean;
}

interface ActivitySnapshot {
  id: string;
  type: string;
  subject: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

interface DealMomentum {
  status: 'healthy' | 'watch' | 'stalled' | 'urgent' | 'closed';
  score: number;
  daysOpen: number;
  daysSinceActivity: number | null;
  overdueActivityCount: number;
  pendingActivityCount: number;
  nextActivity: ActivitySnapshot | null;
  lastActivity: ActivitySnapshot | null;
  reasons: string[];
  recommendedAction: string;
}

interface ForecastHistoryPoint {
  id: string;
  score: number | null;
  discoveryQualityScore: number | null;
  createdAt: string;
}

interface DealForecast {
  status: 'commit' | 'likely' | 'watch' | 'at_risk' | 'unscored' | 'closed_won' | 'closed_lost';
  label: string;
  confidence: number;
  probability: number;
  currentReadiness: number | null;
  previousReadiness: number | null;
  readinessChange: number | null;
  trend: 'improving' | 'flat' | 'declining' | 'unknown';
  history: ForecastHistoryPoint[];
  reasons: string[];
  recommendedAction: string;
}

interface PostCloseFeedback {
  status: 'healthy' | 'watch' | 'risk' | 'oversold' | 'learning';
  score: number;
  clientId: string;
  clientName: string;
  dealId: string;
  dealName: string;
  incidentCount: number;
  highSeverityIncidentCount: number;
  openShiftCount: number;
  understaffedShiftCount: number;
  overdueInvoiceCount: number;
  disputedInvoiceCount: number;
  reportCount: number;
  signals: string[];
  salesLessons: string[];
  recommendedAction: string;
}

interface PricingGuardrails {
  status: 'ready' | 'review' | 'protect_margin' | 'blocked';
  confidenceScore: number;
  floorGuidance: string;
  scopeWarnings: string[];
  pricingRisks: string[];
  requiredClarifications: string[];
  recommendedTerms: string[];
  proposalInstruction: string;
}

interface MarketSignalProfile {
  score: number;
  segment: string;
  existingSecurityLikelihood: 'high' | 'medium' | 'low' | 'unknown';
  renewalTimingSignal: 'active' | 'near_term' | 'future' | 'unknown';
  decisionAuthoritySignal: 'identified' | 'influencer' | 'unknown';
  indicators: string[];
  risks: string[];
  recommendedAction: string;
}

interface ValueJustification {
  status: 'proposal_ready' | 'needs_quantification' | 'weak_value_case' | 'blocked';
  score: number;
  estimatedMonthlyGuardHours: number | null;
  scopeComplexity: 'standard' | 'expanded' | 'complex' | 'unknown';
  valueHypothesis: string;
  costOfInaction: string;
  proofPoints: string[];
  quantifiedInputs: string[];
  discoveryGaps: string[];
  proposalBullets: string[];
  recommendedAction: string;
}

interface FollowUpSequenceStep {
  dayOffset: number;
  channel: 'call' | 'email' | 'meeting' | 'task';
  subject: string;
  objective: string;
  description: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
}

interface FollowUpSequence {
  status: 'ready' | 'watch' | 'nurture' | 'blocked';
  cadence: 'accelerated' | 'standard' | 'nurture' | 'rescue';
  score: number;
  recommendedAction: string;
  rationale: string;
  steps: FollowUpSequenceStep[];
  objectionsToAddress: string[];
  stopConditions: string[];
}

interface ObjectionPattern {
  key: string;
  label: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  lostDealCount: number;
  wonDealCount: number;
  openDealCount: number;
  lossRate: number | null;
  outcomeSignal: string;
  examples: string[];
  recommendedResponse: string;
  playbook: string[];
  relatedLeads: Array<{
    id: string;
    name: string;
    company: string;
    status: string;
  }>;
  relatedDeals: Array<{
    id: string;
    name: string;
    stage: string;
    company: string;
  }>;
}

interface DiscoveryForm {
  propertyType: string;
  buyerRole: string;
  currentProvider: string;
  guardCount: string;
  serviceHours: string;
  painPoints: string;
  riskConcerns: string;
  decisionTimeline: string;
  budgetSensitivity: string;
  objections: string;
  notes: string;
}

interface SalesAcceleratorPanelProps {
  entityType: EntityType;
  entityId: string;
}

const emptyForm: DiscoveryForm = {
  propertyType: '',
  buyerRole: '',
  currentProvider: '',
  guardCount: '',
  serviceHours: '',
  painPoints: '',
  riskConcerns: '',
  decisionTimeline: '',
  budgetSensitivity: '',
  objections: '',
  notes: '',
};

const listToText = (items?: string[] | null) => (items || []).join('\n');

const textToList = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const mergeListText = (current: string, next?: string[] | null) =>
  Array.from(
    new Set([
      ...textToList(current),
      ...(next || []).map((item) => item.trim()).filter(Boolean),
    ]),
  ).join('\n');

const mergeNotes = (current: string, next?: string | null) => {
  const cleaned = next?.trim();
  if (!cleaned) return current;
  if (current.toLowerCase().includes(cleaned.toLowerCase())) return current;
  return [current, cleaned].filter(Boolean).join('\n\n');
};

const formFromDiscovery = (discovery?: DiscoverySession | null): DiscoveryForm => {
  if (!discovery) return emptyForm;

  return {
    propertyType: discovery.propertyType || '',
    buyerRole: discovery.buyerRole || '',
    currentProvider: discovery.currentProvider || '',
    guardCount: discovery.guardCount ? String(discovery.guardCount) : '',
    serviceHours: discovery.serviceHours || '',
    painPoints: listToText(discovery.painPoints),
    riskConcerns: listToText(discovery.riskConcerns),
    decisionTimeline: discovery.decisionTimeline || '',
    budgetSensitivity: discovery.budgetSensitivity || '',
    objections: listToText(discovery.objections),
    notes: discovery.notes || '',
  };
};

const scoreColor = (score?: number | null) => {
  if ((score || 0) >= 75) return 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10';
  if ((score || 0) >= 50) return 'text-amber-300 border-amber-400/20 bg-amber-400/10';
  return 'text-rose-300 border-rose-400/20 bg-rose-400/10';
};

const momentumColor = (status?: DealMomentum['status']) => {
  if (status === 'healthy') return 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10';
  if (status === 'watch') return 'text-cyan-300 border-cyan-400/20 bg-cyan-400/10';
  if (status === 'stalled') return 'text-amber-300 border-amber-400/20 bg-amber-400/10';
  if (status === 'urgent') return 'text-rose-300 border-rose-400/20 bg-rose-400/10';
  return 'text-slate-300 border-white/10 bg-white/5';
};

const forecastColor = (status?: DealForecast['status']) => {
  if (status === 'commit' || status === 'closed_won') return 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10';
  if (status === 'likely') return 'text-cyan-300 border-cyan-400/20 bg-cyan-400/10';
  if (status === 'watch') return 'text-amber-300 border-amber-400/20 bg-amber-400/10';
  if (status === 'at_risk' || status === 'closed_lost') return 'text-rose-300 border-rose-400/20 bg-rose-400/10';
  return 'text-slate-300 border-white/10 bg-white/5';
};

const postCloseColor = (status?: PostCloseFeedback['status']) => {
  if (status === 'healthy') return 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10';
  if (status === 'watch') return 'text-cyan-300 border-cyan-400/20 bg-cyan-400/10';
  if (status === 'risk') return 'text-amber-300 border-amber-400/20 bg-amber-400/10';
  if (status === 'oversold') return 'text-rose-300 border-rose-400/20 bg-rose-400/10';
  return 'text-slate-300 border-white/10 bg-white/5';
};

const pricingGuardrailColor = (status?: PricingGuardrails['status']) => {
  if (status === 'ready') return 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10';
  if (status === 'review') return 'text-cyan-300 border-cyan-400/20 bg-cyan-400/10';
  if (status === 'protect_margin') return 'text-amber-300 border-amber-400/20 bg-amber-400/10';
  if (status === 'blocked') return 'text-rose-300 border-rose-400/20 bg-rose-400/10';
  return 'text-slate-300 border-white/10 bg-white/5';
};

const valueJustificationColor = (status?: ValueJustification['status']) => {
  if (status === 'proposal_ready') return 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10';
  if (status === 'needs_quantification') return 'text-cyan-300 border-cyan-400/20 bg-cyan-400/10';
  if (status === 'weak_value_case') return 'text-amber-300 border-amber-400/20 bg-amber-400/10';
  if (status === 'blocked') return 'text-rose-300 border-rose-400/20 bg-rose-400/10';
  return 'text-slate-300 border-white/10 bg-white/5';
};

const followUpSequenceColor = (status?: FollowUpSequence['status']) => {
  if (status === 'ready') return 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10';
  if (status === 'watch') return 'text-amber-300 border-amber-400/20 bg-amber-400/10';
  if (status === 'nurture') return 'text-cyan-300 border-cyan-400/20 bg-cyan-400/10';
  if (status === 'blocked') return 'text-rose-300 border-rose-400/20 bg-rose-400/10';
  return 'text-slate-300 border-white/10 bg-white/5';
};

const severityColor = (severity?: ObjectionPattern['severity']) => {
  if (severity === 'high') return 'text-rose-300 border-rose-400/20 bg-rose-400/10';
  if (severity === 'medium') return 'text-amber-300 border-amber-400/20 bg-amber-400/10';
  return 'text-cyan-300 border-cyan-400/20 bg-cyan-400/10';
};

const fieldClass =
  'w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-600';

export default function SalesAcceleratorPanel({
  entityType,
  entityId,
}: SalesAcceleratorPanelProps) {
  const [form, setForm] = useState<DiscoveryForm>(emptyForm);
  const [discovery, setDiscovery] = useState<DiscoverySession | null>(null);
  const [assessment, setAssessment] = useState<SalesAssessment | null>(null);
  const [guide, setGuide] = useState<DiscoveryGuide | null>(null);
  const [outreach, setOutreach] = useState<OutreachPlan | null>(null);
  const [callTranscript, setCallTranscript] = useState('');
  const [callIntelligence, setCallIntelligence] = useState<DiscoveryCallIntelligence | null>(null);
  const [liveCoach, setLiveCoach] = useState<DiscoveryLiveCoach | null>(null);
  const [momentum, setMomentum] = useState<DealMomentum | null>(null);
  const [forecast, setForecast] = useState<DealForecast | null>(null);
  const [postCloseFeedback, setPostCloseFeedback] = useState<PostCloseFeedback | null>(null);
  const [pricingGuardrails, setPricingGuardrails] = useState<PricingGuardrails | null>(null);
  const [marketSignalProfile, setMarketSignalProfile] = useState<MarketSignalProfile | null>(null);
  const [valueJustification, setValueJustification] = useState<ValueJustification | null>(null);
  const [followUpSequence, setFollowUpSequence] = useState<FollowUpSequence | null>(null);
  const [objectionPatterns, setObjectionPatterns] = useState<ObjectionPattern[]>([]);
  const [generatedProposalId, setGeneratedProposalId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const basePath = useMemo(
    () => `sales-accelerator/${entityType === 'lead' ? 'leads' : 'deals'}/${entityId}`,
    [entityId, entityType],
  );

  useEffect(() => {
    const loadWorkspace = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await api.get(basePath);
        setDiscovery(response.data.discovery || null);
        setAssessment(response.data.assessment || null);
        setMomentum(response.data.momentum || null);
        setForecast(response.data.forecast || null);
        setPostCloseFeedback(response.data.postCloseFeedback || null);
        setPricingGuardrails(response.data.pricingGuardrails || null);
        setMarketSignalProfile(response.data.marketSignalProfile || null);
        setValueJustification(response.data.valueJustification || null);
        setFollowUpSequence(response.data.followUpSequence || null);
        setObjectionPatterns(response.data.objectionPatterns || []);
        setForm(formFromDiscovery(response.data.discovery));
        setCallTranscript('');
        setCallIntelligence(null);
        setLiveCoach(null);
      } catch (err) {
        console.error('Failed to load sales accelerator workspace', err);
        setError('Could not load sales accelerator details.');
      } finally {
        setLoading(false);
      }
    };

    if (entityId) loadWorkspace();
  }, [basePath, entityId]);

  const updateField = (key: keyof DiscoveryForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const payload = () => ({
    propertyType: form.propertyType,
    buyerRole: form.buyerRole,
    currentProvider: form.currentProvider,
    guardCount: form.guardCount ? Number(form.guardCount) : undefined,
    serviceHours: form.serviceHours,
    painPoints: textToList(form.painPoints),
    riskConcerns: textToList(form.riskConcerns),
    decisionTimeline: form.decisionTimeline,
    budgetSensitivity: form.budgetSensitivity,
    objections: textToList(form.objections),
    notes: form.notes,
  });

  const saveDiscovery = async () => {
    setBusy('save');
    setError('');
    setMessage('');

    try {
      const response = await api.post(`${basePath}/discovery`, payload());
      setDiscovery(response.data);
      const workspace = await api.get(basePath);
      setObjectionPatterns(workspace.data.objectionPatterns || []);
      setMomentum(workspace.data.momentum || null);
      setForecast(workspace.data.forecast || null);
      setPostCloseFeedback(workspace.data.postCloseFeedback || null);
      setPricingGuardrails(workspace.data.pricingGuardrails || null);
      setMarketSignalProfile(workspace.data.marketSignalProfile || null);
      setValueJustification(workspace.data.valueJustification || null);
      setFollowUpSequence(workspace.data.followUpSequence || null);
      setMessage('Discovery saved.');
    } catch (err) {
      console.error('Failed to save discovery', err);
      setError('Could not save discovery details.');
    } finally {
      setBusy('');
    }
  };

  const generateGuide = async () => {
    setBusy('guide');
    setError('');
    setMessage('');

    try {
      const response = await api.post(`${basePath}/discovery-guide`);
      setGuide(response.data.guide);
      setMessage(response.data.fallbackUsed ? 'Guide generated with fallback logic.' : 'Guide generated.');
    } catch (err) {
      console.error('Failed to generate discovery guide', err);
      setError('Could not generate discovery guide.');
    } finally {
      setBusy('');
    }
  };

  const coachCall = async () => {
    setBusy('coach');
    setError('');
    setMessage('');

    try {
      const response = await api.post(`${basePath}/live-coach`, {
        transcript: callTranscript.trim(),
      });
      setLiveCoach(response.data.coach);
      setMessage(response.data.fallbackUsed ? 'Live coach refreshed with fallback logic.' : 'Live coach refreshed.');
    } catch (err) {
      console.error('Failed to refresh discovery live coach', err);
      setError('Could not refresh live coach.');
    } finally {
      setBusy('');
    }
  };

  const analyzeCall = async () => {
    const transcript = callTranscript.trim();

    if (transcript.length < 20) {
      setMessage('');
      setError('Add at least 20 characters of call notes before analyzing.');
      return;
    }

    setBusy('call');
    setError('');
    setMessage('');

    try {
      const response = await api.post(`${basePath}/discovery-call`, {
        transcript,
      });
      setCallIntelligence(response.data.intelligence);
      setMessage(response.data.fallbackUsed ? 'Call analyzed with fallback logic.' : 'Call analyzed.');
    } catch (err) {
      console.error('Failed to analyze discovery call', err);
      setError('Could not analyze call notes.');
    } finally {
      setBusy('');
    }
  };

  const applyCallDiscovery = () => {
    if (!callIntelligence) return;

    const draft = callIntelligence.discovery;
    setForm((current) => ({
      ...current,
      propertyType: draft.propertyType || current.propertyType,
      buyerRole: draft.buyerRole || current.buyerRole,
      currentProvider: draft.currentProvider || current.currentProvider,
      guardCount: draft.guardCount ? String(draft.guardCount) : current.guardCount,
      serviceHours: draft.serviceHours || current.serviceHours,
      painPoints: mergeListText(current.painPoints, draft.painPoints),
      riskConcerns: mergeListText(current.riskConcerns, draft.riskConcerns),
      decisionTimeline: draft.decisionTimeline || current.decisionTimeline,
      budgetSensitivity: draft.budgetSensitivity || current.budgetSensitivity,
      objections: mergeListText(current.objections, [
        ...draft.objections,
        ...callIntelligence.objections,
      ]),
      notes: mergeNotes(current.notes, draft.notes || callIntelligence.summary),
    }));
    setError('');
    setMessage('Call intelligence applied to discovery form. Review and save.');
  };

  const generateOutreach = async () => {
    setBusy('outreach');
    setError('');
    setMessage('');

    try {
      const response = await api.post(`${basePath}/outreach`);
      setOutreach(response.data.outreach);
      setMessage(response.data.fallbackUsed ? 'Outreach drafted with fallback logic.' : 'Outreach drafted.');
    } catch (err) {
      console.error('Failed to generate outreach plan', err);
      setError('Could not generate outreach plan.');
    } finally {
      setBusy('');
    }
  };

  const score = async () => {
    setBusy('score');
    setError('');
    setMessage('');

    try {
      const response = await api.post(`${basePath}/score`);
      setAssessment(response.data.assessment);
      const workspace = await api.get(basePath);
      setObjectionPatterns(workspace.data.objectionPatterns || []);
      setMomentum(workspace.data.momentum || null);
      setForecast(workspace.data.forecast || null);
      setPostCloseFeedback(workspace.data.postCloseFeedback || null);
      setPricingGuardrails(workspace.data.pricingGuardrails || null);
      setMarketSignalProfile(workspace.data.marketSignalProfile || null);
      setValueJustification(workspace.data.valueJustification || null);
      setFollowUpSequence(workspace.data.followUpSequence || null);
      setMessage(response.data.fallbackUsed ? 'Assessment generated with fallback logic.' : 'Assessment generated.');
    } catch (err) {
      console.error('Failed to generate sales assessment', err);
      setError('Could not generate sales assessment.');
    } finally {
      setBusy('');
    }
  };

  const generateProposal = async () => {
    setBusy('proposal');
    setError('');
    setMessage('');

    try {
      const response = await api.post(`${basePath}/proposal-from-discovery`);
      setGeneratedProposalId(response.data.proposal.id);
      setPricingGuardrails(response.data.pricingGuardrails || null);
      setValueJustification(response.data.valueJustification || null);
      setFollowUpSequence(response.data.followUpSequence || null);
      setMessage(response.data.fallbackUsed ? 'Proposal drafted with fallback logic.' : 'Proposal drafted.');
    } catch (err) {
      console.error('Failed to generate proposal from discovery', err);
      setError('Capture discovery details before drafting a proposal.');
    } finally {
      setBusy('');
    }
  };

  const createFollowUp = async () => {
    if (entityType !== 'deal') return;

    setBusy('follow-up');
    setError('');
    setMessage('');

    try {
      await api.post(`${basePath}/follow-up`, {
        subject: assessment?.recommendedNextAction || 'Follow up on Sales Accelerator recommendation',
        description: assessment?.summary || assessment?.riskProfile || 'Sales Accelerator follow-up task',
      });
      const workspace = await api.get(basePath);
      setMomentum(workspace.data.momentum || null);
      setForecast(workspace.data.forecast || null);
      setObjectionPatterns(workspace.data.objectionPatterns || []);
      setPostCloseFeedback(workspace.data.postCloseFeedback || null);
      setPricingGuardrails(workspace.data.pricingGuardrails || null);
      setMarketSignalProfile(workspace.data.marketSignalProfile || null);
      setValueJustification(workspace.data.valueJustification || null);
      setFollowUpSequence(workspace.data.followUpSequence || null);
      setMessage('Follow-up task created for tomorrow morning.');
    } catch (err) {
      console.error('Failed to create follow-up task', err);
      setError('Could not create follow-up task.');
    } finally {
      setBusy('');
    }
  };

  const createFollowUpSequence = async () => {
    if (entityType !== 'deal') return;

    setBusy('sequence');
    setError('');
    setMessage('');

    try {
      const response = await api.post(`${basePath}/follow-up-sequence`);
      const workspace = await api.get(basePath);
      setMomentum(workspace.data.momentum || null);
      setForecast(workspace.data.forecast || null);
      setObjectionPatterns(workspace.data.objectionPatterns || []);
      setPostCloseFeedback(workspace.data.postCloseFeedback || null);
      setPricingGuardrails(workspace.data.pricingGuardrails || null);
      setMarketSignalProfile(workspace.data.marketSignalProfile || null);
      setValueJustification(workspace.data.valueJustification || null);
      setFollowUpSequence(workspace.data.followUpSequence || response.data.sequence || null);
      setMessage(
        response.data.skippedDuplicateCount
          ? `Created ${response.data.createdActivities.length} sequence tasks. Skipped ${response.data.skippedDuplicateCount} duplicates.`
          : `Created ${response.data.createdActivities.length} sequence tasks.`,
      );
    } catch (err) {
      console.error('Failed to create follow-up sequence', err);
      setError('Could not create follow-up sequence.');
    } finally {
      setBusy('');
    }
  };

  const renderList = (items: string[]) =>
    items.length === 0 ? (
      <p className="text-sm text-slate-500">No items yet.</p>
    ) : (
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300">
            {item}
          </li>
        ))}
      </ul>
    );

  const callDiscoveryHighlights = callIntelligence
    ? [
        { label: 'Property', value: callIntelligence.discovery.propertyType },
        { label: 'Buyer Role', value: callIntelligence.discovery.buyerRole },
        { label: 'Provider', value: callIntelligence.discovery.currentProvider },
        {
          label: 'Guard Count',
          value: callIntelligence.discovery.guardCount
            ? String(callIntelligence.discovery.guardCount)
            : null,
        },
        { label: 'Hours', value: callIntelligence.discovery.serviceHours },
        { label: 'Timeline', value: callIntelligence.discovery.decisionTimeline },
        { label: 'Budget', value: callIntelligence.discovery.budgetSensitivity },
      ].filter((item) => item.value)
    : [];

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-300">
            <BrainCircuit size={14} />
            Sales Accelerator
          </div>
          <h2 className="text-xl font-extrabold text-white sm:text-2xl">Discovery and Deal Intelligence</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveDiscovery}
            disabled={!!busy || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'save' ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            Save
          </button>
          <button
            type="button"
            onClick={generateGuide}
            disabled={!!busy || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-400/20 bg-indigo-400/10 px-3 py-2 text-xs font-bold text-indigo-200 transition hover:bg-indigo-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'guide' ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}
            Guide
          </button>
          <button
            type="button"
            onClick={analyzeCall}
            disabled={!!busy || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'call' ? <Loader2 className="animate-spin" size={15} /> : <ClipboardList size={15} />}
            Analyze Call
          </button>
          <button
            type="button"
            onClick={coachCall}
            disabled={!!busy || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-2 text-xs font-bold text-fuchsia-200 transition hover:bg-fuchsia-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'coach' ? <Loader2 className="animate-spin" size={15} /> : <BrainCircuit size={15} />}
            Live Coach
          </button>
          <button
            type="button"
            onClick={generateOutreach}
            disabled={!!busy || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'outreach' ? <Loader2 className="animate-spin" size={15} /> : <PhoneCall size={15} />}
            Outreach
          </button>
          <button
            type="button"
            onClick={score}
            disabled={!!busy || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'score' ? <Loader2 className="animate-spin" size={15} /> : <Target size={15} />}
            Score
          </button>
          {entityType === 'deal' && (
            <button
              type="button"
              onClick={generateProposal}
              disabled={!!busy || loading}
              className="inline-flex items-center gap-2 rounded-xl border border-purple-400/20 bg-purple-400/10 px-3 py-2 text-xs font-bold text-purple-200 transition hover:bg-purple-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === 'proposal' ? <Loader2 className="animate-spin" size={15} /> : <FileText size={15} />}
              Proposal
            </button>
          )}
          {entityType === 'deal' && (
            <button
              type="button"
              onClick={createFollowUp}
              disabled={!!busy || loading || !assessment}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === 'follow-up' ? <Loader2 className="animate-spin" size={15} /> : <CalendarPlus size={15} />}
              Follow-Up
            </button>
          )}
          {entityType === 'deal' && (
            <button
              type="button"
              onClick={createFollowUpSequence}
              disabled={!!busy || loading || !followUpSequence}
              className="inline-flex items-center gap-2 rounded-xl border border-teal-400/20 bg-teal-400/10 px-3 py-2 text-xs font-bold text-teal-200 transition hover:bg-teal-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === 'sequence' ? <Loader2 className="animate-spin" size={15} /> : <CalendarPlus size={15} />}
              Sequence
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 py-12 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-cyan-300" size={24} />
          Loading sales intelligence...
        </div>
      ) : (
        <div className="space-y-6">
          {(error || message || generatedProposalId) && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                error
                  ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                  : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              {error || message}
              {generatedProposalId && (
                <Link href="/proposals" className="ml-2 font-bold text-white underline-offset-4 hover:underline">
                  Open proposals
                </Link>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-4">
            {[
              ['Lead Score', assessment?.leadScore],
              ['Discovery', assessment?.discoveryQualityScore],
              ['Readiness', assessment?.closeReadinessScore],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</div>
                <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-lg font-extrabold ${scoreColor(value as number | null)}`}>
                  {typeof value === 'number' ? value : '--'}
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Priority</div>
              <div className="mt-3 text-lg font-extrabold uppercase text-white">{assessment?.priorityTier || '--'}</div>
            </div>
          </div>

          {marketSignalProfile && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                    <Target size={14} />
                    Market Signals
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{marketSignalProfile.recommendedAction}</p>
                </div>
                <span className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase ${scoreColor(marketSignalProfile.score)}`}>
                  {marketSignalProfile.score} market
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Segment</div>
                  <div className="mt-2 text-sm font-bold capitalize text-white">{marketSignalProfile.segment}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Security</div>
                  <div className="mt-2 text-sm font-bold capitalize text-white">{marketSignalProfile.existingSecurityLikelihood}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Renewal</div>
                  <div className="mt-2 text-sm font-bold capitalize text-white">
                    {marketSignalProfile.renewalTimingSignal.replace(/_/g, ' ')}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Authority</div>
                  <div className="mt-2 text-sm font-bold capitalize text-white">{marketSignalProfile.decisionAuthoritySignal}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Indicators</div>
                  {renderList(marketSignalProfile.indicators)}
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Risks</div>
                  {renderList(marketSignalProfile.risks)}
                </div>
              </div>
            </div>
          )}

          {valueJustification && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                    <FileText size={14} />
                    Value Justification
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{valueJustification.recommendedAction}</p>
                </div>
                <span className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase ${valueJustificationColor(valueJustification.status)}`}>
                  {valueJustification.status.replace(/_/g, ' ')} {valueJustification.score}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Monthly Hours</div>
                  <div className="mt-2 text-sm font-bold text-white">
                    {valueJustification.estimatedMonthlyGuardHours ?? '--'}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Scope</div>
                  <div className="mt-2 text-sm font-bold capitalize text-white">
                    {valueJustification.scopeComplexity}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</div>
                  <div className="mt-2 text-sm font-bold capitalize text-white">
                    {valueJustification.status.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Value Hypothesis</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{valueJustification.valueHypothesis}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Cost Of Inaction</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{valueJustification.costOfInaction}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Proof Points</div>
                  {renderList(valueJustification.proofPoints)}
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Quantified Inputs</div>
                  {renderList(valueJustification.quantifiedInputs)}
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Discovery Gaps</div>
                  {renderList(valueJustification.discoveryGaps)}
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Proposal Bullets</div>
                  {renderList(valueJustification.proposalBullets)}
                </div>
              </div>
            </div>
          )}

          {entityType === 'deal' && followUpSequence && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                    <CalendarPlus size={14} />
                    Follow-Up Sequence
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{followUpSequence.recommendedAction}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase ${followUpSequenceColor(followUpSequence.status)}`}>
                    {followUpSequence.status} {followUpSequence.score}
                  </span>
                  <button
                    type="button"
                    onClick={createFollowUpSequence}
                    disabled={!!busy || loading}
                    className="inline-flex w-fit items-center gap-2 rounded-xl border border-teal-400/20 bg-teal-400/10 px-3 py-2 text-xs font-bold text-teal-200 transition hover:bg-teal-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy === 'sequence' ? <Loader2 className="animate-spin" size={15} /> : <CalendarPlus size={15} />}
                    Create Sequence
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Cadence</div>
                  <div className="mt-2 text-sm font-bold capitalize text-white">{followUpSequence.cadence}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Steps</div>
                  <div className="mt-2 text-sm font-bold text-white">{followUpSequence.steps.length}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</div>
                  <div className="mt-2 text-sm font-bold capitalize text-white">{followUpSequence.status}</div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Rationale</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{followUpSequence.rationale}</p>
              </div>

              <div className="mt-4 space-y-3">
                {followUpSequence.steps.map((step) => (
                  <div
                    key={`${step.dayOffset}-${step.subject}`}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-bold text-white">{step.subject}</div>
                        <div className="mt-1 text-xs capitalize text-slate-500">
                          {step.channel} - day {step.dayOffset} - {new Date(step.dueDate).toLocaleString()}
                        </div>
                      </div>
                      <span className={`inline-flex w-fit rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${severityColor(step.priority === 'high' ? 'high' : step.priority === 'medium' ? 'medium' : 'low')}`}>
                        {step.priority}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{step.objective}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{step.description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Objections To Address</div>
                  {renderList(followUpSequence.objectionsToAddress)}
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Stop Conditions</div>
                  {renderList(followUpSequence.stopConditions)}
                </div>
              </div>
            </div>
          )}

          {assessment && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Risk Profile</div>
                <p className="text-sm leading-6 text-slate-300">{assessment.riskProfile || 'No risk profile generated.'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Proposal Angle</div>
                <p className="text-sm leading-6 text-slate-300">{assessment.proposalAngle || 'No proposal angle generated.'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Next Action</div>
                <p className="text-sm leading-6 text-slate-300">{assessment.recommendedNextAction || 'No next action generated.'}</p>
              </div>
            </div>
          )}

          {entityType === 'deal' && forecast && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                    <Target size={14} />
                    Forecast
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{forecast.recommendedAction}</p>
                </div>
                <span className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase ${forecastColor(forecast.status)}`}>
                  {forecast.label} {forecast.confidence}%
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Probability</div>
                  <div className="mt-2 text-sm font-bold text-white">{forecast.probability}%</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Current</div>
                  <div className="mt-2 text-sm font-bold text-white">{forecast.currentReadiness ?? '--'}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Change</div>
                  <div className="mt-2 text-sm font-bold text-white">
                    {forecast.readinessChange === null
                      ? '--'
                      : `${forecast.readinessChange > 0 ? '+' : ''}${forecast.readinessChange}`}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Trend</div>
                  <div className="mt-2 text-sm font-bold capitalize text-white">{forecast.trend}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Forecast Reasons</div>
                  {renderList(forecast.reasons)}
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Readiness History</div>
                  {forecast.history.length === 0 ? (
                    <p className="text-sm text-slate-500">No history yet.</p>
                  ) : (
                    <div className="flex h-28 items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      {forecast.history.map((point) => (
                        <div key={point.id} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                          <div className="flex h-16 w-full items-end rounded-lg bg-black/20">
                            <div
                              className="w-full rounded-lg bg-cyan-400/60"
                              style={{ height: `${Math.max(8, point.score ?? 0)}%` }}
                            />
                          </div>
                          <div className="text-[10px] font-bold text-slate-500">{point.score ?? '--'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {entityType === 'deal' && pricingGuardrails && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                    <AlertTriangle size={14} />
                    Pricing Guardrails
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{pricingGuardrails.floorGuidance}</p>
                </div>
                <span className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase ${pricingGuardrailColor(pricingGuardrails.status)}`}>
                  {pricingGuardrails.status.replace('_', ' ')} {pricingGuardrails.confidenceScore}
                </span>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Proposal Instruction</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{pricingGuardrails.proposalInstruction}</p>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Scope Warnings</div>
                  {renderList(pricingGuardrails.scopeWarnings)}
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Pricing Risks</div>
                  {renderList(pricingGuardrails.pricingRisks)}
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Clarify Before Pricing</div>
                  {renderList(pricingGuardrails.requiredClarifications)}
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Recommended Terms</div>
                  {renderList(pricingGuardrails.recommendedTerms)}
                </div>
              </div>
            </div>
          )}

          {entityType === 'deal' && momentum && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                    <Clock3 size={14} />
                    Deal Momentum
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{momentum.recommendedAction}</p>
                </div>
                <span className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase ${momentumColor(momentum.status)}`}>
                  {momentum.status} {momentum.score}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Last Touch</div>
                  <div className="mt-2 text-sm font-bold text-white">
                    {momentum.daysSinceActivity === null ? 'None' : `${momentum.daysSinceActivity}d ago`}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pending</div>
                  <div className="mt-2 text-sm font-bold text-white">{momentum.pendingActivityCount}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Overdue</div>
                  <div className="mt-2 text-sm font-bold text-white">{momentum.overdueActivityCount}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Momentum Reasons</div>
                  {renderList(momentum.reasons)}
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Next Scheduled Step</div>
                  {momentum.nextActivity ? (
                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300">
                      <div className="font-bold text-white">{momentum.nextActivity.subject}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {momentum.nextActivity.dueDate
                          ? new Date(momentum.nextActivity.dueDate).toLocaleString()
                          : 'No due date'}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No next step scheduled.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {entityType === 'deal' && postCloseFeedback && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                    <Briefcase size={14} />
                    Post-Close Feedback
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{postCloseFeedback.recommendedAction}</p>
                </div>
                <span className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase ${postCloseColor(postCloseFeedback.status)}`}>
                  {postCloseFeedback.status} {postCloseFeedback.score}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Incidents</div>
                  <div className="mt-2 text-sm font-bold text-white">{postCloseFeedback.incidentCount}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Understaffed</div>
                  <div className="mt-2 text-sm font-bold text-white">{postCloseFeedback.understaffedShiftCount}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Disputes</div>
                  <div className="mt-2 text-sm font-bold text-white">{postCloseFeedback.disputedInvoiceCount}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Reports</div>
                  <div className="mt-2 text-sm font-bold text-white">{postCloseFeedback.reportCount}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Operational Signals</div>
                  {renderList(postCloseFeedback.signals)}
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Sales Lessons</div>
                  {renderList(postCloseFeedback.salesLessons)}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <PhoneCall size={14} />
                Discovery Call
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={coachCall}
                  disabled={!!busy || loading}
                  className="inline-flex w-fit items-center gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-2 text-xs font-bold text-fuchsia-200 transition hover:bg-fuchsia-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy === 'coach' ? <Loader2 className="animate-spin" size={15} /> : <BrainCircuit size={15} />}
                  Coach
                </button>
                <button
                  type="button"
                  onClick={analyzeCall}
                  disabled={!!busy || loading}
                  className="inline-flex w-fit items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy === 'call' ? <Loader2 className="animate-spin" size={15} /> : <ClipboardList size={15} />}
                  Analyze
                </button>
              </div>
            </div>

            <textarea
              className={`${fieldClass} min-h-32 resize-y`}
              placeholder="Paste call notes or transcript"
              value={callTranscript}
              onChange={(event) => setCallTranscript(event.target.value)}
            />

            {liveCoach && (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Next Best Question</div>
                      <p className="mt-2 text-sm leading-6 text-white">{liveCoach.nextBestQuestion}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${scoreColor(liveCoach.completenessScore)}`}>
                        {liveCoach.completenessScore}% complete
                      </span>
                      {liveCoach.shouldPauseProposal && (
                        <span className="inline-flex w-fit shrink-0 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300">
                          pause proposal
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{liveCoach.coachingNote}</p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Live Prompts</div>
                    {renderList(liveCoach.livePrompts)}
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Missed Questions</div>
                    {renderList(liveCoach.missedQuestions)}
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Qualification Gaps</div>
                    {renderList(liveCoach.qualificationGaps)}
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Risk Prompts</div>
                    {renderList(liveCoach.riskPrompts)}
                  </div>
                  <div className="lg:col-span-2">
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Follow-Up Angles</div>
                    {renderList(liveCoach.followUpAngles)}
                  </div>
                </div>
              </div>
            )}

            {callIntelligence && (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Call Summary</div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{callIntelligence.summary}</p>
                    </div>
                    <span className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${scoreColor(callIntelligence.confidenceScore)}`}>
                      {callIntelligence.confidenceScore}% confidence
                    </span>
                  </div>
                  <div className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-500">Next Action</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{callIntelligence.recommendedNextAction}</p>
                  <button
                    type="button"
                    onClick={applyCallDiscovery}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400/20"
                  >
                    <Save size={15} />
                    Apply to Form
                  </button>
                </div>

                {callDiscoveryHighlights.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {callDiscoveryHighlights.map((item) => (
                      <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{item.label}</div>
                        <div className="mt-2 text-sm font-bold text-white">{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Buying Signals</div>
                    {renderList(callIntelligence.buyingSignals)}
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Risk Signals</div>
                    {renderList(callIntelligence.riskSignals)}
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Unanswered Questions</div>
                    {renderList(callIntelligence.unansweredQuestions)}
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Decision Makers</div>
                    {renderList(callIntelligence.decisionMakers)}
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Call Objections</div>
                    {renderList(callIntelligence.objections)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <input className={fieldClass} placeholder="Property type" value={form.propertyType} onChange={(e) => updateField('propertyType', e.target.value)} />
                <input className={fieldClass} placeholder="Buyer role" value={form.buyerRole} onChange={(e) => updateField('buyerRole', e.target.value)} />
                <input className={fieldClass} placeholder="Current provider" value={form.currentProvider} onChange={(e) => updateField('currentProvider', e.target.value)} />
                <input className={fieldClass} type="number" min="1" placeholder="Guard count" value={form.guardCount} onChange={(e) => updateField('guardCount', e.target.value)} />
                <input className={fieldClass} placeholder="Service hours" value={form.serviceHours} onChange={(e) => updateField('serviceHours', e.target.value)} />
                <input className={fieldClass} placeholder="Decision timeline" value={form.decisionTimeline} onChange={(e) => updateField('decisionTimeline', e.target.value)} />
                <input className={fieldClass} placeholder="Budget sensitivity" value={form.budgetSensitivity} onChange={(e) => updateField('budgetSensitivity', e.target.value)} />
              </div>

              <textarea className={`${fieldClass} min-h-24 resize-y`} placeholder="Pain points" value={form.painPoints} onChange={(e) => updateField('painPoints', e.target.value)} />
              <textarea className={`${fieldClass} min-h-24 resize-y`} placeholder="Risk concerns" value={form.riskConcerns} onChange={(e) => updateField('riskConcerns', e.target.value)} />
              <textarea className={`${fieldClass} min-h-24 resize-y`} placeholder="Objections" value={form.objections} onChange={(e) => updateField('objections', e.target.value)} />
              <textarea className={`${fieldClass} min-h-28 resize-y`} placeholder="Discovery notes" value={form.notes} onChange={(e) => updateField('notes', e.target.value)} />
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <ClipboardList size={14} />
                  Missing Questions
                </div>
                {renderList(assessment?.missingQuestions || [])}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <AlertTriangle size={14} />
                  Objection Coaching
                </div>
                {renderList(
                  assessment?.objectionRisks?.length
                    ? assessment.objectionRisks
                    : textToList(form.objections),
                  )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <AlertTriangle size={14} />
                  Objection Patterns
                </div>
                {objectionPatterns.length === 0 ? (
                  <p className="text-sm text-slate-500">No learned pattern for these objections yet.</p>
                ) : (
                  <div className="space-y-4">
                    {objectionPatterns.map((pattern) => (
                      <div key={pattern.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-white">{pattern.label}</div>
                            <div className="mt-1 text-xs text-slate-500">{pattern.count} historical mentions</div>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${severityColor(pattern.severity)}`}>
                            {pattern.severity}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-slate-300">{pattern.recommendedResponse}</p>
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Outcome Signal</div>
                          <p className="text-sm leading-6 text-slate-300">{pattern.outcomeSignal}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            <span>{pattern.lostDealCount} lost</span>
                            <span>{pattern.wonDealCount} won</span>
                            <span>{pattern.openDealCount} open</span>
                            <span>{pattern.lossRate === null ? '--' : `${pattern.lossRate}%`} loss</span>
                          </div>
                        </div>
                        <div className="mt-3">{renderList(pattern.playbook.slice(0, 3))}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <PhoneCall size={14} />
                  Outreach
                </div>
                {outreach ? (
                  <div className="space-y-4 text-sm leading-6 text-slate-300">
                    <div>
                      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">Call Opener</div>
                      <p>{outreach.callOpener}</p>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">Best Call Window</div>
                      <p>{outreach.bestCallWindow}</p>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">Talking Points</div>
                      {renderList(outreach.talkingPoints)}
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">Voicemail</div>
                      <p>{outreach.voicemailScript}</p>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">Email</div>
                      <p className="font-bold text-white">{outreach.emailSubject}</p>
                      <p className="mt-2 whitespace-pre-line">{outreach.emailBody}</p>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">Gatekeeper Strategy</div>
                      <p>{outreach.gatekeeperStrategy}</p>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">Follow-Up Plan</div>
                      {renderList(outreach.followUpPlan)}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No outreach generated yet.</p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <Sparkles size={14} />
                  Discovery Guide
                </div>
                {guide ? (
                  <div className="space-y-4">
                    <div>{renderList(guide.questions)}</div>
                    <div>{renderList(guide.talkingPoints)}</div>
                    <div>{renderList(guide.followUpAngles)}</div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No guide generated yet.</p>
                )}
              </div>
            </div>
          </div>

          {discovery && (
            <div className="text-xs text-slate-500">
              Last discovery saved {new Date(discovery.createdAt).toLocaleString()}.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
