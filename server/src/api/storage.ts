import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

/**
 * Goal-image uploads (D6): the browser never gets Storage credentials. The
 * server mints a short-lived signed upload URL with the service-role key; the
 * client PUTs the file straight to the `goal-images` bucket, then hands the
 * object path back so the server can record `users.goal_image_url`.
 */

const BUCKET = 'goal-images';

let client: SupabaseClient | null = null;

/** Lazily builds the service-role Supabase client used only for Storage. */
function getServiceClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Goal-image uploads need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env.',
    );
  }
  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export interface SignedUpload {
  upload_url: string;
  token: string;
  object_path: string;
}

/**
 * Creates a signed upload URL scoped to one object path under `goal-images`,
 * namespaced by the caller's id so users cannot collide or overwrite others'.
 */
export async function createGoalImageUploadUrl(
  userId: string,
  fileExt: string,
): Promise<SignedUpload> {
  const objectPath = `${userId}/${randomUUID()}.${fileExt}`;
  const { data, error } = await getServiceClient()
    .storage.from(BUCKET)
    .createSignedUploadUrl(objectPath);
  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message ?? 'unknown error'}`);
  }
  return { upload_url: data.signedUrl, token: data.token, object_path: data.path };
}

/**
 * Verifies a submitted object path belongs to the caller before it is written
 * to their profile — defence in depth against a client submitting another
 * user's path. Object paths are `${userId}/...`.
 */
export function objectPathBelongsToUser(objectPath: string, userId: string): boolean {
  return objectPath.startsWith(`${userId}/`);
}
