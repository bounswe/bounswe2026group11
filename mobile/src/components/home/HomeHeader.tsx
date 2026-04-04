import React, { forwardRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface HomeHeaderProps {
  locationLabel: string;
  onPressLocation?: () => void;
}

const HomeHeader = forwardRef<any, HomeHeaderProps>(function HomeHeader(
  {
    locationLabel,
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
            <Feather name="map-pin" size={16} color="#FFFFFF" />
            <Text style={styles.locationButtonText} numberOfLines={1}>
              {locationLabel}
            </Text>
            <Feather name="chevron-down" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
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
});

export default HomeHeader;
