import * as React from 'react';
import { useForm } from '@tanstack/react-form';
import { TRAINING_STYLES } from '@gym-buddy/contracts';
import { Check } from 'lucide-react';
import { profileFormSchema } from '@/lib/profileForm';
import { useProfile, usePersonas, useUpdateProfile } from '@/lib/queries';
import { AppShell } from '@/components/AppShell';
import { Loader } from '@/components/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const TRAINING_STYLE_LABELS: Record<string, string> = { weightlifting: 'Weightlifting' };

export function Profile() {
  const profile = useProfile();
  const personas = usePersonas();

  if (profile.isLoading || personas.isLoading) {
    return (
      <AppShell>
        <Loader label="Loading your profile…" />
      </AppShell>
    );
  }

  if (!profile.data) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Could not load your profile.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ProfileForm initial={profile.data} />
    </AppShell>
  );
}

function ProfileForm({ initial }: { initial: NonNullable<ReturnType<typeof useProfile>['data']> }) {
  const personas = usePersonas();
  const updateProfile = useUpdateProfile();
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: initial.name,
      persona_id: initial.persona_id,
      goal_description: initial.goal_description ?? '',
      training_style: (TRAINING_STYLES as readonly string[]).includes(initial.training_style)
        ? (initial.training_style as (typeof TRAINING_STYLES)[number])
        : TRAINING_STYLES[0],
    },
    validators: { onSubmit: profileFormSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      setSaved(false);
      try {
        await updateProfile.mutateAsync({
          name: value.name,
          persona_id: value.persona_id,
          goal_description: value.goal_description?.trim() ? value.goal_description : null,
          training_style: value.training_style,
        });
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save');
      }
    },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-3xl font-extrabold">Profile</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form.Field name="name">
              {(field) => (
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="persona_id">
              {(field) => (
                <div>
                  <Label>Buddy</Label>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {personas.data?.map((p) => {
                      const selected = field.state.value === p.id;
                      return (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => field.handleChange(p.id)}
                          className={cn(
                            'relative rounded-xl border p-4 text-left transition-all',
                            selected
                              ? 'border-primary bg-primary/10'
                              : 'border-border bg-card/50 hover:border-primary/50',
                          )}
                        >
                          {selected && (
                            <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-3" strokeWidth={3} />
                            </span>
                          )}
                          <p className="font-bold">{p.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </form.Field>

            <form.Field name="goal_description">
              {(field) => (
                <div>
                  <Label htmlFor="goal">Goal</Label>
                  <Textarea
                    id="goal"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="training_style">
              {(field) => (
                <div>
                  <Label htmlFor="ts">Training style</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as (typeof TRAINING_STYLES)[number])}
                  >
                    <SelectTrigger id="ts" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRAINING_STYLES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {TRAINING_STYLE_LABELS[s] ?? s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center gap-3">
              <form.Subscribe selector={(s) => s.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving…' : 'Save changes'}
                  </Button>
                )}
              </form.Subscribe>
              {saved && <span className="text-sm font-medium text-primary">Saved ✓</span>}
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
