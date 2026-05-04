import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/theme';

/**
 * Synchronizes system UI (Status Bar & Navigation Bar) colors with the current theme.
 */
export function SystemUIHandler() {
  const { theme, isDark } = useTheme();

  useEffect(() => {
    if (Platform.OS === 'android') {
      // In edge-to-edge mode (default in newer Expo), we only need to set the button style.
      // Background is handled by the app's root views/SafeAreaView.
      try {
        if (NavigationBar && typeof NavigationBar.setButtonStyleAsync === 'function') {
          void NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
        }
      } catch (error) {
        // Non-fatal
      }
    }
  }, [isDark]);

  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
