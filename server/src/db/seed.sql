-- MVP Seed Data: 3-day Push/Pull/Legs split (Mon/Wed/Fri) as static program
-- Plus a rotation PPL example
--
-- Postgres port of the original SQLite seed. `INSERT OR REPLACE` becomes
-- `INSERT ... ON CONFLICT (id) DO NOTHING` so the seed is safe to re-run.
-- The re-seed workflow truncates first, so content is always fresh.

-- Persona: Drill Sergeant
INSERT INTO personas (id, name, description, system_prompt, tts_voice, example_greeting, example_skip_reaction, example_no_show_reaction)
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

EXAMPLES:
Use the examples below or something very similar.

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
) ON CONFLICT (id) DO NOTHING;

-- User (founder)
INSERT INTO users (id, name, persona_id, goal_description, training_style)
VALUES ('user-founder', 'Morne', 'drill-sergeant', 'Build strength and consistency', 'weightlifting')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- Static PPL Program (Mon/Wed/Fri)
-- =============================================================

INSERT INTO programs (id, user_id, name, type, active)
VALUES ('prog-static-ppl', 'user-founder', 'PPL 3-Day Split', 'static', 1)
ON CONFLICT (id) DO NOTHING;

-- Workouts
INSERT INTO workouts (id, program_id, name) VALUES ('workout-push', 'prog-static-ppl', 'Push Day') ON CONFLICT (id) DO NOTHING;
INSERT INTO workouts (id, program_id, name) VALUES ('workout-pull', 'prog-static-ppl', 'Pull Day') ON CONFLICT (id) DO NOTHING;
INSERT INTO workouts (id, program_id, name) VALUES ('workout-legs', 'prog-static-ppl', 'Legs Day') ON CONFLICT (id) DO NOTHING;

-- Schedule: Mon/Wed/Fri
INSERT INTO schedule (id, user_id, program_id, workout_id, day_of_week, scheduled_time, sort_order)
VALUES ('sched-mon-push', 'user-founder', 'prog-static-ppl', 'workout-push', 1, '06:00', 0) ON CONFLICT (id) DO NOTHING;

INSERT INTO schedule (id, user_id, program_id, workout_id, day_of_week, scheduled_time, sort_order)
VALUES ('sched-wed-pull', 'user-founder', 'prog-static-ppl', 'workout-pull', 3, '06:00', 1) ON CONFLICT (id) DO NOTHING;

INSERT INTO schedule (id, user_id, program_id, workout_id, day_of_week, scheduled_time, sort_order)
VALUES ('sched-fri-legs', 'user-founder', 'prog-static-ppl', 'workout-legs', 5, '06:00', 2) ON CONFLICT (id) DO NOTHING;

-- Push Day exercises
INSERT INTO workout_exercises (id, workout_id, exercise_name, exercise_db_id, sets, reps, rest_seconds, sort_order)
VALUES
  ('ex-bench-press', 'workout-push', 'Barbell Bench Press', 'https://cdn.exercisedb.dev/media/w/images/A8OLBqBa26.jpg', 4, '8-10', 120, 1),
  ('ex-ohp', 'workout-push', 'Overhead Press', 'https://cdn.exercisedb.dev/media/w/images/bQUAOjC7qA.jpg', 3, '8-10', 90, 2),
  ('ex-incline-db', 'workout-push', 'Incline Dumbbell Press', NULL, 3, '10-12', 90, 3),
  ('ex-lateral-raise', 'workout-push', 'Lateral Raises', 'https://cdn.exercisedb.dev/media/w/images/qODXfaAVcz.jpg', 3, '12-15', 60, 4),
  ('ex-tricep-pushdown', 'workout-push', 'Tricep Pushdowns', 'https://cdn.exercisedb.dev/media/w/images/Ocsii6p15A.jpg', 3, '12-15', 60, 5)
ON CONFLICT (id) DO NOTHING;

