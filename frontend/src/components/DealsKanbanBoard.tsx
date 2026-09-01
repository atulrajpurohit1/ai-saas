'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { toast } from 'sonner';
import { AlertTriangle, GaugeCircle, Target } from 'lucide-react';
import { Deal, DEAL_STAGES, DEAL_STAGE_COLORS, DealStage, normalizeStage, updateDealStage } from '@/lib/deals';
import { formatEnumLabel } from '@/lib/format';
import { getApiErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/utils';

const scoreClass = (score?: number | null) => {
  if (score === null || score === undefined) return 'bg-muted text-muted-foreground';
  if (score >= 75) return 'bg-success-wash text-success';
  if (score >= 50) return 'bg-warning-wash text-warning';
  return 'bg-error-wash text-error';
};

const riskClass = (risk?: string | null) => {
  const normalized = (risk || '').toLowerCase();
  if (normalized.includes('high') || normalized.includes('critical')) return 'bg-error-wash text-error';
  if (normalized.includes('medium') || normalized.includes('moderate')) return 'bg-warning-wash text-warning';
  if (normalized.includes('low')) return 'bg-success-wash text-success';
  return null;
};

function DealCard({ deal, isDragging }: { deal: Deal; isDragging?: boolean }) {
  const assessment = deal.salesAssessments?.[0];
  const risk = riskClass(assessment?.riskProfile);

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-3.5 shadow-sm transition-all',
        isDragging ? 'rotate-2 opacity-90 shadow-md' : 'hover:border-primary/30',
      )}
    >
      <Link
        href={`/deals/${deal.id}`}
        onClick={(e) => isDragging && e.preventDefault()}
        className="block truncate text-sm font-semibold text-foreground hover:text-primary"
      >
        {deal.name}
      </Link>
      <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
        <Target size={12} className="shrink-0" />
        {deal.lead?.company}
        {deal.lead?.name && ` · ${deal.lead.name}`}
      </p>
      {deal.client && (
        <p className="mt-1 truncate text-xs font-medium text-success">Client: {deal.client.name}</p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {typeof assessment?.leadScore === 'number' && (
          <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold', scoreClass(assessment.leadScore))}>
            <GaugeCircle size={11} /> {assessment.leadScore} score
          </span>
        )}
        {risk && assessment?.riskProfile && (
          <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold', risk)}>
            <AlertTriangle size={11} /> {formatEnumLabel(assessment.riskProfile)}
          </span>
        )}
      </div>

      {assessment?.recommendedNextAction && (
        <p className="mt-2.5 line-clamp-2 rounded-lg bg-muted px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
          {assessment.recommendedNextAction}
        </p>
      )}
    </div>
  );
}

function DraggableDealCard({ deal }: { deal: Deal }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: deal.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={isDragging ? 'opacity-30' : 'cursor-grab active:cursor-grabbing'}
    >
      <DealCard deal={deal} />
    </div>
  );
}

function KanbanColumn({ stage, deals }: { stage: DealStage; deals: Deal[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const totalValueLabel = deals.length === 1 ? '1 deal' : `${deals.length} deals`;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl border p-3 transition-colors sm:w-80',
        isOver ? 'border-primary/40 bg-primary/[0.03]' : 'border-border bg-muted/40',
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DEAL_STAGE_COLORS[stage.toLowerCase()] }} />
          <h4 className="text-sm font-semibold text-foreground">{stage}</h4>
        </div>
        <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground shadow-sm">{totalValueLabel}</span>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto pb-2" style={{ maxHeight: '65vh' }}>
        {deals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            Drop deals here
          </div>
        ) : (
          deals.map((deal) => <DraggableDealCard key={deal.id} deal={deal} />)
        )}
      </div>
    </div>
  );
}

interface DealsKanbanBoardProps {
  deals: Deal[];
  onDealsChange: (deals: Deal[]) => void;
  canUpdateStage: boolean;
}

export default function DealsKanbanBoard({ deals, onDealsChange, canUpdateStage }: DealsKanbanBoardProps) {
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const dealsByStage = useMemo(() => {
    const grouped: Record<DealStage, Deal[]> = { New: [], Contacted: [], Proposal: [], Won: [], Lost: [] };
    for (const deal of deals) {
      grouped[normalizeStage(deal.stage)].push(deal);
    }
    return grouped;
  }, [deals]);

  const activeDeal = deals.find((d) => d.id === activeDealId) || null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDealId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDealId(null);
    const { active, over } = event;
    if (!over || !canUpdateStage) return;

    const dealId = String(active.id);
    const nextStage = over.id as DealStage;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || normalizeStage(deal.stage) === nextStage) return;

    const previousDeals = deals;
    onDealsChange(deals.map((d) => (d.id === dealId ? { ...d, stage: nextStage } : d)));

    try {
      await updateDealStage(dealId, nextStage);
      toast.success(`"${deal.name}" moved to ${nextStage}.`);
    } catch (err) {
      onDealsChange(previousDeals);
      toast.error(getApiErrorMessage(err, `Couldn't move "${deal.name}" — please try again.`));
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {DEAL_STAGES.map((stage) => (
          <KanbanColumn key={stage} stage={stage} deals={dealsByStage[stage]} />
        ))}
      </div>
      <DragOverlay>{activeDeal ? <DealCard deal={activeDeal} isDragging /> : null}</DragOverlay>
    </DndContext>
  );
}
