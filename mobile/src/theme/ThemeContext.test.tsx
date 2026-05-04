/**
 * @jest-environment jsdom
 *
 * Tests for ThemeProvider and useTheme.
 *
 * The test file imports the real ThemeContext implementation (not the mock
 * used by component tests) so we can verify the context logic in isolation.
 */
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import * as SecureStore from 'expo-secure-store';

// ── react-native mock ──────────────────────────────────────────────────────
// We need to control useColorScheme per-test, so we mock the whole module.
let mockColorScheme: 'light' | 'dark' | null = 'light';

jest.mock('react-native', () => {
  const ReactLocal = require('react');
  return {
    useColorScheme: () => mockColorScheme,
    StyleSheet: { create: (s: any) => s },
    // Minimal stubs so anything importing react-native won't crash.
    View: ({ children }: any) => ReactLocal.createElement('div', null, children),
    Text: ({ children }: any) => ReactLocal.createElement('span', null, children),
  };
});

// Use the *real* ThemeContext (not the jest/mocks/theme.js module mapper entry).
// We bypass @/theme alias to import directly from the source file.
import { ThemeProvider, useTheme } from './ThemeContext';
import { lightTheme, darkTheme } from './themes';

// ── helpers ────────────────────────────────────────────────────────────────
const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

/**
 * Tiny consumer that renders the resolved theme key so tests can assert which
 * theme is currently active.
 */
function ThemeConsumer() {
  const { theme, isDark, themePreference } = useTheme();
  return (
    <div>
      <span data-testid="bg">{theme.background}</span>
      <span data-testid="is-dark">{String(isDark)}</span>
      <span data-testid="pref">{themePreference}</span>
    </div>
  );
}

/**
 * Render ThemeProvider + ThemeConsumer and wait until the provider has
 * finished hydrating (i.e., children appear on screen).
 */
async function renderAndHydrate() {
  const result = render(
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>,
  );
  await waitFor(() => screen.getByTestId('bg'));
  return result;
}

// ── tests ──────────────────────────────────────────────────────────────────
describe('ThemeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockColorScheme = 'light';
    (mockedSecureStore as any).__reset();
  });

  it('renders nothing before the stored preference is resolved', () => {
    // Make SecureStore hang indefinitely
    mockedSecureStore.getItemAsync.mockImplementation(
      () => new Promise(() => {}),
    );

    render(
      <ThemeProvider>
        <span data-testid="child">hello</span>
      </ThemeProvider>,
    );

    expect(screen.queryByTestId('child')).toBeNull();
  });

  it('renders children once the stored preference is resolved', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    render(
      <ThemeProvider>
        <span data-testid="child">hello</span>
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('child')).toBeTruthy());
  });

  it('applies lightTheme when system is light and no stored preference', async () => {
    mockColorScheme = 'light';
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    await renderAndHydrate();

    expect(screen.getByTestId('bg').textContent).toBe(lightTheme.background);
    expect(screen.getByTestId('is-dark').textContent).toBe('false');
    expect(screen.getByTestId('pref').textContent).toBe('system');
  });

  it('applies darkTheme when system is dark and no stored preference', async () => {
    mockColorScheme = 'dark';
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    await renderAndHydrate();

    expect(screen.getByTestId('bg').textContent).toBe(darkTheme.background);
    expect(screen.getByTestId('is-dark').textContent).toBe('true');
  });

  it('applies the stored preference "dark" regardless of system scheme', async () => {
    mockColorScheme = 'light';
    mockedSecureStore.getItemAsync.mockResolvedValue('dark');

    await renderAndHydrate();

    expect(screen.getByTestId('bg').textContent).toBe(darkTheme.background);
    expect(screen.getByTestId('is-dark').textContent).toBe('true');
    expect(screen.getByTestId('pref').textContent).toBe('dark');
  });

  it('applies the stored preference "light" regardless of system scheme', async () => {
    mockColorScheme = 'dark';
    mockedSecureStore.getItemAsync.mockResolvedValue('light');

    await renderAndHydrate();

    expect(screen.getByTestId('bg').textContent).toBe(lightTheme.background);
    expect(screen.getByTestId('is-dark').textContent).toBe('false');
    expect(screen.getByTestId('pref').textContent).toBe('light');
  });

  it('ignores an invalid stored value and falls back to system', async () => {
    mockColorScheme = 'light';
    mockedSecureStore.getItemAsync.mockResolvedValue('invalid-value');

    await renderAndHydrate();

    expect(screen.getByTestId('bg').textContent).toBe(lightTheme.background);
    expect(screen.getByTestId('pref').textContent).toBe('system');
  });

  it('still hydrates when SecureStore.getItemAsync rejects', async () => {
    mockedSecureStore.getItemAsync.mockRejectedValue(new Error('disk error'));

    await renderAndHydrate();

    // Should fall back to system/light
    expect(screen.getByTestId('bg').textContent).toBe(lightTheme.background);
    expect(screen.getByTestId('pref').textContent).toBe('system');
  });
});

