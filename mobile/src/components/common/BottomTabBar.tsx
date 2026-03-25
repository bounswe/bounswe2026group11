import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

type TabItem = {
  key: 'explore' | 'favorites' | 'create' | 'events' | 'profile';
  label: string;
  active?: boolean;
  primary?: boolean;
};

const TABS: TabItem[] = [
  { key: 'explore', label: 'Explore', active: true },
  { key: 'favorites', label: 'Favorites' },
  { key: 'create', label: 'Create', primary: true },
  { key: 'events', label: 'Events' },
  { key: 'profile', label: 'Profile' },
];

export default function BottomTabBar() {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        if (tab.primary) {
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.85}
              style={styles.primaryWrapper}
            >
              <View style={styles.primaryButton}>
                <Feather name="plus" size={28} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity key={tab.key} activeOpacity={0.85} style={styles.tab}>
            {tab.key === 'explore' && (
              <Feather
                name="compass"
                size={22}
                color={tab.active ? '#111827' : '#9CA3AF'}
              />
            )}

            {tab.key === 'favorites' && (
              <Ionicons
                name="heart-outline"
                size={22}
                color={tab.active ? '#111827' : '#9CA3AF'}
              />
            )}

            {tab.key === 'events' && (
              <Ionicons
                name="calendar-outline"
                size={22}
                color={tab.active ? '#111827' : '#9CA3AF'}
              />
            )}

            {tab.key === 'profile' && (
              <Ionicons
                name="person-outline"
                size={22}
                color={tab.active ? '#111827' : '#9CA3AF'}
              />
            )}

            <Text style={[styles.label, tab.active && styles.activeText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
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