import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

interface EmptyStateProps {
  title?: string;
  subtitle?: string;
}

export default function EmptyState({
  title,
  subtitle,
}: EmptyStateProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('home.noEvents');
  const resolvedSubtitle = subtitle ?? t('home.noEventsHint');
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🗺️</Text>
      <Text style={styles.title}>{resolvedTitle}</Text>
      <Text style={styles.subtitle}>{resolvedSubtitle}</Text>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      paddingVertical: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emoji: {
      fontSize: 36,
      marginBottom: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: t.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: t.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 24,
    },
  });
}
