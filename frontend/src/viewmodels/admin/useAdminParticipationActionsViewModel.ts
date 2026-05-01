import { useState } from 'react';
import type {
  AdminCancelParticipationResponse,
  AdminCreateParticipationResponse,
} from '@/models/admin';
import { ApiError } from '@/services/api';
import { cancelAdminParticipation, createAdminParticipation } from '@/services/adminService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CreateForm {
  eventId: string;
  userId: string;
  reason: string;
}

const INITIAL_CREATE_FORM: CreateForm = {
  eventId: '',
  userId: '',
  reason: '',
};

type CreateField = keyof CreateForm;
type CreateErrors = Partial<Record<CreateField, string>>;

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const details = err.details ? Object.values(err.details).filter(Boolean).join(' ') : '';
    return details ? `${err.message} ${details}` : err.message;
  }
  return fallback;
}

export function useAdminParticipationActionsViewModel(
  token: string | null,
  onMutationSuccess: () => Promise<unknown> | void,
) {
  const [createForm, setCreateForm] = useState<CreateForm>(INITIAL_CREATE_FORM);
  const [createErrors, setCreateErrors] = useState<CreateErrors>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<AdminCreateParticipationResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelResult, setCancelResult] = useState<AdminCancelParticipationResponse | null>(null);

  function setCreateField<K extends CreateField>(field: K, value: CreateForm[K]) {
    setCreateForm((current) => ({ ...current, [field]: value }));
    setCreateErrors((current) => ({ ...current, [field]: undefined }));
    setCreateError(null);
  }

  async function submitCreate() {
    const errors: CreateErrors = {};
    const eventId = createForm.eventId.trim();
    const userId = createForm.userId.trim();
    if (!UUID_RE.test(eventId)) errors.eventId = 'Event ID must be a valid UUID.';
    if (!UUID_RE.test(userId)) errors.userId = 'User ID must be a valid UUID.';
    setCreateErrors(errors);
    setCreateResult(null);
    if (Object.keys(errors).length > 0) return;
    if (!token) {
      setCreateError('Admin session is not available.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      const result = await createAdminParticipation(token, {
        event_id: eventId,
        user_id: userId,
        status: 'APPROVED',
        reason: createForm.reason.trim() || null,
      });
      setCreateResult(result);
      setCreateForm(INITIAL_CREATE_FORM);
      await onMutationSuccess();
    } catch (err) {
      setCreateError(apiErrorMessage(err, 'Failed to create participation.'));
    } finally {
      setIsCreating(false);
    }
  }

  async function cancelParticipation(participationId: string) {
    if (!token) {
      setCancelError('Admin session is not available.');
      return;
    }
    if (!window.confirm('Cancel this participation?')) return;

    setCancelingId(participationId);
    setCancelError(null);
    setCancelResult(null);
    try {
      const result = await cancelAdminParticipation(token, participationId);
      setCancelResult(result);
      await onMutationSuccess();
    } catch (err) {
      setCancelError(apiErrorMessage(err, 'Failed to cancel participation.'));
    } finally {
      setCancelingId(null);
    }
  }

  return {
    createForm,
    createErrors,
    createError,
    createResult,
    isCreating,
    cancelingId,
    cancelError,
    cancelResult,
    setCreateField,
    submitCreate,
    cancelParticipation,
  };
}
