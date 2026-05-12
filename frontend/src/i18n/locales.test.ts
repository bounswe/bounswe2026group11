import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import tr from './locales/tr.json';

function collectKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    out.push(...collectKeys(v, next));
  }
  return out;
}

function collectEmptyKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj === 'string') return obj.trim() === '' ? [prefix] : [];
  if (typeof obj !== 'object' || obj === null) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    out.push(...collectEmptyKeys(v, next));
  }
  return out;
}

describe('locale catalogs', () => {
  it('en and tr have identical key sets', () => {
    const enKeys = collectKeys(en).sort();
    const trKeys = collectKeys(tr).sort();
    const missingInTr = enKeys.filter((k) => !trKeys.includes(k));
    const missingInEn = trKeys.filter((k) => !enKeys.includes(k));
    expect({ missingInTr, missingInEn }).toEqual({ missingInTr: [], missingInEn: [] });
  });

  it('en has no empty string values', () => {
    expect(collectEmptyKeys(en)).toEqual([]);
  });

  it('tr has no empty string values', () => {
    expect(collectEmptyKeys(tr)).toEqual([]);
  });
});
