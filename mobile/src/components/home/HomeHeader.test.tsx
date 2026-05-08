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
    'testID',
  ]);

  const strip = (props: any) => {
    const out = { ...props };
    if (out.accessibilityLabel) out['aria-label'] = out.accessibilityLabel;
    if (out.accessibilityRole) out['role'] = out.accessibilityRole;
    if (out.testID) out['data-testid'] = out.testID;
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

  const makeIcon = (library: string) =>
    ({ name }: { name: string }) =>
      ReactLocal.createElement('span', {
        'data-icon-library': library,
        'data-icon': name,
      });

  return {
    Feather: makeIcon('feather'),
    Ionicons: makeIcon('ionicons'),
  };
});

const defaultProps = {
  isDark: false,
  onPressThemeToggle: jest.fn(),
};

describe('HomeHeader', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the SEM logo on the left', () => {
    render(<HomeHeader {...defaultProps} />);
    expect(screen.getByTestId('sem-logo')).toBeTruthy();
  });

  it('calls onPressNotifications when the bell button is pressed', () => {
    const onPressNotifications = jest.fn();
    render(
      <HomeHeader
        {...defaultProps}
        onPressNotifications={onPressNotifications}
      />,
    );

    const bellButton = screen.getByRole('button', { name: 'Open notifications' });
    expect(bellButton).toBeTruthy();
    fireEvent.click(bellButton);
    expect(onPressNotifications).toHaveBeenCalledTimes(1);
  });

  it('calls onPressThemeToggle when the theme button is pressed', () => {
    const onPressThemeToggle = jest.fn();
    render(<HomeHeader isDark={false} onPressThemeToggle={onPressThemeToggle} />);

    const themeButton = screen.getByTestId('theme-toggle');
    fireEvent.click(themeButton);
    expect(onPressThemeToggle).toHaveBeenCalledTimes(1);
  });

  it('shows a moon icon in light mode and a sun icon in dark mode', () => {
    const { rerender } = render(<HomeHeader {...defaultProps} isDark={false} />);
    expect(screen.getByTestId('theme-toggle').querySelector('[data-icon="moon"]')).toBeTruthy();

    rerender(<HomeHeader {...defaultProps} isDark={true} />);
    expect(screen.getByTestId('theme-toggle').querySelector('[data-icon="sun"]')).toBeTruthy();
  });

  it('theme toggle is the rightmost header action', () => {
    render(<HomeHeader {...defaultProps} onPressNotifications={jest.fn()} />);
    const buttons = screen.getAllByRole('button');
    const themeToggle = screen.getByTestId('theme-toggle');
    expect(buttons[buttons.length - 1]).toBe(themeToggle);
  });

  it('shows a badge when unreadNotificationCount is greater than zero', () => {
    render(<HomeHeader {...defaultProps} unreadNotificationCount={5} />);
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('caps the badge at 99+', () => {
    render(<HomeHeader {...defaultProps} unreadNotificationCount={150} />);
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('does not show a badge when unreadNotificationCount is zero', () => {
    render(<HomeHeader {...defaultProps} unreadNotificationCount={0} />);
    expect(screen.queryByText('0')).toBeNull();
  });
});
