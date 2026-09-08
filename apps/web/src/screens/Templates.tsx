import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CalendarDays, RefreshCw, Dumbbell } from 'lucide-react';
import type { TemplateSummary } from '@gym-buddy/contracts';
import { useTemplates, useAdoptTemplate } from '@/lib/queries';
import { AppShell } from '@/components/AppShell';
import { Loader } from '@/components/Loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Templates() {
  const navigate = useNavigate();
  const templates = useTemplates();
  const adopt = useAdoptTemplate();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleAdopt(t: TemplateSummary) {
    setPendingId(t.id);
    try {
      await adopt.mutateAsync({ template_id: t.id });
      navigate({ to: '/app' });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Step 2 of 2</p>
        <h1 className="mt-2 text-3xl font-extrabold">Choose a starting plan</h1>
        <p className="mt-2 text-muted-foreground">
          Adopt a template to get going — you can rename, reschedule, and rework every part of it
          afterwards.
        </p>
      </div>

      {templates.isLoading ? (
        <Loader label="Loading plans…" />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {templates.data?.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{t.name}</CardTitle>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                      t.type === 'rotation'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-secondary text-secondary-foreground',
                    )}
                  >
                    {t.type === 'rotation' ? (
                      <RefreshCw className="size-3" />
                    ) : (
                      <CalendarDays className="size-3" />
                    )}
                    {t.type === 'rotation' ? 'Rotation' : 'Fixed days'}
                  </span>
                </div>
                {t.description && (
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="space-y-2.5">
                  {t.workouts.map((w) => (
                    <li key={w.id} className="flex items-center gap-3 text-sm">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                        <Dumbbell className="size-3.5" />
                      </span>
                      <span className="font-medium">{w.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {t.type === 'static' && w.day_of_week
                          ? DAYS[w.day_of_week]
                          : `${w.exercises.length} exercises`}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  onClick={() => handleAdopt(t)}
                  disabled={pendingId !== null}
                >
                  {pendingId === t.id ? 'Adopting…' : 'Adopt this plan'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
