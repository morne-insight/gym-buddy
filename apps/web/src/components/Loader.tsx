import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Loader({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 py-16 text-muted-foreground', className)}>
      <Loader2 className="size-5 animate-spin text-primary" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader label={label} />
    </div>
  );
}
