import * as React from 'react';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { TRAINING_STYLES } from '@gym-buddy/contracts';
import { ImagePlus, Check } from 'lucide-react';
import { profileFormSchema } from '@/lib/profileForm';
import { usePersonas, useUpdateProfile, useSetGoalImage } from '@/lib/queries';
import { uploadGoalImage } from '@/lib/uploadGoalImage';
import { Logo } from '@/components/Logo';
import { Loader } from '@/components/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const TRAINING_STYLE_LABELS: Record<string, string> = {
  weightlifting: 'Weightlifting',
};

export function Onboarding() {
  const navigate = useNavigate();
  const personas = usePersonas();
  const updateProfile = useUpdateProfile();
  const setGoalImage = useSetGoalImage();

  const [goalFile, setGoalFile] = React.useState<File | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: '',
      persona_id: '',
      goal_description: '',
      training_style: TRAINING_STYLES[0],
    },
    validators: { onSubmit: profileFormSchema },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      try {
        await updateProfile.mutateAsync({
          name: value.name,
          persona_id: value.persona_id,
          goal_description: value.goal_description?.trim() ? value.goal_description : null,
          training_style: value.training_style,
        });
        if (goalFile) {
          const objectPath = await uploadGoalImage(goalFile);
          await setGoalImage.mutateAsync({ object_path: objectPath });
        }
        navigate({ to: '/templates' });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Could not save your profile');
      }
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <Logo className="mb-10" />
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Step 1 of 2</p>
        <h1 className="mt-2 text-3xl font-extrabold">Tell your Buddy about you</h1>
        <p className="mt-2 text-muted-foreground">
          This shapes who shows up to your sessions and what they push you toward.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-8"
      >
        {/* Name */}
        <form.Field name="name">
          {(field) => (
            <div>
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="mt-1.5"
                placeholder="What should we call you?"
              />
              {field.state.meta.errors[0] && (
                <p className="mt-1.5 text-xs font-medium text-destructive">
                  {String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}
                </p>
              )}
            </div>
          )}
        </form.Field>

        {/* Buddy picker */}
        <form.Field name="persona_id">
          {(field) => (
            <div>
              <Label>Pick your Buddy</Label>
              {personas.isLoading ? (
                <Loader label="Loading Buddies…" />
              ) : (
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {personas.data?.map((p) => {
                    const selected = field.state.value === p.id;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => field.handleChange(p.id)}
                        className={cn(
                          'group relative rounded-xl border p-4 text-left transition-all',
                          selected
                            ? 'border-primary bg-primary/10 shadow-[0_0_24px_-8px_var(--color-primary)]'
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
                        {p.example_greeting && (
                          <p className="mt-2 text-xs italic text-foreground/70">
                            “{p.example_greeting}”
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {field.state.meta.errors[0] && (
                <p className="mt-1.5 text-xs font-medium text-destructive">
                  {String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}
                </p>
              )}
            </div>
          )}
        </form.Field>

        {/* Goal description */}
        <form.Field name="goal_description">
          {(field) => (
            <div>
              <Label htmlFor="goal">
                Your goal <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="goal"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="mt-1.5"
                placeholder="e.g. Get my first pull-up, build consistency, drop 5kg…"
              />
            </div>
          )}
        </form.Field>

        {/* Goal image */}
        <div>
          <Label>
            Goal image <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <label
            className={cn(
              'mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-4 py-4 transition-colors hover:border-primary/50',
            )}
          >
            <span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary">
              <ImagePlus className="size-5" />
            </span>
            <span className="text-sm text-muted-foreground">
              {goalFile ? goalFile.name : 'Add a photo that reminds you why you started'}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => setGoalFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {/* Training style */}
        <form.Field name="training_style">
          {(field) => (
            <div>
              <Label htmlFor="training_style">Training style</Label>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as (typeof TRAINING_STYLES)[number])}
              >
                <SelectTrigger id="training_style" className="mt-1.5">
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

        {submitError && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {submitError}
          </p>
        )}

        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Continue to choose a plan'}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
