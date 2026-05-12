/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FavoritesView from './FavoritesView';

jest.mock('react-native-safe-area-context', () => {
  const ReactLocal = require('react');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      ReactLocal.createElement('div', null, children),
  };
});

jest.mock('@/views/favorites/FavoriteEventsTab', () => {
  const ReactLocal = require('react');
  return {
    __esModule: true,
    default: () => ReactLocal.createElement('div', null, 'favorite events content'),
  };
});

jest.mock('@/views/favorites/FavoriteLocationsTab', () => {
  const ReactLocal = require('react');
  return {
    __esModule: true,
    default: () => ReactLocal.createElement('div', null, 'favorite locations content'),
  };
});

describe('FavoritesView', () => {
  it('renders favorite events by default', () => {
    render(<FavoritesView />);

    expect(screen.getByText('Favorites')).toBeTruthy();
    expect(screen.getByText('favorite events content')).toBeTruthy();
    expect(screen.queryByText('favorite locations content')).toBeNull();
  });

  it('switches between events and locations tabs', () => {
    render(<FavoritesView />);

    fireEvent.click(screen.getByText('Locations'));

    expect(screen.getByText('favorite locations content')).toBeTruthy();
    expect(screen.queryByText('favorite events content')).toBeNull();

    fireEvent.click(screen.getByText('Events'));

    expect(screen.getByText('favorite events content')).toBeTruthy();
    expect(screen.queryByText('favorite locations content')).toBeNull();
  });
});
