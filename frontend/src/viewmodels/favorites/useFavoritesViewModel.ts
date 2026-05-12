import { useState, useEffect, useCallback } from 'react';
import { getFavoriteEvents } from '@/services/eventService';
import type { FavoriteEventItem } from '@/models/event';
import { ApiError } from '@/services/api';
import i18n from '@/i18n';

export function useFavoritesViewModel(token: string | null) {
  const [items, setItems] = useState<FavoriteEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await getFavoriteEvents(token);
      setItems(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(i18n.t('errors.unexpected'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  return { items, isLoading, error, retry: fetchFavorites };
}
