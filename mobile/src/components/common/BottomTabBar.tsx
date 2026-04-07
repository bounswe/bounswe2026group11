import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TAB_META: Record<
  string,
  { label: string; icon: (active: boolean) => React.ReactNode }
> = {
  home: {
    label: 'Explore',
    icon: (active) => (
      <Feather name="compass" size={22} color={active ? '#111827' : '#9CA3AF'} />
    ),
  },
  favorites: {
    label: 'Favorites',
    icon: (active) => (
      <MaterialIcons
        name={active ? 'favorite' : 'favorite-border'}
        size={22}
        color={active ? '#111827' : '#9CA3AF'}
      />
    ),
  },
  events: {
    label: 'My Events',
    icon: (active) => (
      <Feather name="calendar" size={22} color={active ? '#111827' : '#9CA3AF'} />
    ),
  },
  profile: {
    label: 'Profile',
    icon: (active) => (
      <Feather name="user" size={22} color={active ? '#111827' : '#9CA3AF'} />
    ),
  },
};

export default function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const createIndex = 2; // FAB position: after favorites (index 1), before events (index 2)

  const renderTab = (route: (typeof state.routes)[number], index: number) => {
    const meta = TAB_META[route.name];
    if (!meta) return null;

    const active = state.index === index;

    return (
      <TouchableOpacity
        key={route.key}
        activeOpacity={0.85}
        style={styles.tab}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={meta.label}
        onPress={() => {
          if (!active) {
            navigation.navigate(route.name, route.params);
          }
        }}
      >
        {meta.icon(active)}
        <Text style={[styles.label, active && styles.activeText]}>{meta.label}</Text>
      </TouchableOpacity>
    );
  };

  const tabsBefore = state.routes.slice(0, createIndex);
  const tabsAfter = state.routes.slice(createIndex);

  return (
    <View style={styles.container}>
      {tabsBefore.map((route, i) => renderTab(route, i))}

      {/* FAB – Create Event (not a tab, pushes onto root stack) */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.primaryWrapper}
        onPress={() => router.push('/event/create' as Href)}
      >
        <View style={styles.primaryButton}>
          <Feather name="plus" size={28} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {tabsAfter.map((route, i) => renderTab(route, createIndex + i))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 78,
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  tab: {
    minWidth: 62,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  activeText: {
    color: '#111827',
  },
  primaryWrapper: {
    marginTop: -18,
  },
  primaryButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
