import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

interface SearchSectionProps {
  searchText: string;
  onChangeSearch: (value: string) => void;
  onPressFilter?: () => void;
}

export default function SearchSection({
  searchText,
  onChangeSearch,
  onPressFilter,
}: SearchSectionProps) {
  return (
    <View style={styles.row}>
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#6B7280" style={styles.searchIcon} />
        <TextInput
          value={searchText}
          onChangeText={onChangeSearch}
          placeholder="Search events..."
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
      </View>

      <TouchableOpacity
        style={styles.filterButton}
        onPress={onPressFilter}
        activeOpacity={0.8}
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
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});