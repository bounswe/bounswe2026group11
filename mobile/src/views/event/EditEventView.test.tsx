/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { EventDetail, UpdateEventResponse } from '@/models/event';
import type { EditEventViewModel } from '@/viewmodels/event/useEditEventViewModel';
import EditEventView from './EditEventView';
import { useEditEventViewModel } from '@/viewmodels/event/useEditEventViewModel';

const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactLocal = require('react');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      ReactLocal.createElement('div', null, children),
  };
});

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');
  const Icon = ({ name }: { name: string }) =>
    ReactLocal.createElement('span', { 'data-icon': name });
  return {
    Feather: Icon,
    MaterialIcons: Icon,
  };
});

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLocal = require('react');
  return function MockDateTimePicker({ mode }: { mode: string }) {
    return ReactLocal.createElement('div', { 'data-testid': `datetimepicker-${mode}` });
  };
});

jest.mock('@/components/events/PointPickerMap', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'PointPickerMap' });
});

jest.mock('@/components/events/RoutePointsEditor', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'RoutePointsEditor' });
});

jest.mock('@/viewmodels/event/useEditEventViewModel', () => ({
  useEditEventViewModel: jest.fn(),
}));

const mockUseEditEventViewModel = jest.mocked(useEditEventViewModel);

function makeEvent(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    id: 'event-1',
    version_no: 3,
    title: 'Istanbul Trail Morning',
    description: 'A friendly morning trail run with coffee after the route.',
    image_url: null,
    privacy_level: 'PUBLIC',
    status: 'ACTIVE',
    start_time: '2035-06-01T08:00:00+03:00',
    end_time: '2035-06-01T10:00:00+03:00',
    capacity: 12,
    minimum_age: null,
    preferred_gender: null,
    approved_participant_count: 4,
    pending_participant_count: 1,
    favorite_count: 2,
    created_at: '2026-04-01T12:00:00+03:00',
    updated_at: '2026-04-02T12:00:00+03:00',
    category: { id: 7, name: 'Outdoors' },
    host: {
      id: 'host-1',
      username: 'host_user',
      display_name: 'Host User',
      avatar_url: null,
    },
    host_score: {
      final_score: 4.8,
      hosted_event_rating_count: 6,
    },
    location: {
      type: 'POINT',
      address: 'Belgrad Forest, Istanbul',
      point: { lat: 41.182, lon: 28.987 },
      route_points: [],
    },
    tags: [],
    constraints: [{ type: 'equipment', info: 'Bring water' }],
    rating_window: {
      opens_at: '2035-06-01T10:00:00+03:00',
      closes_at: '2035-06-08T10:00:00+03:00',
      is_active: false,
    },
    viewer_event_rating: null,
    viewer_context: {
      is_host: true,
      is_favorited: false,
      participation_status: 'NONE',
      latest_event_version: 3,
    },
    host_context: null,
    ...overrides,
  };
}

const updateResult: UpdateEventResponse = {
  id: 'event-1',
  title: 'Updated Istanbul Trail Morning',
  privacy_level: 'PUBLIC',
  status: 'ACTIVE',
  start_time: '2035-06-01T08:00:00+03:00',
  end_time: '2035-06-01T10:00:00+03:00',
  version_no: 4,
  reconfirmation_required: true,
  reconfirmation_triggered_fields: ['title'],
  participants_marked_pending: 3,
  updated_at: '2026-04-03T12:00:00+03:00',
};

