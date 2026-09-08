import type { SignedUploadResponse } from '@gym-buddy/contracts';
import { supabase } from './supabase';
import { api } from './api';

/**
 * Goal-image upload flow (D6): ask the server for a signed upload URL, PUT the
 * file straight to Supabase Storage with the returned token, and return the
 * object path for the caller to submit back to the server. The browser never
 * holds Storage credentials.
 */
export async function uploadGoalImage(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const allowed = ['jpg', 'jpeg', 'png', 'webp'] as const;
  const fileExt = (allowed as readonly string[]).includes(ext) ? ext : 'jpg';

  const signed = await api<SignedUploadResponse>('/api/profile/goal-image/upload-url', {
    method: 'POST',
    body: { file_ext: fileExt },
  });

  const { error } = await supabase.storage
    .from('goal-images')
    .uploadToSignedUrl(signed.object_path, signed.token, file);
  if (error) throw new Error(`Upload failed: ${error.message}`);

  return signed.object_path;
}
