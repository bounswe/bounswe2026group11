import { useMemo, useState } from 'react';
import type {
  AdminCreateNotificationResponse,
  AdminNotificationDeliveryMode,
} from '@/models/admin';
import { ApiError } from '@/services/api';
import { createAdminNotification } from '@/services/adminService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface NotificationForm {
  targetUserInput: string;
  targetUserIds: string[];
  deliveryMode: AdminNotificationDeliveryMode;
  title: string;
  body: string;
  type: string;
  deepLink: string;
  eventId: string;
  dataText: string;
}

const INITIAL_FORM: NotificationForm = {
  targetUserInput: '',
  targetUserIds: [],
  deliveryMode: 'IN_APP',
  title: '',
  body: '',
  type: '',
  deepLink: '',
  eventId: '',
  dataText: '',
};

type NotificationField = keyof NotificationForm;
type FieldErrors = Partial<Record<NotificationField, string>>;

function parseUserIds(value: string): string[] {
  return Array.from(new Set(value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean)));
}

function parseData(value: string): Record<string, string> | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Data must be a JSON object.');
  }
  const data: Record<string, string> = {};
  Object.entries(parsed).forEach(([key, entry]) => {
    if (typeof entry !== 'string') {
      throw new Error('Data values must be strings.');
    }
    data[key] = entry;
  });
  return data;
}

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const details = err.details ? Object.values(err.details).filter(Boolean).join(' ') : '';
    return details ? `${err.message} ${details}` : err.message;
  }
  return fallback;
}

export function useAdminNotificationViewModel(token: string | null) {
  const [form, setForm] = useState<NotificationForm>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminCreateNotificationResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetUserIds = useMemo(() => form.targetUserIds, [form.targetUserIds]);

  function setField<K extends NotificationField>(field: K, value: NotificationForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  }

  function addTargetUser() {
    const values = parseUserIds(form.targetUserInput);
    if (values.length === 0) {
      setFieldErrors((current) => ({ ...current, targetUserInput: 'Enter a user ID.' }));
      return;
    }
    const invalid = values.find((id) => !UUID_RE.test(id));
    if (invalid) {
      setFieldErrors((current) => ({ ...current, targetUserInput: 'User IDs must be valid UUIDs.' }));
      return;
    }
    setForm((current) => ({
      ...current,
      targetUserInput: '',
      targetUserIds: Array.from(new Set([...current.targetUserIds, ...values])),
    }));
    setFieldErrors((current) => ({ ...current, targetUserInput: undefined }));
    setSubmitError(null);
  }

  function removeTargetUser(userId: string) {
    setForm((current) => ({
      ...current,
      targetUserIds: current.targetUserIds.filter((id) => id !== userId),
    }));
    setFieldErrors((current) => ({ ...current, targetUserInput: undefined }));
  }

  async function submit(): Promise<boolean> {
    const errors: FieldErrors = {};
    if (targetUserIds.length === 0) {
      const pendingTargets = parseUserIds(form.targetUserInput);
      errors.targetUserInput = pendingTargets.some((id) => !UUID_RE.test(id))
        ? 'User IDs must be valid UUIDs.'
        : 'Add at least one user ID.';
    } else if (targetUserIds.some((id) => !UUID_RE.test(id))) {
      errors.targetUserInput = 'User IDs must be valid UUIDs.';
    }
    if (!form.title.trim()) errors.title = 'Title is required.';
    if (!form.body.trim()) errors.body = 'Body is required.';
    if (form.eventId.trim() && !UUID_RE.test(form.eventId.trim())) {
      errors.eventId = 'Event ID must be a valid UUID.';
    }

    let data: Record<string, string> | undefined;
    try {
      data = parseData(form.dataText);
    } catch (err) {
      errors.dataText = err instanceof Error ? err.message : 'Data must be valid JSON.';
    }

    setFieldErrors(errors);
    setResult(null);
    if (Object.keys(errors).length > 0) return false;
    if (!token) {
      setSubmitError('Admin session is not available.');
      return false;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await createAdminNotification(token, {
        user_ids: targetUserIds,
        delivery_mode: form.deliveryMode,
        title: form.title.trim(),
        body: form.body.trim(),
        type: form.type.trim() || null,
        deep_link: form.deepLink.trim() || null,
        event_id: form.eventId.trim() || null,
        data,
      });
      setResult(response);
      return true;
    } catch (err) {
      setSubmitError(apiErrorMessage(err, 'Failed to send notification.'));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    form,
    fieldErrors,
    submitError,
    result,
    isSubmitting,
    targetUserIds,
    setField,
    addTargetUser,
    removeTargetUser,
    submit,
  };
}
