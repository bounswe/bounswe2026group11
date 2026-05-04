import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { type Theme, darkTheme, lightTheme } from './themes';

export type ThemePreference = 'light' | 'dark' | 'system';

const SECURE_STORE_KEY = 'theme_preference';

interface ThemeContextValue {
  /** Resolved theme object for the current color scheme */
  theme: Theme;
  /** Whether dark mode is currently active */
  isDark: boolean;
  /** User-persisted preference: 'light' | 'dark' | 'system' */
  themePreference: ThemePreference;
  /** Persist a new preference and apply immediately */
  setThemePreference: (preference: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(SECURE_STORE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreference(stored);
        }
      })
      .catch(() => {
        // Ignore read errors — fall back to 'system'
      })
      .finally(() => {
        setIsHydrated(true);
      });
  }, []);

  const isDark = useMemo(() => {
    if (preference === 'light') return false;
    if (preference === 'dark') return true;
    return systemScheme === 'dark';
  }, [preference, systemScheme]);

  const theme = useMemo(() => (isDark ? darkTheme : lightTheme), [isDark]);

  const setThemePreference = useCallback(async (next: ThemePreference) => {
    setPreference(next);
    try {
      await SecureStore.setItemAsync(SECURE_STORE_KEY, next);
    } catch {
      // Persist failure is non-fatal; preference still applies for the session
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, isDark, themePreference: preference, setThemePreference }),
    [theme, isDark, preference, setThemePreference],
  );

  // Don't render children until we've read the stored preference so the
  // initial render uses the correct theme instead of flickering.
  if (!isHydrated) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be called inside <ThemeProvider>');
  }
  return ctx;
}
