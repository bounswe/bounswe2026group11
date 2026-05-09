import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getEventCategoryPresentation } from '@/utils/eventCategoryPresentation';
import { useTheme, type Theme } from '@/theme';

interface EventCategoryChipProps {
  categoryName: string;
  testID?: string;
}

export default function EventCategoryChip({
  categoryName,
  testID,
}: EventCategoryChipProps) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const presentation = getEventCategoryPresentation(categoryName, isDark);

  return (
    <View
      style={[styles.chip, { backgroundColor: presentation.color }]}
      testID={testID}
    >
      <Text
        numberOfLines={1}
        style={[styles.text, { color: presentation.textColor }]}
      >
        {presentation.emoji} {presentation.label}
      </Text>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    chip: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      maxWidth: '100%',
      shadowColor: '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    text: {
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