describe('setThemePreference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockColorScheme = 'light';
    (mockedSecureStore as any).__reset();
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
  });

  function SetterConsumer({ next }: { next: 'light' | 'dark' | 'system' }) {
    const { setThemePreference, isDark, themePreference } = useTheme();
    return (
      <div>
        <span data-testid="is-dark">{String(isDark)}</span>
        <span data-testid="pref">{themePreference}</span>
        <button
          onClick={() => setThemePreference(next)}
          data-testid="set-btn"
        >
          set
        </button>
      </div>
    );
  }

  it('switches to dark theme when preference is set to "dark"', async () => {
    render(
      <ThemeProvider>
        <SetterConsumer next="dark" />
      </ThemeProvider>,
    );
    await waitFor(() => screen.getByTestId('set-btn'));

    await act(async () => {
      screen.getByTestId('set-btn').click();
    });

    expect(screen.getByTestId('is-dark').textContent).toBe('true');
    expect(screen.getByTestId('pref').textContent).toBe('dark');
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'theme_preference',
      'dark',
    );
  });

  it('switches to light theme when preference is set to "light"', async () => {
    mockColorScheme = 'dark';

    render(
      <ThemeProvider>
        <SetterConsumer next="light" />
      </ThemeProvider>,
    );
    await waitFor(() => screen.getByTestId('set-btn'));

    await act(async () => {
      screen.getByTestId('set-btn').click();
    });

    expect(screen.getByTestId('is-dark').textContent).toBe('false');
    expect(screen.getByTestId('pref').textContent).toBe('light');
  });

  it('returns to system scheme when preference is set to "system"', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('dark');

    render(
      <ThemeProvider>
        <SetterConsumer next="system" />
      </ThemeProvider>,
    );
    await waitFor(() => screen.getByTestId('set-btn'));

    // At this point preference should be 'dark' from stored value
    expect(screen.getByTestId('pref').textContent).toBe('dark');

    await act(async () => {
      screen.getByTestId('set-btn').click();
    });

    // System is 'light' so isDark should be false now
    expect(screen.getByTestId('is-dark').textContent).toBe('false');
    expect(screen.getByTestId('pref').textContent).toBe('system');
  });

  it('persists the preference even when SecureStore.setItemAsync rejects', async () => {
    mockedSecureStore.setItemAsync.mockRejectedValue(new Error('disk full'));

    render(
      <ThemeProvider>
        <SetterConsumer next="dark" />
      </ThemeProvider>,
    );
    await waitFor(() => screen.getByTestId('set-btn'));

    // Should not throw
    await act(async () => {
      screen.getByTestId('set-btn').click();
    });

    // In-session preference should still update
    expect(screen.getByTestId('is-dark').textContent).toBe('true');
  });
});

describe('useTheme outside provider', () => {
  it('throws an error when called outside ThemeProvider', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    function Broken() {
      useTheme();
      return null;
    }

    expect(() => render(<Broken />)).toThrow(
      'useTheme must be called inside <ThemeProvider>',
    );

    consoleSpy.mockRestore();
  });
});
