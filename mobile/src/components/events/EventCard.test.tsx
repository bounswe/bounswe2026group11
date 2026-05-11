/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import type { EventSummary } from '@/models/event';
import EventCard from './EventCard';

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');
  const Icon = ({ name }: { name: string }) =>
    ReactLocal.createElement('span', { 'data-icon': name });

  return {
    Feather: Icon,
    MaterialIcons: Icon,
    MaterialCommunityIcons: Icon,
  };
});

const eventFixture: EventSummary = {
  id: 'event-1',
  title: 'Forest Walk',
  category_name: 'Outdoors',
  image_url: null,
  start_time: '2026-04-09T14:00:00+03:00',
  end_time: null,
  location_address: 'Belgrad Forest, Istanbul',
  privacy_level: 'PUBLIC',
  approved_participant_count: 7,
  capacity: 12,
  is_favorited: false,
  favorite_count: 3,
  host_score: {
    final_score: 4.8,
    hosted_event_rating_count: 16,
  },
};

describe('EventCard', () => {
  it('renders an event summary without crashing', () => {
    render(<EventCard event={eventFixture} onPress={jest.fn()} />);

    expect(screen.getByText('Forest Walk')).toBeTruthy();
    expect(screen.getByText('🌲 Outdoors')).toBeTruthy();
    expect(screen.getByText('Host 4.8 (16)')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Public event/ })).toBeTruthy();
  });
});
