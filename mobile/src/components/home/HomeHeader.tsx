import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import SemLogo from '@/components/common/SemLogo';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

interface HomeHeaderProps {
  locationLabel: string;
  onPressLocation?: () => void;
  onPressNotifications?: () => void;
  unreadNotificationCount?: number;
}

const HomeHeader = forwardRef<any, HomeHeaderProps>(function HomeHeader(
  {
    locationLabel,
    onPressLocation,
    onPressNotifications,
    unreadNotificationCount = 0,
  },
  locationButtonRef,
) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <SemLogo height={56} color={theme.text} />
      </View>

      <View style={styles.rightWrap}>
        <TouchableOpacity
          style={styles.bellButton}
          activeOpacity={0.75}
          onPress={onPressNotifications}
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
        >
          <Ionicons name="notifications-outline" size={22} color={theme.text} />
          {unreadNotificationCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadNotificationCount > 99
                  ? '99+'
                  : String(unreadNotificationCount)}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <View ref={locationButtonRef} collapsable={false} style={styles.locationWrap}>
          <TouchableOpacity
            style={styles.locationButton}
            activeOpacity={0.85}
            onPress={onPressLocation}
            accessibilityRole="button"
            accessibilityLabel="Select location"
          >
            <Feather name="map-pin" size={16} color={theme.textOnPrimary} />
            <Text style={styles.locationButtonText} numberOfLines={1}>
              {locationLabel}
            </Text>
            <Feather name="chevron-down" size={16} color={theme.textOnPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

function makeStyles(t: Theme) {
  return StyleSheet.create({
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
    rightWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexShrink: 1,
      minWidth: 0,
    },
    bellButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    badge: {
      position: 'absolute',
      top: 2,
      right: 2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: t.notificationBadge,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '700',
      lineHeight: 12,
    },
    locationWrap: {
      flexShrink: 1,
      minWidth: 0,
      maxWidth: '80%',
      alignItems: 'flex-end',
    },
    locationButton: {
      maxWidth: '100%',
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.primary,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    locationButtonText: {
      color: t.textOnPrimary,
      fontSize: 12,
      fontWeight: '800',
      fontStyle: 'italic',
      marginHorizontal: 8,
      flexShrink: 1,
    },
  });
}

export default HomeHeader;
