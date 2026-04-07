/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import LocationPickerPanel from './LocationPickerPanel';

jest.mock('react-native', () => {
  const ReactLocal = require('react');

  const reactNativeOnlyProps = new Set([
    'accessibilityLabel',
    'accessibilityRole',
    'activeOpacity',
    'autoCorrect',
    'contentContainerStyle',
    'keyboardShouldPersistTaps',
    'numberOfLines',
    'placeholderTextColor',
    'showsVerticalScrollIndicator',
    'transparent',
    'animationType',
    'onRequestClose',
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

  const createButton =
    (displayName: string) =>
      ({
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
            'data-testid': displayName,
            type: 'button',
            disabled,
            onClick: disabled ? undefined : onPress,
          },
          children,
        );

  return {
    ActivityIndicator: createDiv('ActivityIndicator'),
    Modal: ({
      children,
      visible,
    }: {
      children?: React.ReactNode;
      visible: boolean;
    }) => (visible ? ReactLocal.createElement('div', null, children) : null),
    View: createDiv('View'),
    ScrollView: createDiv('ScrollView'),
    Pressable: createButton('Pressable'),
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
        ...stripReactNativeOnlyProps(props),
        value,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    TouchableOpacity: createButton('TouchableOpacity'),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
      absoluteFillObject: {},
    },
  };
});

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');

  return {
    Feather: ({ name }: { name: string }) =>
      ReactLocal.createElement('span', {
        'data-icon-library': 'feather',
        'data-icon': name,
      }),
  };
});

function buildProps() {
  return {
    visible: true,
    query: '',
    suggestions: [],
    isSearching: false,
    selectedLocation: null,
    anchorTop: 120,
    defaultOption: {
      title: 'Use Default Location',
      subtitle: 'Kadikoy, Istanbul, Turkiye',
      suggestion: {
        display_name: 'Kadikoy, Istanbul, Turkiye',
        lat: '40.9909',
        lon: '29.0293',
      },
      isLoading: false,
    },
    favoriteOptions: [
      {
        id: 'favorite-1',
        title: 'Home',
        subtitle: 'Kadikoy, Istanbul, Turkiye',
        suggestion: {
          display_name: 'Kadikoy, Istanbul, Turkiye',
          lat: '40.9909',
          lon: '29.0293',
        },
      },
      {
        id: 'favorite-2',
        title: 'Gym',
        subtitle: 'Besiktas, Istanbul, Turkiye',
        suggestion: {
          display_name: 'Besiktas, Istanbul, Turkiye',
          lat: '41.0422',
          lon: '29.0083',
        },
      },
    ],
    isLoadingFavoriteLocations: false,
    favoriteLocationsError: null,
    onClose: jest.fn(),
    onReset: jest.fn(),
    onRetryFavoriteLocations: jest.fn(),
    onChangeQuery: jest.fn(),
    onSelectSavedLocation: jest.fn(),
    onSelectSuggestion: jest.fn(),
    onApply: jest.fn(),
  };
}

describe('LocationPickerPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the default option and favorite locations as ready-to-use choices', () => {
    const props = buildProps();

    render(<LocationPickerPanel {...props} />);

    expect(screen.getByPlaceholderText('Search for a location')).toBeTruthy();
    expect(screen.getByText('Use Default Location')).toBeTruthy();
    expect(screen.getByText('Favorite Locations')).toBeTruthy();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Gym')).toBeTruthy();
    expect(screen.getAllByText('Kadikoy, Istanbul, Turkiye').length).toBeGreaterThan(0);
    expect(
      (screen.getByText('Apply Location').closest('button') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('shows a loading state while favorite locations are being fetched', () => {
    const props = buildProps();

    render(
      <LocationPickerPanel
        {...props}
        favoriteOptions={[]}
        isLoadingFavoriteLocations
      />,
    );

    expect(screen.getByText('Loading favorite locations...')).toBeTruthy();
    expect(screen.queryByText('No favorite locations saved yet.')).toBeNull();
  });

  it('shows an empty state when the user has no favorite locations', () => {
    const props = buildProps();

    render(
      <LocationPickerPanel
        {...props}
        favoriteOptions={[]}
      />,
    );

    expect(screen.getByText('No favorite locations saved yet.')).toBeTruthy();
  });

  it('shows an error state with retry when favorite locations fail to load', () => {
    const props = buildProps();

    render(
      <LocationPickerPanel
        {...props}
        favoriteOptions={[]}
        favoriteLocationsError="Failed to load favorite locations. Please try again."
      />,
    );

    fireEvent.click(screen.getByText('Retry'));

    expect(screen.getByText('Unable to load favorite locations')).toBeTruthy();
    expect(props.onRetryFavoriteLocations).toHaveBeenCalledTimes(1);
  });

  it('shows only search results while the user is searching', () => {
    const props = buildProps();

    render(
      <LocationPickerPanel
        {...props}
        query="be"
        suggestions={[
          {
            display_name: 'Besiktas, Istanbul, Turkiye',
            lat: '41.0422',
            lon: '29.0083',
          },
        ]}
      />,
    );

    expect(screen.getByText('Search Results')).toBeTruthy();
    expect(screen.getByText('Besiktas, Istanbul')).toBeTruthy();
    expect(screen.queryByText('Ready To Use')).toBeNull();
    expect(screen.queryByText('Favorite Locations')).toBeNull();
    expect(screen.queryByText('Use Default Location')).toBeNull();
  });
});
