/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CategoryChips from './CategoryChips';
import i18n from '@/i18n';

jest.mock('react-native', () => {
  const ReactLocal = require('react');
  const rnProps = new Set([
    'accessibilityLabel',
    'accessibilityRole',
    'activeOpacity',
    'contentContainerStyle',
    'horizontal',
    'numberOfLines',
    'showsHorizontalScrollIndicator',
    'testID',
  ]);

  const strip = (props: any) => {
    const out = { ...props };
    if (out.accessibilityLabel) out['aria-label'] = out.accessibilityLabel;
    if (out.accessibilityRole) out.role = out.accessibilityRole;
    if (out.testID) out['data-testid'] = out.testID;
    rnProps.forEach((p) => delete out[p]);
    return out;
  };

  const mergeStyle = (style: any) => {
    if (Array.isArray(style)) return Object.assign({}, ...style);
    return style;
  };

  return {
    ScrollView: ({ children, style, contentContainerStyle, ...props }: any) =>
      ReactLocal.createElement(
        'div',
        { style: mergeStyle([style, contentContainerStyle]), ...strip(props) },
        children,
      ),
    StyleSheet: { create: (s: any) => s },
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

jest.mock('@/theme', () => ({
  useTheme: () => ({
    theme: {
      surface: '#FFFFFF',
      border: '#D1D5DB',
      primary: '#6366F1',
      text: '#111827',
      textOnPrimary: '#FFFFFF',
    },
  }),
}));

const categories = [
  { id: 1, name: 'Sports' },
  { id: 2, name: 'Music' },
];

describe('CategoryChips', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders selected category chips with remove affordances', () => {
    const { container } = render(
      <CategoryChips
        categories={categories}
        selectedCategoryIds={[1, 2]}
        onToggleCategory={jest.fn()}
        onClearCategories={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Remove Sports category filter')).toBeTruthy();
    expect(screen.getByLabelText('Remove Music category filter')).toBeTruthy();
    expect(container.querySelectorAll('[data-icon="x"]').length).toBe(2);
  });

  it('toggles categories and clears all selected categories', () => {
    const onToggleCategory = jest.fn();
    const onClearCategories = jest.fn();

    render(
      <CategoryChips
        categories={categories}
        selectedCategoryIds={[1]}
        onToggleCategory={onToggleCategory}
        onClearCategories={onClearCategories}
      />,
    );

    fireEvent.click(screen.getByLabelText('Remove Sports category filter'));
    fireEvent.click(screen.getByLabelText('Add Music category filter'));
    fireEvent.click(screen.getByLabelText('Clear selected categories'));

    expect(onToggleCategory).toHaveBeenNthCalledWith(1, 1);
    expect(onToggleCategory).toHaveBeenNthCalledWith(2, 2);
    expect(onClearCategories).toHaveBeenCalledTimes(1);
  });

  it('localizes quick-select category labels and accessibility labels', async () => {
    await i18n.changeLanguage('tr');

    render(
      <CategoryChips
        categories={categories}
        selectedCategoryIds={[1]}
        onToggleCategory={jest.fn()}
        onClearCategories={jest.fn()}
      />,
    );

    expect(screen.getByText('Tümü')).toBeTruthy();
    expect(screen.getByText('Spor')).toBeTruthy();
    expect(screen.getByText('Müzik')).toBeTruthy();
    expect(screen.getByLabelText('Spor kategori filtresini kaldır')).toBeTruthy();
    expect(screen.getByLabelText('Müzik kategori filtresi ekle')).toBeTruthy();
    expect(screen.getByLabelText('Seçili kategorileri temizle')).toBeTruthy();
  });
});
