import React, { useMemo } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

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
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      <View style={styles.searchContainer}>
        <Feather
          name="search"
          size={20}
          color={theme.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          onSubmitEditing={onSubmitSearch}
          placeholder="Search title, tags..."
          placeholderTextColor={theme.placeholder}
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
        <Feather name="sliders" size={22} color={theme.textOnPrimary} />
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    searchContainer: {
      flex: 1,
      height: 56,
      borderRadius: 18,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
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
      color: t.text,
      paddingVertical: 0,
    },
    filterButton: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: t.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
