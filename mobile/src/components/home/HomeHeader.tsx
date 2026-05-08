import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import SemLogo from '@/components/common/SemLogo';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

interface HomeHeaderProps {
  /** Whether dark mode is currently active — determines the sun/moon icon. */
  isDark: boolean;
  onPressThemeToggle: () => void;
  onPressNotifications?: () => void;
  unreadNotificationCount?: number;
}

const HomeHeader = forwardRef<any, HomeHeaderProps>(function HomeHeader(
  {
    isDark,
    onPressThemeToggle,
    onPressNotifications,
    unreadNotificationCount = 0,
  },
  _ref,
) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <SemLogo height={52} color={theme.text} />
      </View>

      <View style={styles.rightWrap}>
        {/* Bell */}
        <TouchableOpacity
          style={styles.iconButton}
          activeOpacity={0.75}
          onPress={onPressNotifications}
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
        >
          <Ionicons name="notifications-outline" size={22} color={theme.text} />
          {unreadNotificationCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadNotificationCount > 99 ? '99+' : String(unreadNotificationCount)}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>

        {/* Theme toggle */}
        <TouchableOpacity
          style={styles.iconButton}
          activeOpacity={0.75}
          onPress={onPressThemeToggle}
          accessibilityRole="button"
          accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          testID="theme-toggle"
        >
          <Feather name={isDark ? 'sun' : 'moon'} size={20} color={theme.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      marginTop: 12,
      marginBottom: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    logoWrap: {
      flexShrink: 0,
    },
    rightWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: 4,
      right: 4,
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
  });
}

export default HomeHeader;
