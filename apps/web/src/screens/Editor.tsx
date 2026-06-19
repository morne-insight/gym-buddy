import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowUp, ArrowDown, Plus, Trash2, RefreshCw, CalendarDays } from 'lucide-react';
import type { ProgramDetail, ProgramWorkout } from '@gym-buddy/contracts';
import {
  useProgram,
  useAddWorkout,
  useRenameWorkout,
  useRemoveWorkout,
  useReorderWorkouts,
  useAddExercise,
  useUpdateExercise,
  useRemoveExercise,
  useSetSchedule,
  useSwitchType,
} from '@/lib/queries';
import { AppShell } from '@/components/AppShell';
import { Loader } from '@/components/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const DAY_OPTIONS = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '7', label: 'Sunday' },
];

export function Editor() {
  const navigate = useNavigate();
  const program = useProgram();

  if (program.isLoading) {
    return (
      <AppShell>
        <Loader label="Loading your program…" />
      </AppShell>
    );
  }

  if (!program.data) {
    return (
      <AppShell>
        <div className="rounded-xl border border-border bg-card/50 p-10 text-center">
          <h2 className="text-xl font-bold">No active program yet</h2>
          <p className="mt-2 text-muted-foreground">Adopt a plan to start configuring it.</p>
          <Button className="mt-6" onClick={() => navigate({ to: '/templates' })}>
            Choose a plan
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ProgramEditor program={program.data} />
    </AppShell>
  );
}

function ProgramEditor({ program }: { program: ProgramDetail }) {
  const addWorkout = useAddWorkout();
  const switchType = useSwitchType();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{program.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {program.type === 'rotation' ? (
              <RefreshCw className="size-4 text-primary" />
            ) : (
              <CalendarDays className="size-4 text-primary" />
            )}
            {program.type === 'rotation'
              ? 'Rotation — cycles through workouts in order'
              : 'Fixed weekly schedule'}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={switchType.isPending}
          onClick={() => {
            if (program.type === 'static') {
              switchType.mutate({ type: 'rotation' });
            } else {
              // Auto-assign weekdays; the user can refine them in the schedule below.
              switchType.mutate({
                type: 'static',
                days: program.workouts.map((w, i) => ({
                  workout_id: w.id,
                  day_of_week: ((i % 7) + 1) as number,
                })),
              });
            }
          }}
        >
          <RefreshCw className="size-4" />
          Switch to {program.type === 'static' ? 'rotation' : 'fixed days'}
        </Button>
      </div>

      <ScheduleEditor program={program} />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Workouts</h2>
          <Button
            size="sm"
            variant="secondary"
            disabled={addWorkout.isPending}
            onClick={() => addWorkout.mutate({ name: 'New Workout' })}
          >
            <Plus className="size-4" />
            Add workout
          </Button>
        </div>
        <div className="space-y-4">
          {program.workouts.map((w, i) => (
            <WorkoutCard
              key={w.id}
              program={program}
              workout={w}
              index={i}
              total={program.workouts.length}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ScheduleEditor({ program }: { program: ProgramDetail }) {
  const setSchedule = useSetSchedule();
  const [days, setDays] = React.useState<Record<string, string>>({});
  const [times, setTimes] = React.useState<Record<string, string>>({});

  // Sync local form state whenever the server program changes.
  React.useEffect(() => {
    const d: Record<string, string> = {};
    const t: Record<string, string> = {};
    for (const w of program.workouts) {
      d[w.id] = w.day_of_week ? String(w.day_of_week) : '1';
      t[w.id] = w.scheduled_time ?? '';
    }
    setDays(d);
    setTimes(t);
  }, [program]);

  function save() {
    if (program.type === 'static') {
      setSchedule.mutate({
        type: 'static',
        entries: program.workouts.map((w) => ({
          workout_id: w.id,
          day_of_week: Number(days[w.id] ?? '1'),
          scheduled_time: times[w.id] || null,
        })),
      });
    } else {
      setSchedule.mutate({
        type: 'rotation',
        entries: program.workouts.map((w) => ({
          workout_id: w.id,
          scheduled_time: times[w.id] || null,
        })),
      });
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <h2 className="text-lg font-bold">Schedule</h2>
        <Button size="sm" onClick={save} disabled={setSchedule.isPending}>
          {setSchedule.isPending ? 'Saving…' : 'Save schedule'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {program.workouts.map((w) => (
          <div key={w.id} className="flex flex-wrap items-center gap-3">
            <span className="w-40 shrink-0 truncate font-medium">{w.name}</span>
            {program.type === 'static' && (
              <Select value={days[w.id]} onValueChange={(v) => setDays((p) => ({ ...p, [w.id]: v }))}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              type="time"
              value={times[w.id] ?? ''}
              onChange={(e) => setTimes((p) => ({ ...p, [w.id]: e.target.value }))}
              className="w-36"
            />
          </div>
        ))}
        {program.type === 'rotation' && (
          <p className="text-xs text-muted-foreground">
            Rotation order is set by the arrows on each workout below.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function WorkoutCard({
  program,
  workout,
  index,
  total,
}: {
  program: ProgramDetail;
  workout: ProgramWorkout;
  index: number;
  total: number;
}) {
  const rename = useRenameWorkout();
  const remove = useRemoveWorkout();
  const reorder = useReorderWorkouts();
  const addExercise = useAddExercise();

  function move(direction: -1 | 1) {
    const ids = program.workouts.map((w) => w.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate({ workout_ids: ids });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3">
        <div className="flex flex-col">
          <button
            className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
            disabled={index === 0 || reorder.isPending}
            onClick={() => move(-1)}
            aria-label="Move up"
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
            disabled={index === total - 1 || reorder.isPending}
            onClick={() => move(1)}
            aria-label="Move down"
          >
            <ArrowDown className="size-4" />
          </button>
        </div>
        <Input
          defaultValue={workout.name}
          key={workout.name}
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name && name !== workout.name) rename.mutate({ workout_id: workout.id, name });
          }}
          className="h-10 flex-1 border-transparent bg-transparent text-base font-bold focus-visible:border-input focus-visible:bg-background/40"
        />
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          disabled={remove.isPending}
          onClick={() => remove.mutate({ workout_id: workout.id })}
          aria-label="Remove workout"
        >
          <Trash2 className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-[1fr_4rem_5rem_5rem_2.5rem] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Exercise</span>
          <span>Sets</span>
          <span>Reps</span>
          <span>Rest</span>
          <span />
        </div>
        {workout.exercises.map((ex) => (
          <ExerciseRow key={ex.id} exercise={ex} />
        ))}
        <AddExercise
          workoutId={workout.id}
          onAdd={(payload) => addExercise.mutate(payload)}
          pending={addExercise.isPending}
        />
      </CardContent>
    </Card>
  );
}

function ExerciseRow({
  exercise,
}: {
  exercise: ProgramWorkout['exercises'][number];
}) {
  const update = useUpdateExercise();
  const remove = useRemoveExercise();

  return (
    <div className="grid grid-cols-[1fr_4rem_5rem_5rem_2.5rem] items-center gap-2">
      <Input
        defaultValue={exercise.exercise_name}
        key={`name-${exercise.exercise_name}`}
        className="h-9"
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== exercise.exercise_name)
            update.mutate({ exercise_id: exercise.id, exercise_name: v });
        }}
      />
      <Input
        type="number"
        min={1}
        defaultValue={exercise.sets}
        key={`sets-${exercise.sets}`}
        className="h-9"
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (v && v !== exercise.sets) update.mutate({ exercise_id: exercise.id, sets: v });
        }}
      />
      <Input
        defaultValue={exercise.reps}
        key={`reps-${exercise.reps}`}
        className="h-9"
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== exercise.reps) update.mutate({ exercise_id: exercise.id, reps: v });
        }}
      />
      <Input
        type="number"
        min={0}
        step={15}
        defaultValue={exercise.rest_seconds}
        key={`rest-${exercise.rest_seconds}`}
        className="h-9"
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (v !== exercise.rest_seconds)
            update.mutate({ exercise_id: exercise.id, rest_seconds: v });
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-9 text-muted-foreground hover:text-destructive"
        disabled={remove.isPending}
        onClick={() => remove.mutate({ exercise_id: exercise.id })}
        aria-label="Remove exercise"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function AddExercise({
  workoutId,
  onAdd,
  pending,
}: {
  workoutId: string;
  onAdd: (p: { workout_id: string; exercise_name: string; sets: number; reps: string }) => void;
  pending: boolean;
}) {
  const [name, setName] = React.useState('');
  const [sets, setSets] = React.useState('3');
  const [reps, setReps] = React.useState('8-10');

  function submit() {
    if (!name.trim()) return;
    onAdd({ workout_id: workoutId, exercise_name: name.trim(), sets: Number(sets) || 3, reps: reps.trim() || '8-10' });
    setName('');
    setSets('3');
    setReps('8-10');
  }

  return (
    <div className={cn('grid grid-cols-[1fr_4rem_5rem_5rem_2.5rem] items-center gap-2 pt-1')}>
      <Input
        placeholder="Add an exercise…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        className="h-9"
      />
      <Input type="number" min={1} value={sets} onChange={(e) => setSets(e.target.value)} className="h-9" />
      <Input value={reps} onChange={(e) => setReps(e.target.value)} className="h-9" />
      <span />
      <Button
        variant="ghost"
        size="icon"
        className="size-9 text-primary"
        onClick={submit}
        disabled={pending || !name.trim()}
        aria-label="Add exercise"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
