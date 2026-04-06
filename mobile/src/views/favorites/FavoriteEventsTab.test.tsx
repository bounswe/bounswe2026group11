/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import FavoriteEventsTab from './FavoriteEventsTab';
import type { FavoriteEventsViewModel } from '@/viewmodels/favorites/useFavoriteEventsViewModel';
import { useFavoriteEventsViewModel } from '@/viewmodels/favorites/useFavoriteEventsViewModel';
import { router } from 'expo-router';

jest.mock('react-native', () => {
  const ReactLocal = require('react');
  const reactNativeOnlyProps = new Set([
    'accessibilityLabel',
    'activeOpacity',
    'contentContainerStyle',
    'hitSlop',
    'numberOfLines',
    'showsVerticalScrollIndicator',
  ]);

  const stripReactNativeOnlyProps = (props: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      if (!reactNativeOnlyProps.has(key)) {
        out[key] = props[key];
      }
    }
    return out;
  };

  const createDiv =
    (displayName: string) =>
      ({ children, ...props }: { children?: React.ReactNode }) =>
        ReactLocal.createElement(
          'div',
          { ...stripReactNativeOnlyProps(props), 'data-testid': displayName },
          children,
        );
  const createSpan =
    (displayName: string) =>
      ({ children, ...props }: { children?: React.ReactNode }) =>
        ReactLocal.createElement(
          'span',
          { ...stripReactNativeOnlyProps(props), 'data-testid': displayName },
          children,
        );

  return {
    ActivityIndicator: createDiv('ActivityIndicator'),
    View: createDiv('View'),
    Text: createSpan('Text'),
    TouchableOpacity: ({
      children,
      onPress,
      disabled,
      ...props
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      ReactLocal.createElement(
        'button',
        {
          ...stripReactNativeOnlyProps(props),
          type: 'button',
          disabled,
          onClick: onPress,
        },
        children,
      ),
    FlatList: ({
      data,
      renderItem,
      keyExtractor,
      ListEmptyComponent,
      ListFooterComponent,
    }: {
      data: Array<unknown>;
      renderItem: (item: { item: any; index: number }) => React.ReactNode;
      keyExtractor?: (item: any, index: number) => string;
      ListEmptyComponent?: React.ReactNode;
      ListFooterComponent?: React.ReactNode;
    }) =>
      ReactLocal.createElement(
        'div',
        { 'data-testid': 'FlatList' },
        data.length > 0
          ? data.map((item, index) =>
            ReactLocal.createElement(
              ReactLocal.Fragment,
              {
                key: keyExtractor ? keyExtractor(item, index) : String(index),
              },
              renderItem({ item, index }),
            ))
          : ListEmptyComponent,
        ListFooterComponent ?? null,
      ),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
  };
});

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');

  function createIconComponent(library: string) {
    return ({ name }: { name: string }) =>
      ReactLocal.createElement('span', {
        'data-icon-library': library,
        'data-icon': name,
      });
  }

  return {
    Ionicons: createIconComponent('ionicons'),
  };
});

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/components/profile/ProfileEventCard', () => {
  const ReactLocal = require('react');

  return {
    __esModule: true,
    default: ({
      title,
      categoryLabel,
      status,
      privacyLevel,
      locationAddress,
      onPress,
    }: {
      title: string;
      categoryLabel: string;
      status: string;
      privacyLevel: 'PUBLIC' | 'PROTECTED' | 'PRIVATE' | null;
      locationAddress?: string | null;
      onPress: () => void;
    }) =>
      ReactLocal.createElement(
        'button',
        {
          type: 'button',
          onClick: onPress,
        },
        `${title} | ${categoryLabel} | ${status} | ${privacyLevel ?? 'NO_PRIVACY'} | ${locationAddress ?? 'NO_LOCATION'}`,
      ),
  };
});

jest.mock('@/viewmodels/favorites/useFavoriteEventsViewModel', () => ({
  useFavoriteEventsViewModel: jest.fn(),
}));

const mockUseFavoriteEventsViewModel = jest.mocked(useFavoriteEventsViewModel);
const mockRouterPush = jest.mocked(router.push);

