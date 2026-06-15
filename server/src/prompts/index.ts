import { getUser, type DB } from '../db/index.js';
import { getBasePrompt } from './base.js';
import { drillSergeant, type PersonaConfig } from './personas/drill-sergeant.js';

const personas: Record<string, PersonaConfig> = {
  'drill-sergeant': drillSergeant,
};

const defaultPersona = drillSergeant;

interface SystemPromptResult {
  prompt: string;
  ttsVoice: string;
}

export async function buildSystemPrompt(db: DB, userId: string): Promise<SystemPromptResult> {
  const user = await getUser(db, userId);
  const userName = user?.name ?? 'Athlete';
  const persona = (user ? personas[user.persona_id] : null) ?? defaultPersona;

  const base = getBasePrompt({ userName });

  return {
    prompt: `${base}\n\n${persona.prompt}`,
    ttsVoice: persona.ttsVoice,
  };
}
