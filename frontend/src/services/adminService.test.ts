import { describe, expect, it } from 'vitest';
import { buildAdminListPath } from './adminService';

describe('buildAdminListPath', () => {
  it('serializes filters and pagination while skipping empty values', () => {
    const path = buildAdminListPath('/admin/users', {
      q: 'ali',
      role: 'ADMIN',
      status: '',
      created_from: '2026-05-06T10:00',
      created_to: undefined,
      limit: 25,
      offset: 50,
    });

    const url = new URL(path, 'http://localhost');
    expect(url.pathname).toBe('/admin/users');
    expect(url.searchParams.get('q')).toBe('ali');
    expect(url.searchParams.get('role')).toBe('ADMIN');
    expect(url.searchParams.get('status')).toBeNull();
    expect(url.searchParams.get('limit')).toBe('25');
    expect(url.searchParams.get('offset')).toBe('50');

    const createdFrom = url.searchParams.get('created_from');
    expect(createdFrom).toBeTruthy();
    expect(createdFrom).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
    expect(Number.isNaN(new Date(createdFrom as string).getTime())).toBe(false);
  });
});
