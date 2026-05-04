import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FavoriteEventsTab from '@/views/favorites/FavoriteEventsTab';
import FavoriteLocationsTab from '@/views/favorites/FavoriteLocationsTab';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type FavoritesTab = 'events' | 'locations';

export default function FavoritesView() {
  const [activeTab, setActiveTab] = useState<FavoritesTab>('events');
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.screenTitle}>Favorites</Text>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'events' && styles.tabActive]}
            onPress={() => setActiveTab('events')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'events' && styles.tabTextActive,
              ]}
            >
              Events
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'locations' && styles.tabActive]}
            onPress={() => setActiveTab('locations')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'locations' && styles.tabTextActive,
              ]}
            >
              Locations
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {activeTab === 'events' ? (
            <FavoriteEventsTab />
          ) : (
            <FavoriteLocationsTab />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: t.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: 20,
    },
    screenTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: t.text,
      paddingTop: 16,
      paddingBottom: 16,
    },
    tabRow: {
      flexDirection: 'row',
      backgroundColor: t.surfaceAlt,
      borderRadius: 12,
      padding: 4,
      marginBottom: 16,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 10,
    },
    tabActive: {
      backgroundColor: t.surface,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    tabText: {
      fontSize: 15,
      fontWeight: '600',
      color: t.textSecondary,
    },
    tabTextActive: {
      color: t.text,
    },
    content: {
      flex: 1,
    },
  });
}
