import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type DiscoverViewMode = 'list' | 'map';

interface DiscoverViewModeContextValue {
  viewMode: DiscoverViewMode;
  setViewMode: (mode: DiscoverViewMode) => void;
  toggleViewMode: () => void;
}

const STORAGE_KEY = 'sem_discover_view_mode';
const DEFAULT_VIEW_MODE: DiscoverViewMode = 'map';

function readInitialViewMode(): DiscoverViewMode {
  if (typeof window === 'undefined') return DEFAULT_VIEW_MODE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'list' || stored === 'map') return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_VIEW_MODE;
}

const DiscoverViewModeContext = createContext<DiscoverViewModeContextValue>({
  viewMode: DEFAULT_VIEW_MODE,
  setViewMode: () => undefined,
  toggleViewMode: () => undefined,
});

export function DiscoverViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<DiscoverViewMode>(readInitialViewMode);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  const setViewMode = useCallback((mode: DiscoverViewMode) => {
    setViewModeState(mode);
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewModeState((prev) => (prev === 'map' ? 'list' : 'map'));
  }, []);

  const value = useMemo(
    () => ({ viewMode, setViewMode, toggleViewMode }),
    [viewMode, setViewMode, toggleViewMode],
  );

  return (
    <DiscoverViewModeContext.Provider value={value}>
      {children}
    </DiscoverViewModeContext.Provider>
  );
}

export function useDiscoverViewMode(): DiscoverViewModeContextValue {
  return useContext(DiscoverViewModeContext);
}
