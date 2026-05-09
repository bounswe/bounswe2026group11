/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import EventCategoryChip from './EventCategoryChip';

jest.mock('@/theme', () => ({
  useTheme: () => ({
    theme: {
      shadow: '#000000',
    },
    isDark: false,
  }),
}));

describe('EventCategoryChip', () => {
  it('renders the shared category emoji and color presentation', () => {
    render(
      <EventCategoryChip
        categoryName="Outdoors"
        testID="shared-category-chip"
      />,
    );

    const chip = screen.getByTestId('shared-category-chip');

    expect(screen.getByText('🌲 Outdoors')).toBeTruthy();
    expect(chip.getAttribute('style')).toContain(
      'background-color: rgb(5, 150, 105)',
    );
  });
});
