import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HomeHeaderProps {
  locationLabel: string;
  notificationCount: number;
  onPressNotifications?: () => void;
}

export default function HomeHeader({
  locationLabel,
  notificationCount,
  onPressNotifications,
}: HomeHeaderProps) {
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.kicker}>Discover events near</Text>
        <Text style={styles.location}>{locationLabel}</Text>
      </View>

      <TouchableOpacity
        style={styles.notificationButton}
        onPress={onPressNotifications}
        activeOpacity={0.8}
      >
        <Ionicons name="notifications-outline" size={22} color="#111827" />
        {notificationCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{notificationCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 0,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  kicker: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 0,
  },
  location: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  notificationButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});