import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { EventCategory } from '@/models/event';

interface CategoryChipsProps {
  categories: readonly EventCategory[];
  selectedCategory: EventCategory;
  onSelectCategory: (category: EventCategory) => void;
}

export default function CategoryChips({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {categories.map((category) => {
        const isSelected = selectedCategory === category;

        return (
          <TouchableOpacity
            key={category}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onSelectCategory(category)}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.chipText, isSelected && styles.chipTextSelected]}
              numberOfLines={1}
            >
              {category}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 6,
    paddingRight: 12,
  },
  chip: {
    height: 38,
    paddingHorizontal: 16,
    marginRight: 10,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  chipText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
});