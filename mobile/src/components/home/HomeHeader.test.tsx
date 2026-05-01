/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('react-native', () => {
  const ReactLocal = require('react');
  const rnProps = new Set([
    'accessibilityLabel',
    'accessibilityRole',
    'activeOpacity',
    'collapsable',
    'numberOfLines',
  ]);

  const strip = (props: any) => {
    const out = { ...props };
    if (out.accessibilityLabel) out['aria-label'] = out.accessibilityLabel;
    if (out.accessibilityRole) out['role'] = out.accessibilityRole;
    rnProps.forEach((p) => delete out[p]);
    return out;
  };

  const mergeStyle = (style: any) => {
    if (Array.isArray(style)) return Object.assign({}, ...style);
    return style;
  };

  return {
    StyleSheet: { create: (s: any) => s },
    View: ({ children, style, ...props }: any) =>
      ReactLocal.createElement('div', { style: mergeStyle(style), ...strip(props) }, children),
    Text: ({ children, style, ...props }: any) =>
      ReactLocal.createElement('span', { style: mergeStyle(style), ...strip(props) }, children),
    TouchableOpacity: ({ children, style, onPress, ...props }: any) =>
      ReactLocal.createElement(
        'button',
        { type: 'button', onClick: onPress, style: mergeStyle(style), ...strip(props) },
        children,
      ),
  };
});

jest.mock('@/components/common/SemLogo', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'sem-logo' });
});

import HomeHeader from './HomeHeader';

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

describe('HomeHeader', () => {
  it('renders the SEM logo on the left and the location button on the right', () => {
    const onPressLocation = jest.fn();
    render(
      <HomeHeader
        locationLabel="Beşiktaş, Istanbul"
        onPressLocation={onPressLocation}
      />,
    );

    expect(screen.getByTestId('sem-logo')).toBeTruthy();

    const locationButton = screen.getByRole('button', {
      name: 'Select location',
    });
    expect(locationButton).toBeTruthy();

    fireEvent.click(locationButton);
    expect(onPressLocation).toHaveBeenCalledTimes(1);
  });

  it('renders the location label with bold italic emphasis', () => {
    render(
      <HomeHeader
        locationLabel="Kadikoy, Istanbul"
        onPressLocation={jest.fn()}
      />,
    );

    const label = screen.getByText('Kadikoy, Istanbul');
    expect((label as HTMLElement).style.fontStyle).toBe('italic');
    expect((label as HTMLElement).style.fontWeight).toBe('800');
    expect((label as HTMLElement).style.fontSize).toBe('12px');
  });
});
