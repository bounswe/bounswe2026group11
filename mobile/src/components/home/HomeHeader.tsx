import React, { forwardRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HomeHeaderProps {
  locationLabel: string;
  notificationCount: number;
  onPressNotifications?: () => void;
  onPressLocation?: () => void;
}

const HomeHeader = forwardRef<any, HomeHeaderProps>(function HomeHeader(
  {
    locationLabel,
    notificationCount,
    onPressNotifications,
    onPressLocation,
  },
  locationButtonRef,
) {
  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <Text style={styles.kicker}>Discover events near</Text>

        <View ref={locationButtonRef} collapsable={false}>
          <TouchableOpacity
            style={styles.locationButton}
            activeOpacity={0.85}
            onPress={onPressLocation}
            accessibilityRole="button"
            accessibilityLabel="Select location"
          >
            <Ionicons name="location-sharp" size={16} color="#FFFFFF" />
            <Text style={styles.locationButtonText} numberOfLines={1}>
              {locationLabel}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
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
});

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftSection: {
    flex: 1,
    marginRight: 12,
  },
  kicker: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  locationButton: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  locationButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
    flexShrink: 1,
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
export default HomeHeader;