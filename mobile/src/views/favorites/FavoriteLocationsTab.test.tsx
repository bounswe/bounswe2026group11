/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { FavoriteLocationsViewModel } from '@/viewmodels/favorites/useFavoriteLocationsViewModel';
import FavoriteLocationsTab from './FavoriteLocationsTab';
import { useFavoriteLocationsViewModel } from '@/viewmodels/favorites/useFavoriteLocationsViewModel';

jest.mock('react-native', () => {
  const ReactLocal = require('react');
  const createDiv =
    (displayName: string) =>
      ({ children, ...props }: { children?: React.ReactNode }) =>
        ReactLocal.createElement('div', { ...props, 'data-testid': displayName }, children);
  const createSpan =
    (displayName: string) =>
      ({ children, ...props }: { children?: React.ReactNode }) =>
        ReactLocal.createElement('span', { ...props, 'data-testid': displayName }, children);

  return {
    ActivityIndicator: createDiv('ActivityIndicator'),
    View: createDiv('View'),
    ScrollView: createDiv('ScrollView'),
    KeyboardAvoidingView: createDiv('KeyboardAvoidingView'),
    Text: createSpan('Text'),
    TextInput: ({
      value,
      onChangeText,
      ...props
    }: {
      value?: string;
      onChangeText?: (value: string) => void;
    }) =>
      ReactLocal.createElement('input', {
        ...props,
        value,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
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
          ...props,
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
    Modal: ({ children, visible }: { children: React.ReactNode; visible: boolean }) =>
      visible ? ReactLocal.createElement('div', null, children) : null,
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
    Platform: {
      OS: 'web',
    },
    Alert: {
      alert: jest.fn(),
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
    Feather: createIconComponent('feather'),
  };
});

jest.mock('@/viewmodels/favorites/useFavoriteLocationsViewModel', () => ({
  useFavoriteLocationsViewModel: jest.fn(),
}));

const mockUseFavoriteLocationsViewModel = jest.mocked(useFavoriteLocationsViewModel);

function buildViewModel(
  overrides: Partial<FavoriteLocationsViewModel> = {},
): FavoriteLocationsViewModel {
  return {
    locations: [],
    isLoading: false,
    isRefreshing: false,
    apiError: null,
    isAddModalOpen: false,
    addName: '',
    addLocationQuery: '',
    addSuggestions: [],
    isSearchingSuggestions: false,
    selectedSuggestion: null,
    addError: null,
    isSubmittingAdd: false,
    removingLocationId: null,
    canAddMore: true,
    refresh: jest.fn().mockResolvedValue(undefined),
    openAddModal: jest.fn(),
    closeAddModal: jest.fn(),
    setAddName: jest.fn(),
    setAddLocationQuery: jest.fn(),
    selectSuggestion: jest.fn(),
    submitAdd: jest.fn().mockResolvedValue(undefined),
    removeLocation: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('FavoriteLocationsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the loading state while favorite locations are being fetched', () => {
    mockUseFavoriteLocationsViewModel.mockReturnValue(
      buildViewModel({ isLoading: true }),
    );

    render(<FavoriteLocationsTab />);

    expect(screen.getByText('Loading favorite locations...')).toBeTruthy();
  });

  it('renders the empty state when the user has no saved favorite locations', () => {
    mockUseFavoriteLocationsViewModel.mockReturnValue(buildViewModel());

    render(<FavoriteLocationsTab />);

    expect(screen.getByText('No favorite locations')).toBeTruthy();
    expect(screen.getByText('Add up to 3 locations for quick access.')).toBeTruthy();
  });

  it('renders an error state with retry when loading favorite locations fails', () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    mockUseFavoriteLocationsViewModel.mockReturnValue(
      buildViewModel({
        apiError: 'Failed to load favorite locations. Please try again.',
        refresh,
      }),
    );

    render(<FavoriteLocationsTab />);

    expect(screen.getByText('Unable to load favorite locations')).toBeTruthy();
    expect(screen.queryByText('No favorite locations')).toBeNull();

    fireEvent.click(screen.getByText('Try again'));

    expect(refresh).toHaveBeenCalled();
  });

  it('shows the backend-backed count and limit banner when the user has three locations', () => {
    mockUseFavoriteLocationsViewModel.mockReturnValue(
      buildViewModel({
        locations: [
          {
            id: '1',
            name: 'Home',
            address: 'Home address',
            lat: 41.01,
            lon: 29.01,
          },
          {
            id: '2',
            name: 'Library',
            address: 'Library address',
            lat: 41.02,
            lon: 29.02,
          },
          {
            id: '3',
            name: 'Work',
            address: 'Work address',
            lat: 41.03,
            lon: 29.03,
          },
        ],
        canAddMore: false,
      }),
    );

    render(<FavoriteLocationsTab />);

    expect(screen.getByText('3 / 3 locations')).toBeTruthy();
    expect(screen.getByText('Maximum of 3 favorite locations reached.')).toBeTruthy();
  });
});
