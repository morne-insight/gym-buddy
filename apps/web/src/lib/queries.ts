import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  AddExerciseRequest,
  AddWorkoutRequest,
  AdoptTemplateRequest,
  MeResponse,
  PersonaListResponse,
  ProfileResponse,
  ProgramDetail,
  RemoveExerciseRequest,
  RemoveWorkoutRequest,
  RenameWorkoutRequest,
  ReorderExercisesRequest,
  ReorderWorkoutsRequest,
  SetGoalImageRequest,
  SetScheduleRequest,
  SignedUploadRequest,
  SignedUploadResponse,
  SwitchProgramTypeRequest,
  TemplateListResponse,
  UpdateExerciseRequest,
  UpdateProfileRequest,
} from '@gym-buddy/contracts';
import { api } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

export const keys = {
  me: ['me'] as const,
  profile: ['profile'] as const,
  personas: ['personas'] as const,
  templates: ['templates'] as const,
  program: ['program'] as const,
};

// --- Reads -------------------------------------------------------------------

export const useMe = (enabled = true) =>
  useQuery({ queryKey: keys.me, queryFn: () => api<MeResponse>('/api/me'), enabled });

export const useProfile = () =>
  useQuery({ queryKey: keys.profile, queryFn: () => api<ProfileResponse>('/api/profile') });

export const usePersonas = () =>
  useQuery({ queryKey: keys.personas, queryFn: () => api<PersonaListResponse>('/api/personas') });

export const useTemplates = () =>
  useQuery({ queryKey: keys.templates, queryFn: () => api<TemplateListResponse>('/api/templates') });

export const useProgram = () =>
  useQuery({
    queryKey: keys.program,
    queryFn: () => api<ProgramDetail | null>('/api/program'),
  });

// --- Mutations ---------------------------------------------------------------

/** Invalidate the active program so the editor refetches after a mutation. */
function useProgramMutation<TVars>(
  fn: (vars: TVars) => Promise<unknown>,
  alsoInvalidate: readonly (readonly string[])[] = [],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all(
        [keys.program, ...alsoInvalidate].map((key) =>
          qc.invalidateQueries({ queryKey: key }),
        ),
      );
    },
  });
}

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) =>
      api<ProfileResponse>('/api/profile', { method: 'PUT', body }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.profile }),
        qc.invalidateQueries({ queryKey: keys.me }),
      ]);
    },
  });
};

export const useRequestUploadUrl = () =>
  useMutation({
    mutationFn: (body: SignedUploadRequest) =>
      api<SignedUploadResponse>('/api/profile/goal-image/upload-url', { method: 'POST', body }),
  });

export const useSetGoalImage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetGoalImageRequest) =>
      api<ProfileResponse>('/api/profile/goal-image', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.profile }),
  });
};

export const useAdoptTemplate = () =>
  useProgramMutation((body: AdoptTemplateRequest) =>
    api<ProgramDetail>('/api/program/adopt', { method: 'POST', body }),
  );

export const useAddWorkout = () =>
  useProgramMutation((body: AddWorkoutRequest) =>
    api('/api/program/workouts', { method: 'POST', body }),
  );

export const useRenameWorkout = () =>
  useProgramMutation((body: RenameWorkoutRequest) =>
    api('/api/program/workouts/rename', { method: 'POST', body }),
  );

export const useRemoveWorkout = () =>
  useProgramMutation((body: RemoveWorkoutRequest) =>
    api('/api/program/workouts/remove', { method: 'POST', body }),
  );

export const useReorderWorkouts = () =>
  useProgramMutation((body: ReorderWorkoutsRequest) =>
    api('/api/program/workouts/reorder', { method: 'POST', body }),
  );

export const useAddExercise = () =>
  useProgramMutation((body: AddExerciseRequest) =>
    api('/api/program/exercises', { method: 'POST', body }),
  );

export const useUpdateExercise = () =>
  useProgramMutation((body: UpdateExerciseRequest) =>
    api('/api/program/exercises/update', { method: 'POST', body }),
  );

export const useRemoveExercise = () =>
  useProgramMutation((body: RemoveExerciseRequest) =>
    api('/api/program/exercises/remove', { method: 'POST', body }),
  );

export const useReorderExercises = () =>
  useProgramMutation((body: ReorderExercisesRequest) =>
    api('/api/program/exercises/reorder', { method: 'POST', body }),
  );

export const useSetSchedule = () =>
  useProgramMutation((body: SetScheduleRequest) =>
    api('/api/program/schedule', { method: 'POST', body }),
  );

export const useSwitchType = () =>
  useProgramMutation((body: SwitchProgramTypeRequest) =>
    api('/api/program/type', { method: 'POST', body }),
  );
