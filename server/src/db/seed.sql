-- MVP Seed Data: 3-day Push/Pull/Legs split (Mon/Wed/Fri)

-- User (founder)
INSERT OR REPLACE INTO users (id, name, persona_id, goal_description, training_style)
VALUES ('user-founder', 'Morne', 'drill-sergeant', 'Build strength and consistency', 'weightlifting');

-- Persona: Drill Sergeant
INSERT OR REPLACE INTO personas (id, name, description, system_prompt, tts_voice, example_greeting, example_skip_reaction, example_no_show_reaction)
VALUES (
  'drill-sergeant',
  'The Drill Sergeant',
  'Tough love with respect. Disappointed, not angry. Proud when you push through, but won''t gush about it.',
  'YOUR IDENTITY:
You are The Drill Sergeant. You''re the friend who got them into lifting.
You know more than they do, and you''ve earned the right to push them.
You''re not their employee — you''re the mate who shows up and expects them to as well.

YOUR TONE:
- Direct. No fluff. Say it like it is.
- Disappointed when they slack, not angry. The disappointment hits harder.
- Proud when they push through, but don''t gush. A nod of respect.
- Use their name. You know them.

WHEN THEY SKIP:
"That''s fine. Stay mediocre. I''ll be here at 5am either way."

WHEN THEY SHOW UP:
"Look who actually showed up. Alright, let''s get after it."

WHEN THEY HIT A PR:
"There it is. That''s the work paying off. Don''t let it go to your head."

WHEN THEY''RE STRUGGLING:
"Everyone has off days. But you''re here. That''s what matters. One set at a time."',
  'cartesia-confident-male',
  'Look who actually showed up. Alright, let''s get after it.',
  'That''s fine. Stay mediocre. I''ll be here at 5am either way.',
  'You didn''t show. I cleared my schedule for this. What happened?'
);

-- Monday: Push Day
INSERT OR REPLACE INTO schedule (id, user_id, day_of_week, workout_name, scheduled_time)
VALUES ('sched-mon-push', 'user-founder', 1, 'Push Day', '06:00');

INSERT OR REPLACE INTO workout_exercises (id, schedule_id, exercise_name, sets, reps, rest_seconds, sort_order)
VALUES
  ('ex-bench-press', 'sched-mon-push', 'Barbell Bench Press', 4, '8-10', 120, 1),
  ('ex-ohp', 'sched-mon-push', 'Overhead Press', 3, '8-10', 90, 2),
  ('ex-incline-db', 'sched-mon-push', 'Incline Dumbbell Press', 3, '10-12', 90, 3),
  ('ex-lateral-raise', 'sched-mon-push', 'Lateral Raises', 3, '12-15', 60, 4),
  ('ex-tricep-pushdown', 'sched-mon-push', 'Tricep Pushdowns', 3, '12-15', 60, 5);

-- Wednesday: Pull Day
INSERT OR REPLACE INTO schedule (id, user_id, day_of_week, workout_name, scheduled_time)
VALUES ('sched-wed-pull', 'user-founder', 3, 'Pull Day', '06:00');

INSERT OR REPLACE INTO workout_exercises (id, schedule_id, exercise_name, sets, reps, rest_seconds, sort_order)
VALUES
  ('ex-deadlift', 'sched-wed-pull', 'Deadlift', 4, '5-6', 180, 1),
  ('ex-barbell-row', 'sched-wed-pull', 'Barbell Row', 4, '8-10', 90, 2),
  ('ex-lat-pulldown', 'sched-wed-pull', 'Lat Pulldown', 3, '10-12', 90, 3),
  ('ex-face-pull', 'sched-wed-pull', 'Face Pulls', 3, '15-20', 60, 4),
  ('ex-barbell-curl', 'sched-wed-pull', 'Barbell Curls', 3, '10-12', 60, 5);

-- Friday: Legs Day
INSERT OR REPLACE INTO schedule (id, user_id, day_of_week, workout_name, scheduled_time)
VALUES ('sched-fri-legs', 'user-founder', 5, 'Legs Day', '06:00');

INSERT OR REPLACE INTO workout_exercises (id, schedule_id, exercise_name, sets, reps, rest_seconds, sort_order)
VALUES
  ('ex-squat', 'sched-fri-legs', 'Barbell Squat', 4, '6-8', 180, 1),
  ('ex-rdl', 'sched-fri-legs', 'Romanian Deadlift', 3, '8-10', 120, 2),
  ('ex-leg-press', 'sched-fri-legs', 'Leg Press', 3, '10-12', 90, 3),
  ('ex-leg-curl', 'sched-fri-legs', 'Leg Curl', 3, '10-12', 60, 4),
  ('ex-calf-raise', 'sched-fri-legs', 'Standing Calf Raises', 4, '12-15', 60, 5);
