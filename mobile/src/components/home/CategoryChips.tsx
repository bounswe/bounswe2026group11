import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EventCategory } from '@/models/event';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

interface CategoryChipsProps {
  categories: readonly EventCategory[];
  selectedCategoryIds: readonly number[];
  onToggleCategory: (categoryId: number) => void;
  onClearCategories: () => void;
}

export default function CategoryChips({
  categories,
  selectedCategoryIds,
  onToggleCategory,
  onClearCategories,
}: CategoryChipsProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const hasSelection = selectedCategoryIds.length > 0;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <TouchableOpacity
        style={[styles.chip, !hasSelection && styles.chipSelected]}
        onPress={onClearCategories}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Clear selected categories"
        testID="category-chip-clear-all"
      >
        <Text
          style={[
            styles.chipText,
            !hasSelection && styles.chipTextSelected,
          ]}
          numberOfLines={1}
        >
          All
        </Text>
      </TouchableOpacity>

      {categories.map((category) => {
        const isSelected = selectedCategoryIds.includes(category.id);

        return (
          <TouchableOpacity
            key={category.id}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onToggleCategory(category.id)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              isSelected
                ? `Remove ${category.name} category filter`
                : `Add ${category.name} category filter`
            }
            testID={`category-chip-${category.id}`}
          >
            <Text
              style={[styles.chipText, isSelected && styles.chipTextSelected]}
              numberOfLines={1}
            >
              {category.name}
            </Text>
            {isSelected ? (
              <Feather name="x" size={14} color={theme.textOnPrimary} />
            ) : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      paddingBottom: 6,
      paddingRight: 12,
    },
    chip: {
      height: 38,
      paddingHorizontal: 16,
      marginRight: 10,
      borderRadius: 19,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    chipSelected: {
      backgroundColor: t.primary,
      borderColor: t.primary,
    },
    chipText: {
      color: t.text,
      fontSize: 14,
      fontWeight: '600',
    },
    chipTextSelected: {
      color: t.textOnPrimary,
    },
  });
}