-- Pull Day exercises
INSERT INTO workout_exercises (id, workout_id, exercise_name, exercise_db_id, sets, reps, rest_seconds, sort_order)
VALUES
  ('ex-deadlift', 'workout-pull', 'Deadlift', NULL, 4, '5-6', 180, 1),
  ('ex-barbell-row', 'workout-pull', 'Barbell Row', NULL, 4, '8-10', 90, 2),
  ('ex-lat-pulldown', 'workout-pull', 'Lat Pulldown', NULL, 3, '10-12', 90, 3),
  ('ex-face-pull', 'workout-pull', 'Face Pulls', NULL, 3, '15-20', 60, 4),
  ('ex-barbell-curl', 'workout-pull', 'Barbell Curls', NULL, 3, '10-12', 60, 5)
ON CONFLICT (id) DO NOTHING;

-- Legs Day exercises
INSERT INTO workout_exercises (id, workout_id, exercise_name, exercise_db_id, sets, reps, rest_seconds, sort_order)
VALUES
  ('ex-squat', 'workout-legs', 'Barbell Squat', 'https://cdn.exercisedb.dev/media/w/images/QBL8IYGdYK.jpg', 4, '6-8', 180, 1),
  ('ex-rdl', 'workout-legs', 'Romanian Deadlift', 'https://cdn.exercisedb.dev/media/w/images/3wgSOkOkH5.jpg', 3, '8-10', 120, 2),
  ('ex-leg-press', 'workout-legs', 'Leg Press', NULL, 3, '10-12', 90, 3),
  ('ex-leg-curl', 'workout-legs', 'Leg Curl', NULL, 3, '10-12', 60, 4),
  ('ex-calf-raise', 'workout-legs', 'Standing Calf Raises', 'https://cdn.exercisedb.dev/media/w/images/RfXMrjCG6o.jpg', 4, '12-15', 60, 5)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- Previous sessions (last week) for exercise history
-- =============================================================

