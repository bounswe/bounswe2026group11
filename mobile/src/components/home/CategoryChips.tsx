import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { EventCategory } from '@/models/event';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

interface CategoryChipsProps {
  categories: readonly EventCategory[];
  selectedCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
}

export default function CategoryChips({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryChipsProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <TouchableOpacity
        style={[styles.chip, selectedCategoryId === null && styles.chipSelected]}
        onPress={() => onSelectCategory(null)}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.chipText,
            selectedCategoryId === null && styles.chipTextSelected,
          ]}
          numberOfLines={1}
        >
          All
        </Text>
      </TouchableOpacity>

      {categories.map((category) => {
        const isSelected = selectedCategoryId === category.id;

        return (
          <TouchableOpacity
            key={category.id}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onSelectCategory(category.id)}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.chipText, isSelected && styles.chipTextSelected]}
              numberOfLines={1}
            >
              {category.name}
            </Text>
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
