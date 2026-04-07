import React, { forwardRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import SemLogo from '@/components/common/SemLogo';

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
      <View style={styles.logoWrap}>
        <SemLogo height={56} color="#111827" />
      </View>

      <View ref={locationButtonRef} collapsable={false} style={styles.locationWrap}>
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
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoWrap: {
    flexShrink: 0,
    marginRight: 8,
  },
  locationWrap: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '58%',
    alignItems: 'flex-end',
  },
  locationButton: {
    maxWidth: '100%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  locationButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    fontStyle: 'italic',
    marginHorizontal: 8,
    flexShrink: 1,
  },
});

export default HomeHeader;
