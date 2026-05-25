import { buildSystemPrompt } from './index.js';
import { getBasePrompt } from './base.js';
import { drillSergeant } from './personas/drill-sergeant.js';
import { createTestDatabase, seedTestUser, seedTestPersona } from '../db/test-helpers.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
  seedTestPersona(db);
});

afterEach(() => {
  db.close();
});

describe('base prompt', () => {
  it('includes voice brevity rules', () => {
    const prompt = getBasePrompt({ userName: 'Morne' });
    expect(prompt).toMatch(/short/i);
    expect(prompt).toMatch(/conversational/i);
  });

  it('includes workout flow instructions', () => {
    const prompt = getBasePrompt({ userName: 'Morne' });
    expect(prompt).toMatch(/getCurrentWorkout/);
    expect(prompt).toMatch(/logExerciseCompleted/);
    expect(prompt).toMatch(/one exercise at a time/i);
  });

  it('includes accountability rules', () => {
    const prompt = getBasePrompt({ userName: 'Morne' });
    expect(prompt).toMatch(/skip/i);
    expect(prompt).toMatch(/getExerciseHistory/);
  });

  it('includes sentiment detection instructions', () => {
    const prompt = getBasePrompt({ userName: 'Morne' });
    expect(prompt).toMatch(/scheduleMotivationalMessage/);
    expect(prompt).toMatch(/sentiment|struggling|frustrated/i);
  });

  it('includes tool usage instructions', () => {
    const prompt = getBasePrompt({ userName: 'Morne' });
    expect(prompt).toMatch(/getExerciseInfo/);
    expect(prompt).toMatch(/sendTelegramMedia/);
  });

  it('personalizes with user name', () => {
    const prompt = getBasePrompt({ userName: 'Morne' });
    expect(prompt).toContain('Morne');
  });
});

describe('drill sergeant persona', () => {
  it('defines tone and personality', () => {
    expect(drillSergeant.prompt).toMatch(/direct/i);
    expect(drillSergeant.prompt).toMatch(/disappointed/i);
  });

  it('includes skip reactions', () => {
    expect(drillSergeant.prompt).toMatch(/skip/i);
  });

  it('includes show-up reactions', () => {
    expect(drillSergeant.prompt).toMatch(/show/i);
  });

  it('includes PR reactions', () => {
    expect(drillSergeant.prompt).toMatch(/PR|record/i);
  });

  it('includes struggle reactions', () => {
    expect(drillSergeant.prompt).toMatch(/off days|struggling/i);
  });

  it('maps to a TTS voice preset', () => {
    expect(drillSergeant.ttsVoice).toBeDefined();
    expect(typeof drillSergeant.ttsVoice).toBe('string');
  });
});

describe('prompt composition', () => {
  it('combines base + persona into final prompt', () => {
    const userId = seedTestUser(db, { name: 'Morne' });
    const result = buildSystemPrompt(db, userId);

    expect(result.prompt).toMatch(/conversational/i);
    expect(result.prompt).toMatch(/direct/i);
    expect(result.prompt).toContain('Morne');
  });

  it('returns the persona TTS voice', () => {
    const userId = seedTestUser(db, { name: 'Morne' });
    const result = buildSystemPrompt(db, userId);

    expect(result.ttsVoice).toBe(drillSergeant.ttsVoice);
  });

  it('falls back gracefully for unknown persona', () => {
    const userId = 'unknown-persona-user';
    db.prepare(
      `INSERT INTO users (id, name, persona_id, training_style) VALUES (?, ?, ?, ?)`,
    ).run(userId, 'Test', 'nonexistent', 'weightlifting');

    const result = buildSystemPrompt(db, userId);
    expect(result.prompt).toMatch(/conversational/i);
    expect(result.ttsVoice).toBeDefined();
  });
});