function buildViewModel(
  overrides: Partial<EditEventViewModel> = {},
): EditEventViewModel {
  return {
    event: makeEvent(),
    formData: {
      title: 'Istanbul Trail Morning',
      description: 'A friendly morning trail run with coffee after the route.',
      imageUrl: '',
      categoryId: 7,
      locationType: 'POINT',
      locationQuery: 'Belgrad Forest, Istanbul',
      address: 'Belgrad Forest, Istanbul',
      lat: 41.182,
      lon: 28.987,
      routePoints: [],
      startDate: '01.06.2035',
      startTime: '08:00',
      endDate: '01.06.2035',
      endTime: '10:00',
      privacyLevel: 'PUBLIC',
      tags: [],
      tagInput: '',
      constraints: [{ type: 'equipment', info: 'Bring water' }],
      constraintType: 'gender',
      genderConstraintValue: null,
      ageMinInput: '',
      ageMaxInput: '',
      capacityInput: '12',
      otherConstraintInput: '',
      invitationMessage: '',
      childFriendly: false,
      familyOriented: false,
    },
    errors: {},
    isLoading: false,
    isSaving: false,
    apiError: null,
    successMessage: null,
    updateResult: null,
    locationSuggestions: [],
    isSearchingLocation: false,
    categoriesExpanded: false,
    canEdit: true,
    constraintDraftType: '',
    constraintDraftInfo: '',
    previewChanges: jest.fn(() => null),
    handleSubmit: jest.fn().mockResolvedValue(null),
    updateField: jest.fn(),
    handleLocationSearch: jest.fn(),
    selectLocation: jest.fn(),
    clearLocation: jest.fn(),
    setLocationType: jest.fn(),
    setPointFromCoordinate: jest.fn(),
    addRoutePointFromCoordinate: jest.fn(),
    addRoutePointFromSuggestion: jest.fn(),
    removeRoutePoint: jest.fn(),
    moveRoutePoint: jest.fn(),
    updateRoutePointLabel: jest.fn(),
    toggleCategoriesExpanded: jest.fn(),
    updateConstraintDraftType: jest.fn(),
    updateConstraintDraftInfo: jest.fn(),
    addConstraint: jest.fn(),
    removeConstraint: jest.fn(),
    retry: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('EditEventView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the current event values in the supported edit form', () => {
    mockUseEditEventViewModel.mockReturnValue(buildViewModel());

    render(<EditEventView eventId="event-1" />);

    expect(screen.getByText('Edit Event')).toBeTruthy();
    expect(screen.getByText('v3')).toBeTruthy();
    expect(screen.getByDisplayValue('Istanbul Trail Morning')).toBeTruthy();
    expect(
      screen.getByDisplayValue('A friendly morning trail run with coffee after the route.'),
    ).toBeTruthy();
    expect(screen.getByDisplayValue('Belgrad Forest, Istanbul')).toBeTruthy();
    expect(screen.getByDisplayValue('12')).toBeTruthy();
    expect(screen.getByText('Bring water')).toBeTruthy();
    expect(screen.queryByText('Privacy Level')).toBeNull();
  });

  it('shows confirmation for critical updates and navigates to refreshed detail on success', async () => {
    const previewChanges = jest.fn(() => ({
      request: { title: 'Updated Istanbul Trail Morning' },
      changedFields: ['title'],
      criticalChangeLabels: ['Title'],
    }));
    const handleSubmit = jest.fn().mockResolvedValue(updateResult);

    mockUseEditEventViewModel.mockReturnValue(
      buildViewModel({
        previewChanges,
        handleSubmit,
      }),
    );

    render(<EditEventView eventId="event-1" />);

    fireEvent.click(screen.getByTestId('edit-event-save-button'));

    expect(screen.getByTestId('edit-event-confirmation')).toBeTruthy();
    expect(screen.getByText('Review before saving')).toBeTruthy();
    expect(screen.getAllByText('Title').length).toBeGreaterThan(1);

    fireEvent.click(screen.getByText('Save Anyway'));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({ title: 'Updated Istanbul Trail Morning' });
      expect(mockReplace).toHaveBeenCalledWith('/event/event-1');
    });
  });

  it('communicates API failures in the edit screen', () => {
    mockUseEditEventViewModel.mockReturnValue(
      buildViewModel({
        apiError: 'Capacity cannot be below approved plus pending participants.',
      }),
    );

    render(<EditEventView eventId="event-1" />);

    expect(screen.getByTestId('edit-event-error')).toBeTruthy();
    expect(
      screen.getByText('Capacity cannot be below approved plus pending participants.'),
    ).toBeTruthy();
  });
});
