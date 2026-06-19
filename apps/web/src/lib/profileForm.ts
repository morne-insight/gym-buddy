import { z } from 'zod';
import { updateProfileRequest } from '@gym-buddy/contracts';

/**
 * Form-shaped variant of the profile contract. The text area binds to a plain
 * string (empty when blank), whereas the API contract treats an absent goal as
 * `null` — the screens map "" → null at submit time. All other fields reuse the
 * contract's validation verbatim, so client and server stay in lockstep.
 */
export const profileFormSchema = updateProfileRequest.extend({
  goal_description: z.string(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
