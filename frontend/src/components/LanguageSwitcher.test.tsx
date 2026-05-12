// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { LOCALE_STORAGE_KEY, setCurrentLocale } from '@/i18n';
import LanguageSwitcher from './LanguageSwitcher';

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await setCurrentLocale('en');
  });

  it('switches locale and persists the selection', async () => {
    render(
      <LocaleProvider>
        <LanguageSwitcher />
      </LocaleProvider>,
    );

    const turkishButton = screen.getByRole('button', { name: 'Turkish' });

    await act(async () => {
      turkishButton.click();
    });

    expect(turkishButton.getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('tr');
  });
});
