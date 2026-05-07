/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import ProfileEventCard from './ProfileEventCard';

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');

  return {
    Feather: ({ name }: { name: string }) =>
      ReactLocal.createElement('span', { 'data-icon': name }),
  };
});

describe('ProfileEventCard', () => {
  it('uses the shared category color and emoji presentation', () => {
    render(
      <ProfileEventCard
        title="Forest Walk"
        imageUrl={null}
        categoryLabel="Outdoors"
        startTime="2026-04-09T14:00:00+03:00"
        locationAddress="Belgrad Forest, Istanbul"
        status="ACTIVE"
        privacyLevel="PUBLIC"
        onPress={jest.fn()}
      />,
    );

    const badge = screen.getByTestId('profile-event-category-badge');

    expect(screen.getByText('🌲 Outdoors')).toBeTruthy();
    expect(badge.getAttribute('style')).toContain(
      'background-color: rgb(5, 150, 105)',
    );
  });
});
