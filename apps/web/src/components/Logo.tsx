import { Dumbbell } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Wordmark + glyph. The volt square reads as a "rep counter" tick. */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5 font-extrabold tracking-tight', className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_20px_-4px_var(--color-primary)]">
        <Dumbbell className="size-4.5" strokeWidth={2.75} />
      </span>
      <span className="text-lg">
        Gym<span className="text-primary">Buddy</span>
      </span>
    </div>
  );
}
