/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