function buildViewModel(
  overrides: Partial<FavoriteEventsViewModel> = {},
): FavoriteEventsViewModel {
  return {
    events: [],
    isLoading: false,
    isRefreshing: false,
    isLoadingMore: false,
    hasMore: false,
    apiError: null,
    handleRemoveFavorite: jest
      .fn<(eventId: string) => Promise<void>>()
      .mockResolvedValue(undefined),
    refresh: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    loadMore: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('FavoriteEventsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the loading state while favorite events are being fetched', () => {
    mockUseFavoriteEventsViewModel.mockReturnValue(
      buildViewModel({ isLoading: true }),
    );

    render(<FavoriteEventsTab />);

    expect(screen.getByText('Loading favorites...')).toBeTruthy();
  });

  it('renders the empty state when the user has no favorite events', () => {
    mockUseFavoriteEventsViewModel.mockReturnValue(buildViewModel());

    render(<FavoriteEventsTab />);

    expect(screen.getByText('No favorite events yet')).toBeTruthy();
    expect(screen.getByText('Tap the heart icon on an event to save it here.')).toBeTruthy();
  });

  it('renders an error banner without the empty state when loading fails', () => {
    mockUseFavoriteEventsViewModel.mockReturnValue(
      buildViewModel({
        apiError: 'Favorites are temporarily unavailable.',
      }),
    );

    render(<FavoriteEventsTab />);

    expect(screen.getByText('Favorites are temporarily unavailable.')).toBeTruthy();
    expect(screen.queryByText('No favorite events yet')).toBeNull();
  });

  it('renders favorite events from the dedicated favorites payload and navigates on press', () => {
    mockUseFavoriteEventsViewModel.mockReturnValue(
      buildViewModel({
        events: [
          {
            id: 'event-1',
            title: 'Forest Walk',
            category: 'Outdoors',
            image_url: null,
            status: 'COMPLETED',
            start_time: '2026-04-09T14:00:00+03:00',
            end_time: null,
            favorited_at: '2026-04-06T10:00:00+03:00',
          },
        ],
      }),
    );

    render(<FavoriteEventsTab />);

    const eventButton = screen.getByText('Forest Walk | Outdoors | COMPLETED | NO_PRIVACY | NO_LOCATION');
    expect(eventButton).toBeTruthy();

    fireEvent.click(eventButton);

    expect(mockRouterPush).toHaveBeenCalledWith('/event/event-1');
  });

  it('passes the optional privacy level through when the favorites response includes it', () => {
    mockUseFavoriteEventsViewModel.mockReturnValue(
      buildViewModel({
        events: [
          {
            id: 'event-2',
            title: 'City Ride',
            category: 'Sports',
            image_url: null,
            privacy_level: 'PROTECTED',
            status: 'ACTIVE',
            start_time: '2026-04-12T09:00:00+03:00',
            end_time: null,
            favorited_at: '2026-04-06T12:00:00+03:00',
          },
        ],
      }),
    );

    render(<FavoriteEventsTab />);

    expect(screen.getByText('City Ride | Sports | ACTIVE | PROTECTED | NO_LOCATION')).toBeTruthy();
  });

  it('passes the optional location address through when the favorites response includes it', () => {
    mockUseFavoriteEventsViewModel.mockReturnValue(
      buildViewModel({
        events: [
          {
            id: 'event-3',
            title: 'Sunrise Meetup',
            category: 'Wellness',
            image_url: null,
            location_address: 'Bebek Sahili, Besiktas, Istanbul, Turkiye',
            status: 'ACTIVE',
            start_time: '2026-04-13T07:00:00+03:00',
            end_time: null,
            favorited_at: '2026-04-06T13:00:00+03:00',
          },
        ],
      }),
    );

    render(<FavoriteEventsTab />);

    expect(
      screen.getByText(
        'Sunrise Meetup | Wellness | ACTIVE | NO_PRIVACY | Bebek Sahili, Besiktas, Istanbul, Turkiye',
      ),
    ).toBeTruthy();
  });
});
