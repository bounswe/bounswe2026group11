import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

interface SearchSectionProps {
  query: string;
  onChangeQuery: (value: string) => void;
  onSubmitSearch: () => void;
  onPressFilter: () => void;
}

export default function SearchSection({
  query,
  onChangeQuery,
  onSubmitSearch,
  onPressFilter,
}: SearchSectionProps) {
  return (
    <View style={styles.row}>
      <View style={styles.searchContainer}>
        <Feather
          name="search"
          size={20}
          color="#6B7280"
          style={styles.searchIcon}
        />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          onSubmitEditing={onSubmitSearch}
          placeholder="Search title, tags..."
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <TouchableOpacity
        style={styles.filterButton}
        onPress={onPressFilter}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Open filters"
      >
        <Ionicons name="options-outline" size={22} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  searchContainer: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 0,
  },
  filterButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});