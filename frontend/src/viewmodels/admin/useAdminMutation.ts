import { useState } from 'react';
import { ApiError } from '@/services/api';

export function useAdminMutation(onSuccess?: () => void) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<unknown>, successMessage: string) {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(successMessage);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Admin action failed.');
    } finally {
      setBusyId(null);
    }
  }

  return { busyId, error, message, run, clearMessage: () => setMessage(null) };
}