-- Previous Push Day (last Monday, 2026-05-19)
INSERT INTO sessions (id, user_id, schedule_id, started_at, completed_at, status, sentiment)
VALUES ('sess-prev-push', 'user-founder', 'sched-mon-push', '2026-05-19 06:05:00', '2026-05-19 07:10:00', 'completed', 'motivated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO exercise_logs (id, session_id, workout_exercise_id, completed, skipped, actual_sets, actual_reps, actual_weight, completed_at)
VALUES
  ('elog-prev-bench',    'sess-prev-push', 'ex-bench-press',     1, 0, 4, '10,9,8,8',    80,   '2026-05-19 06:25:00'),
  ('elog-prev-ohp',      'sess-prev-push', 'ex-ohp',             1, 0, 3, '10,8,8',      45,   '2026-05-19 06:40:00'),
  ('elog-prev-incline',  'sess-prev-push', 'ex-incline-db',      1, 0, 3, '12,10,10',    28,   '2026-05-19 06:52:00'),
  ('elog-prev-lateral',  'sess-prev-push', 'ex-lateral-raise',   1, 0, 3, '15,12,12',    10,   '2026-05-19 07:00:00'),
  ('elog-prev-tricep',   'sess-prev-push', 'ex-tricep-pushdown', 1, 0, 3, '15,14,12',    25,   '2026-05-19 07:08:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO set_logs (id, exercise_log_id, set_number, reps, weight, completed_at)
VALUES
  ('sl-prev-bench-1', 'elog-prev-bench', 1, 10, 80, '2026-05-19 06:12:00'),
  ('sl-prev-bench-2', 'elog-prev-bench', 2,  9, 80, '2026-05-19 06:16:00'),
  ('sl-prev-bench-3', 'elog-prev-bench', 3,  8, 80, '2026-05-19 06:20:00'),
  ('sl-prev-bench-4', 'elog-prev-bench', 4,  8, 80, '2026-05-19 06:25:00'),
  ('sl-prev-ohp-1',   'elog-prev-ohp',   1, 10, 45, '2026-05-19 06:30:00'),
  ('sl-prev-ohp-2',   'elog-prev-ohp',   2,  8, 45, '2026-05-19 06:34:00'),
  ('sl-prev-ohp-3',   'elog-prev-ohp',   3,  8, 45, '2026-05-19 06:40:00'),
  ('sl-prev-incl-1',  'elog-prev-incline', 1, 12, 28, '2026-05-19 06:44:00'),
  ('sl-prev-incl-2',  'elog-prev-incline', 2, 10, 28, '2026-05-19 06:48:00'),
  ('sl-prev-incl-3',  'elog-prev-incline', 3, 10, 28, '2026-05-19 06:52:00'),
  ('sl-prev-lat-1',   'elog-prev-lateral', 1, 15, 10, '2026-05-19 06:55:00'),
  ('sl-prev-lat-2',   'elog-prev-lateral', 2, 12, 10, '2026-05-19 06:57:00'),
  ('sl-prev-lat-3',   'elog-prev-lateral', 3, 12, 10, '2026-05-19 07:00:00'),
  ('sl-prev-tri-1',   'elog-prev-tricep',  1, 15, 25, '2026-05-19 07:03:00'),
  ('sl-prev-tri-2',   'elog-prev-tricep',  2, 14, 25, '2026-05-19 07:05:00'),
  ('sl-prev-tri-3',   'elog-prev-tricep',  3, 12, 25, '2026-05-19 07:08:00')
ON CONFLICT (id) DO NOTHING;

-- Previous Pull Day (last Wednesday, 2026-05-21)
INSERT INTO sessions (id, user_id, schedule_id, started_at, completed_at, status, sentiment)
VALUES ('sess-prev-pull', 'user-founder', 'sched-wed-pull', '2026-05-21 06:10:00', '2026-05-21 07:20:00', 'completed', 'energized')
ON CONFLICT (id) DO NOTHING;

INSERT INTO exercise_logs (id, session_id, workout_exercise_id, completed, skipped, actual_sets, actual_reps, actual_weight, completed_at)
VALUES
  ('elog-prev-dead',    'sess-prev-pull', 'ex-deadlift',     1, 0, 4, '6,6,5,5',     120,  '2026-05-21 06:35:00'),
  ('elog-prev-row',     'sess-prev-pull', 'ex-barbell-row',  1, 0, 4, '10,9,8,8',    70,   '2026-05-21 06:50:00'),
  ('elog-prev-latpd',   'sess-prev-pull', 'ex-lat-pulldown', 1, 0, 3, '12,10,10',    55,   '2026-05-21 07:02:00'),
  ('elog-prev-face',    'sess-prev-pull', 'ex-face-pull',    1, 0, 3, '18,15,15',    15,   '2026-05-21 07:10:00'),
  ('elog-prev-curl',    'sess-prev-pull', 'ex-barbell-curl', 1, 0, 3, '12,10,10',    30,   '2026-05-21 07:18:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO set_logs (id, exercise_log_id, set_number, reps, weight, completed_at)
VALUES
  ('sl-prev-dead-1',  'elog-prev-dead',  1, 6, 120, '2026-05-21 06:20:00'),
  ('sl-prev-dead-2',  'elog-prev-dead',  2, 6, 120, '2026-05-21 06:25:00'),
  ('sl-prev-dead-3',  'elog-prev-dead',  3, 5, 120, '2026-05-21 06:30:00'),
  ('sl-prev-dead-4',  'elog-prev-dead',  4, 5, 120, '2026-05-21 06:35:00'),
  ('sl-prev-row-1',   'elog-prev-row',   1, 10, 70, '2026-05-21 06:39:00'),
  ('sl-prev-row-2',   'elog-prev-row',   2,  9, 70, '2026-05-21 06:43:00'),
  ('sl-prev-row-3',   'elog-prev-row',   3,  8, 70, '2026-05-21 06:47:00'),
  ('sl-prev-row-4',   'elog-prev-row',   4,  8, 70, '2026-05-21 06:50:00'),
  ('sl-prev-latpd-1', 'elog-prev-latpd', 1, 12, 55, '2026-05-21 06:54:00'),
  ('sl-prev-latpd-2', 'elog-prev-latpd', 2, 10, 55, '2026-05-21 06:58:00'),
  ('sl-prev-latpd-3', 'elog-prev-latpd', 3, 10, 55, '2026-05-21 07:02:00'),
  ('sl-prev-face-1',  'elog-prev-face',  1, 18, 15, '2026-05-21 07:05:00'),
  ('sl-prev-face-2',  'elog-prev-face',  2, 15, 15, '2026-05-21 07:07:00'),
  ('sl-prev-face-3',  'elog-prev-face',  3, 15, 15, '2026-05-21 07:10:00'),
  ('sl-prev-curl-1',  'elog-prev-curl',  1, 12, 30, '2026-05-21 07:13:00'),
  ('sl-prev-curl-2',  'elog-prev-curl',  2, 10, 30, '2026-05-21 07:15:00'),
  ('sl-prev-curl-3',  'elog-prev-curl',  3, 10, 30, '2026-05-21 07:18:00')
ON CONFLICT (id) DO NOTHING;

-- Previous Legs Day (last Friday, 2026-05-23)
INSERT INTO sessions (id, user_id, schedule_id, started_at, completed_at, status, sentiment)
VALUES ('sess-prev-legs', 'user-founder', 'sched-fri-legs', '2026-05-23 06:08:00', '2026-05-23 07:25:00', 'completed', 'tired')
ON CONFLICT (id) DO NOTHING;

INSERT INTO exercise_logs (id, session_id, workout_exercise_id, completed, skipped, actual_sets, actual_reps, actual_weight, completed_at)
VALUES
  ('elog-prev-squat',  'sess-prev-legs', 'ex-squat',     1, 0, 4, '8,7,6,6',     100,  '2026-05-23 06:30:00'),
  ('elog-prev-rdl',    'sess-prev-legs', 'ex-rdl',       1, 0, 3, '10,9,8',      80,   '2026-05-23 06:48:00'),
  ('elog-prev-lpress', 'sess-prev-legs', 'ex-leg-press', 1, 0, 3, '12,12,10',    140,  '2026-05-23 07:02:00'),
  ('elog-prev-lcurl',  'sess-prev-legs', 'ex-leg-curl',  1, 0, 3, '12,10,10',    40,   '2026-05-23 07:12:00'),
  ('elog-prev-calf',   'sess-prev-legs', 'ex-calf-raise',1, 0, 4, '15,15,12,12', 60,   '2026-05-23 07:23:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO set_logs (id, exercise_log_id, set_number, reps, weight, completed_at)
VALUES
  ('sl-prev-squat-1',  'elog-prev-squat',  1, 8, 100, '2026-05-23 06:17:00'),
  ('sl-prev-squat-2',  'elog-prev-squat',  2, 7, 100, '2026-05-23 06:22:00'),
  ('sl-prev-squat-3',  'elog-prev-squat',  3, 6, 100, '2026-05-23 06:26:00'),
  ('sl-prev-squat-4',  'elog-prev-squat',  4, 6, 100, '2026-05-23 06:30:00'),
  ('sl-prev-rdl-1',    'elog-prev-rdl',    1, 10, 80, '2026-05-23 06:36:00'),
  ('sl-prev-rdl-2',    'elog-prev-rdl',    2,  9, 80, '2026-05-23 06:42:00'),
  ('sl-prev-rdl-3',    'elog-prev-rdl',    3,  8, 80, '2026-05-23 06:48:00'),
  ('sl-prev-lpress-1', 'elog-prev-lpress', 1, 12, 140, '2026-05-23 06:53:00'),
  ('sl-prev-lpress-2', 'elog-prev-lpress', 2, 12, 140, '2026-05-23 06:57:00'),
  ('sl-prev-lpress-3', 'elog-prev-lpress', 3, 10, 140, '2026-05-23 07:02:00'),
  ('sl-prev-lcurl-1',  'elog-prev-lcurl',  1, 12, 40, '2026-05-23 07:05:00'),
  ('sl-prev-lcurl-2',  'elog-prev-lcurl',  2, 10, 40, '2026-05-23 07:08:00'),
  ('sl-prev-lcurl-3',  'elog-prev-lcurl',  3, 10, 40, '2026-05-23 07:12:00'),
  ('sl-prev-calf-1',   'elog-prev-calf',   1, 15, 60, '2026-05-23 07:15:00'),
  ('sl-prev-calf-2',   'elog-prev-calf',   2, 15, 60, '2026-05-23 07:18:00'),
  ('sl-prev-calf-3',   'elog-prev-calf',   3, 12, 60, '2026-05-23 07:20:00'),
  ('sl-prev-calf-4',   'elog-prev-calf',   4, 12, 60, '2026-05-23 07:23:00')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- Rotation PPL example (inactive — for demo/testing)
-- =============================================================

INSERT INTO programs (id, user_id, name, type, active)
VALUES ('prog-rotation-ppl', 'user-founder', 'PPL Rotation', 'rotation', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workouts (id, program_id, name) VALUES ('rworkout-push', 'prog-rotation-ppl', 'Push Day') ON CONFLICT (id) DO NOTHING;
INSERT INTO workouts (id, program_id, name) VALUES ('rworkout-pull', 'prog-rotation-ppl', 'Pull Day') ON CONFLICT (id) DO NOTHING;
INSERT INTO workouts (id, program_id, name) VALUES ('rworkout-legs', 'prog-rotation-ppl', 'Legs Day') ON CONFLICT (id) DO NOTHING;

INSERT INTO schedule (id, user_id, program_id, workout_id, day_of_week, scheduled_time, sort_order)
VALUES ('rsched-push', 'user-founder', 'prog-rotation-ppl', 'rworkout-push', NULL, NULL, 0) ON CONFLICT (id) DO NOTHING;

INSERT INTO schedule (id, user_id, program_id, workout_id, day_of_week, scheduled_time, sort_order)
VALUES ('rsched-pull', 'user-founder', 'prog-rotation-ppl', 'rworkout-pull', NULL, NULL, 1) ON CONFLICT (id) DO NOTHING;

INSERT INTO schedule (id, user_id, program_id, workout_id, day_of_week, scheduled_time, sort_order)
VALUES ('rsched-legs', 'user-founder', 'prog-rotation-ppl', 'rworkout-legs', NULL, NULL, 2) ON CONFLICT (id) DO NOTHING;

INSERT INTO workout_exercises (id, workout_id, exercise_name, exercise_db_id, sets, reps, rest_seconds, sort_order)
VALUES
  ('rex-bench-press', 'rworkout-push', 'Barbell Bench Press', 'https://cdn.exercisedb.dev/media/w/images/A8OLBqBa26.jpg', 4, '8-10', 120, 1),
  ('rex-ohp', 'rworkout-push', 'Overhead Press', 'https://cdn.exercisedb.dev/media/w/images/bQUAOjC7qA.jpg', 3, '8-10', 90, 2),
  ('rex-incline-db', 'rworkout-push', 'Incline Dumbbell Press', NULL, 3, '10-12', 90, 3),
  ('rex-lateral-raise', 'rworkout-push', 'Lateral Raises', NULL, 3, '12-15', 60, 4),
  ('rex-tricep-pushdown', 'rworkout-push', 'Tricep Pushdowns', NULL, 3, '12-15', 60, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workout_exercises (id, workout_id, exercise_name, exercise_db_id, sets, reps, rest_seconds, sort_order)
VALUES
  ('rex-deadlift', 'rworkout-pull', 'Deadlift', NULL, 4, '5-6', 180, 1),
  ('rex-barbell-row', 'rworkout-pull', 'Barbell Row', NULL, 4, '8-10', 90, 2),
  ('rex-lat-pulldown', 'rworkout-pull', 'Lat Pulldown', NULL, 3, '10-12', 90, 3),
  ('rex-face-pull', 'rworkout-pull', 'Face Pulls', NULL, 3, '15-20', 60, 4),
  ('rex-barbell-curl', 'rworkout-pull', 'Barbell Curls', NULL, 3, '10-12', 60, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workout_exercises (id, workout_id, exercise_name, exercise_db_id, sets, reps, rest_seconds, sort_order)
VALUES
  ('rex-squat', 'rworkout-legs', 'Barbell Squat', 'https://cdn.exercisedb.dev/media/w/images/QBL8IYGdYK.jpg', 4, '6-8', 180, 1),
  ('rex-rdl', 'rworkout-legs', 'Romanian Deadlift', 'https://cdn.exercisedb.dev/media/w/images/3wgSOkOkH5.jpg', 3, '8-10', 120, 2),
  ('rex-leg-press', 'rworkout-legs', 'Leg Press', NULL, 3, '10-12', 90, 3),
  ('rex-leg-curl', 'rworkout-legs', 'Leg Curl', NULL, 3, '10-12', 60, 4),
  ('rex-calf-raise', 'rworkout-legs', 'Standing Calf Raises', NULL, 4, '12-15', 60, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rotation_state (id, user_id, program_id, current_index, last_completed_at)
VALUES ('rstate-founder', 'user-founder', 'prog-rotation-ppl', 0, NULL)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- Workout Template catalog (team-curated; adopted via the web flow)
-- =============================================================
-- These rows have NO user_id. Adopting a Template clones it into user-owned
-- rows; the catalog itself is never edited by users.

-- Template 1: Static PPL (Mon/Wed/Fri) — mirrors the founder's static program.
INSERT INTO program_templates (id, name, description, type, sort_order)
VALUES ('tmpl-ppl-static', 'Push / Pull / Legs (3-Day Split)', 'A classic 3-day push/pull/legs split on fixed days — great for a steady weekly routine.', 'static', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO template_workouts (id, program_template_id, name, sort_order) VALUES
  ('twk-static-push', 'tmpl-ppl-static', 'Push Day', 0),
  ('twk-static-pull', 'tmpl-ppl-static', 'Pull Day', 1),
  ('twk-static-legs', 'tmpl-ppl-static', 'Legs Day', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO template_schedule (id, program_template_id, template_workout_id, day_of_week, scheduled_time, sort_order) VALUES
  ('tsch-static-push', 'tmpl-ppl-static', 'twk-static-push', 1, '06:00', 0),
  ('tsch-static-pull', 'tmpl-ppl-static', 'twk-static-pull', 3, '06:00', 1),
  ('tsch-static-legs', 'tmpl-ppl-static', 'twk-static-legs', 5, '06:00', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO template_exercises (id, template_workout_id, exercise_name, exercise_db_id, sets, reps, rest_seconds, sort_order) VALUES
  ('tex-s-bench',   'twk-static-push', 'Barbell Bench Press', 'https://cdn.exercisedb.dev/media/w/images/A8OLBqBa26.jpg', 4, '8-10', 120, 1),
  ('tex-s-ohp',     'twk-static-push', 'Overhead Press', 'https://cdn.exercisedb.dev/media/w/images/bQUAOjC7qA.jpg', 3, '8-10', 90, 2),
  ('tex-s-incline', 'twk-static-push', 'Incline Dumbbell Press', NULL, 3, '10-12', 90, 3),
  ('tex-s-lateral', 'twk-static-push', 'Lateral Raises', 'https://cdn.exercisedb.dev/media/w/images/qODXfaAVcz.jpg', 3, '12-15', 60, 4),
  ('tex-s-tricep',  'twk-static-push', 'Tricep Pushdowns', 'https://cdn.exercisedb.dev/media/w/images/Ocsii6p15A.jpg', 3, '12-15', 60, 5),
  ('tex-s-dead',    'twk-static-pull', 'Deadlift', NULL, 4, '5-6', 180, 1),
  ('tex-s-row',     'twk-static-pull', 'Barbell Row', NULL, 4, '8-10', 90, 2),
  ('tex-s-latpd',   'twk-static-pull', 'Lat Pulldown', NULL, 3, '10-12', 90, 3),
  ('tex-s-face',    'twk-static-pull', 'Face Pulls', NULL, 3, '15-20', 60, 4),
  ('tex-s-curl',    'twk-static-pull', 'Barbell Curls', NULL, 3, '10-12', 60, 5),
  ('tex-s-squat',   'twk-static-legs', 'Barbell Squat', 'https://cdn.exercisedb.dev/media/w/images/QBL8IYGdYK.jpg', 4, '6-8', 180, 1),
  ('tex-s-rdl',     'twk-static-legs', 'Romanian Deadlift', 'https://cdn.exercisedb.dev/media/w/images/3wgSOkOkH5.jpg', 3, '8-10', 120, 2),
  ('tex-s-lpress',  'twk-static-legs', 'Leg Press', NULL, 3, '10-12', 90, 3),
  ('tex-s-lcurl',   'twk-static-legs', 'Leg Curl', NULL, 3, '10-12', 60, 4),
  ('tex-s-calf',    'twk-static-legs', 'Standing Calf Raises', 'https://cdn.exercisedb.dev/media/w/images/RfXMrjCG6o.jpg', 4, '12-15', 60, 5)
ON CONFLICT (id) DO NOTHING;

-- Template 2: Rotation PPL (cycles Push → Pull → Legs regardless of weekday).
INSERT INTO program_templates (id, name, description, type, sort_order)
VALUES ('tmpl-ppl-rotation', 'Push / Pull / Legs (Rotation)', 'The same push/pull/legs split as a rolling rotation — train when you can; the next day advances on completion.', 'rotation', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO template_workouts (id, program_template_id, name, sort_order) VALUES
  ('twk-rot-push', 'tmpl-ppl-rotation', 'Push Day', 0),
  ('twk-rot-pull', 'tmpl-ppl-rotation', 'Pull Day', 1),
  ('twk-rot-legs', 'tmpl-ppl-rotation', 'Legs Day', 2)
ON CONFLICT (id) DO NOTHING;

-- Rotation schedule: day_of_week NULL, ordered by sort_order.
INSERT INTO template_schedule (id, program_template_id, template_workout_id, day_of_week, scheduled_time, sort_order) VALUES
  ('tsch-rot-push', 'tmpl-ppl-rotation', 'twk-rot-push', NULL, NULL, 0),
  ('tsch-rot-pull', 'tmpl-ppl-rotation', 'twk-rot-pull', NULL, NULL, 1),
  ('tsch-rot-legs', 'tmpl-ppl-rotation', 'twk-rot-legs', NULL, NULL, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO template_exercises (id, template_workout_id, exercise_name, exercise_db_id, sets, reps, rest_seconds, sort_order) VALUES
  ('tex-r-bench',  'twk-rot-push', 'Barbell Bench Press', 'https://cdn.exercisedb.dev/media/w/images/A8OLBqBa26.jpg', 4, '8-10', 120, 1),
  ('tex-r-ohp',    'twk-rot-push', 'Overhead Press', 'https://cdn.exercisedb.dev/media/w/images/bQUAOjC7qA.jpg', 3, '8-10', 90, 2),
  ('tex-r-incline','twk-rot-push', 'Incline Dumbbell Press', NULL, 3, '10-12', 90, 3),
  ('tex-r-dead',   'twk-rot-pull', 'Deadlift', NULL, 4, '5-6', 180, 1),
  ('tex-r-row',    'twk-rot-pull', 'Barbell Row', NULL, 4, '8-10', 90, 2),
  ('tex-r-latpd',  'twk-rot-pull', 'Lat Pulldown', NULL, 3, '10-12', 90, 3),
  ('tex-r-squat',  'twk-rot-legs', 'Barbell Squat', 'https://cdn.exercisedb.dev/media/w/images/QBL8IYGdYK.jpg', 4, '6-8', 180, 1),
  ('tex-r-rdl',    'twk-rot-legs', 'Romanian Deadlift', NULL, 3, '8-10', 120, 2),
  ('tex-r-lpress', 'twk-rot-legs', 'Leg Press', NULL, 3, '10-12', 90, 3)
ON CONFLICT (id) DO NOTHING;
