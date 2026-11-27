'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SERVICE_MODULE_LABELS, type ServiceModuleKey } from '@/lib/entitlements';

export default function PlanActionDialog({
  action,
  onClose,
}: {
  action: { feature: string; service: ServiceModuleKey | null } | null;
  onClose: () => void;
}) {
  const router = useRouter();

  return (
    <Dialog open={action !== null} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 shadow-2xl sm:max-w-[29rem]">
        <div className="h-1.5 bg-gradient-to-r from-primary via-red-400 to-orange-300" aria-hidden="true" />
        <div className="px-6 pb-7 pt-8 sm:px-8">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-error-wash text-primary ring-1 ring-inset ring-primary/15">
            <LockKeyhole className="h-6 w-6" aria-hidden="true" />
          </div>
          <DialogHeader className="gap-2 text-left">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Plan required</p>
            <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
              Unlock this feature
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              {action?.feature ?? 'This feature'} is available with an active plan.{' '}
              Choose a plan when you&apos;re ready to use it.
            </DialogDescription>
          </DialogHeader>
          {action?.service && (
            <div className="mt-5 rounded-xl border border-border bg-muted/60 px-4 py-3 text-sm text-foreground">
              Included with <span className="font-semibold">{SERVICE_MODULE_LABELS[action.service]}</span>
            </div>
          )}
        </div>
        <DialogFooter className="items-center gap-3 border-t border-border bg-muted/40 px-6 py-4 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 cursor-pointer px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Not Now
          </button>
          <Button
            type="button"
            size="lg"
            className="h-11 rounded-xl px-5 font-semibold shadow-sm"
            onClick={() => {
              onClose();
              router.push('/settings/plan');
            }}
          >
            Buy Plan <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
