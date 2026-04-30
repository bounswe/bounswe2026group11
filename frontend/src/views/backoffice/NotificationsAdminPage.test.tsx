// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationsAdminPage from './NotificationsAdminPage';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'admin-token' }),
}));

vi.mock('@/services/adminService', () => ({
  createAdminNotification: vi.fn(),
  listAdminNotifications: vi.fn(),
}));

import { createAdminNotification, listAdminNotifications } from '@/services/adminService';

const mockCreateNotification = createAdminNotification as ReturnType<typeof vi.fn>;
const mockListNotifications = listAdminNotifications as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockListNotifications.mockResolvedValue({
    items: [],
    limit: 25,
    offset: 0,
    total_count: 0,
    has_next: false,
  });
});

afterEach(() => {
  cleanup();
});

describe('NotificationsAdminPage', () => {
  it('validates required fields without clearing typed state', async () => {
    render(<NotificationsAdminPage />);

    fireEvent.change(screen.getByLabelText('Target user ID'), { target: { value: 'not-a-uuid' } });
    fireEvent.click(screen.getByLabelText('Add target user'));
    fireEvent.change(screen.getByLabelText('Notification body'), { target: { value: 'Body stays here' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send notification' }));

    expect(await screen.findByText('User IDs must be valid UUIDs.')).toBeDefined();
    expect(screen.getByLabelText('Notification body')).toHaveProperty('value', 'Body stays here');
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('submits selected delivery mode and displays backend result counts', async () => {
    mockCreateNotification.mockResolvedValue({
      target_user_count: 2,
      created_count: 2,
      idempotent_count: 0,
      sse_delivery_count: 2,
      push_active_device_count: 2,
      push_sent_count: 1,
      push_failed_count: 1,
      invalid_token_count: 0,
    });

    render(<NotificationsAdminPage />);

    fireEvent.change(screen.getByLabelText('Target user ID'), { target: { value: '11111111-1111-4111-8111-111111111111' } });
    fireEvent.click(screen.getByLabelText('Add target user'));
    fireEvent.change(screen.getByLabelText('Target user ID'), { target: { value: '22222222-2222-4222-8222-222222222222' } });
    fireEvent.click(screen.getByLabelText('Add target user'));
    fireEvent.change(screen.getByLabelText('Delivery mode'), { target: { value: 'BOTH' } });
    fireEvent.change(screen.getByLabelText('Notification title'), { target: { value: 'Ops update' } });
    fireEvent.change(screen.getByLabelText('Notification body'), { target: { value: 'Doors open at 18:00.' } });
    fireEvent.change(screen.getByLabelText('Notification data JSON'), { target: { value: '{"source":"test"}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send notification' }));

    await waitFor(() => expect(mockCreateNotification).toHaveBeenCalledWith('admin-token', {
      user_ids: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
      delivery_mode: 'BOTH',
      title: 'Ops update',
      body: 'Doors open at 18:00.',
      type: null,
      deep_link: null,
      event_id: null,
      data: { source: 'test' },
    }));
    expect(screen.getByText('Created: 2')).toBeDefined();
    expect(screen.getByText('Push failed: 1')).toBeDefined();
  });

  it('loads sent notifications and filters by user', async () => {
    mockListNotifications.mockResolvedValue({
      items: [{
        id: '99999999-9999-4999-8999-999999999999',
        receiver_user_id: '11111111-1111-4111-8111-111111111111',
        username: 'alice',
        user_email: 'alice@example.com',
        event_id: null,
        event_title: null,
        title: 'Welcome',
        type: 'ADMIN',
        body: 'Hello there',
        deep_link: null,
        data: {},
        is_read: false,
        read_at: null,
        deleted_at: null,
        sse_sent_count: 1,
        push_sent_count: 0,
        push_failed_count: 0,
        created_at: '2026-05-01T10:00:00Z',
        updated_at: '2026-05-01T10:00:00Z',
      }],
      limit: 25,
      offset: 0,
      total_count: 1,
      has_next: false,
    });

    render(<NotificationsAdminPage />);

    expect(await screen.findByText('alice')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Notification user filter'), { target: { value: '11111111-1111-4111-8111-111111111111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(mockListNotifications).toHaveBeenCalledWith('admin-token', expect.objectContaining({
      user_id: '11111111-1111-4111-8111-111111111111',
    })));
  });
});
