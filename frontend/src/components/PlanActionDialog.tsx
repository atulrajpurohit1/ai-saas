'use client';

import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
            <Lock className="h-5 w-5" />
          </span>
          <DialogTitle>Choose a plan to use this feature</DialogTitle>
          <DialogDescription>
            {action?.feature ?? 'This feature'} requires an active plan{action?.service ? ` with ${SERVICE_MODULE_LABELS[action.service]}` : ''}.{' '}
            You can explore this page now. Buy a plan to start using its features.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Not Now</Button>
          <Button type="button" onClick={() => {
            onClose();
            router.push('/settings/plan');
          }}>Buy Plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
