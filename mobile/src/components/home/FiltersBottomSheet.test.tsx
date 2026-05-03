/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FiltersBottomSheet from './FiltersBottomSheet';

jest.mock('react-native', () => {
  const ReactLocal = require('react');

  const reactNativeOnlyProps = new Set([
    'accessibilityLabel',
    'accessibilityRole',
    'activeOpacity',
    'animationType',
    'contentContainerStyle',
    'keyboardShouldPersistTaps',
    'keyboardType',
    'onRequestClose',
    'placeholderTextColor',
    'showsVerticalScrollIndicator',
    'transparent',
    'visible',
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

  const mergeStyle = (style: unknown): React.CSSProperties | undefined => {
    if (Array.isArray(style)) {
      return style.reduce(
        (acc, item) => ({ ...acc, ...(mergeStyle(item) ?? {}) }),
        {},
      );
    }

    if (style && typeof style === 'object') {
      return style as React.CSSProperties;
    }

    return undefined;
  };

  const createContainer =
    (tagName: string) =>
      ({ children, style, ...props }: { children?: React.ReactNode; style?: unknown }) =>
        ReactLocal.createElement(
          tagName,
          {
            style: mergeStyle(style),
            ...stripReactNativeOnlyProps(props),
          },
          children,
        );

  const createButton =
    ({ children, onPress, style, disabled, ...props }: {
      children?: React.ReactNode;
      onPress?: () => void;
      style?: unknown;
      disabled?: boolean;
    }) =>
      ReactLocal.createElement(
        'button',
        {
          type: 'button',
          disabled,
          style: mergeStyle(style),
          onClick: disabled ? undefined : onPress,
          ...stripReactNativeOnlyProps(props),
        },
        children,
      );

  class AnimatedValue {
    value: number;

    constructor(value: number) {
      this.value = value;
    }

    setValue(nextValue: number) {
      this.value = nextValue;
    }
  }

  return {
    Animated: {
      Value: AnimatedValue,
      View: createContainer('div'),
      timing: () => ({
        start: (callback?: () => void) => callback?.(),
      }),
      spring: () => ({
        start: (callback?: () => void) => callback?.(),
      }),
    },
    Dimensions: {
      get: () => ({ height: 900, width: 430 }),
    },
    KeyboardAvoidingView: createContainer('div'),
    Modal: ({
      children,
      visible,
    }: {
      children?: React.ReactNode;
      visible: boolean;
    }) => (visible ? ReactLocal.createElement('div', null, children) : null),
    PanResponder: {
      create: () => ({
        panHandlers: {},
      }),
    },
    Platform: {
      OS: 'ios',
    },
    ScrollView: createContainer('div'),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
    Text: createContainer('span'),
    TextInput: ({
      value,
      onChangeText,
      style,
      ...props
    }: {
      value?: string;
      onChangeText?: (value: string) => void;
      style?: unknown;
    }) =>
      ReactLocal.createElement('input', {
        value,
        style: mergeStyle(style),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        ...stripReactNativeOnlyProps(props),
      }),
    TouchableOpacity: createButton,
    View: createContainer('div'),
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

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'date-picker' });
});

jest.mock('@react-native-community/slider', () => {
  const ReactLocal = require('react');
  return ({ value }: { value: number }) =>
    ReactLocal.createElement('input', {
      'data-testid': 'radius-slider',
      type: 'range',
      value,
      readOnly: true,
    });
});

function buildProps() {
  return {
    visible: true,
    categories: [
      { id: 1, name: 'Sports' },
      { id: 2, name: 'Music' },
    ],
    draftFilters: {
      categoryIds: [],
      privacyLevels: [],
      startDate: '',
      endDate: '',
      radiusKm: 10,
      sortBy: 'START_TIME' as const,
    },
    errorMessage: null,
    onClose: jest.fn(),
    onReset: jest.fn(),
    onApply: jest.fn(),
    onToggleCategory: jest.fn(),
    onTogglePrivacy: jest.fn(),
    onChangeStartDate: jest.fn(),
    onChangeEndDate: jest.fn(),
    onChangeRadius: jest.fn(),
    onChangeSortBy: jest.fn(),
  };
}

describe('FiltersBottomSheet', () => {
  it('renders the frontend sort options', () => {
    render(<FiltersBottomSheet {...buildProps()} />);

    expect(screen.getByText('Sort by')).toBeTruthy();
    expect(screen.getByText('Soonest')).toBeTruthy();
    expect(screen.getByText('Nearest')).toBeTruthy();
  });

  it('shows the selected sort option and calls back when another one is pressed', () => {
    const props = buildProps();
    const { rerender } = render(<FiltersBottomSheet {...props} />);

    const soonestButton = screen.getByText('Soonest').closest('button');
    const nearestButton = screen.getByText('Nearest').closest('button');

    expect(soonestButton).toBeTruthy();
    expect(nearestButton).toBeTruthy();
    expect((soonestButton as HTMLButtonElement).style.backgroundColor).toBe(
      'rgb(17, 24, 39)',
    );

    fireEvent.click(nearestButton as HTMLButtonElement);
    expect(props.onChangeSortBy).toHaveBeenCalledWith('DISTANCE');

    rerender(
      <FiltersBottomSheet
        {...props}
        draftFilters={{
          ...props.draftFilters,
          sortBy: 'DISTANCE',
        }}
      />,
    );

    expect((screen.getByText('Nearest').closest('button') as HTMLButtonElement).style.backgroundColor).toBe(
      'rgb(17, 24, 39)',
    );
  });
});
