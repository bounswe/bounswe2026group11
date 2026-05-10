import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import DecorativeQrCode from '@/components/ticket/DecorativeQrCode';
import CircularTimer from '@/components/ticket/CircularTimer';
import { useTicketViewModel } from '@/viewmodels/ticket/useTicketViewModel';
import { formatEventDateLabel } from '@/utils/eventDate';
import {
  getTicketStatusBadgeColors,
} from '@/utils/ticketStatus';
import { useTheme, type Theme } from '@/theme';

interface TicketViewProps {
  ticketId: string;
}

export default function TicketView({ ticketId }: TicketViewProps) {
  const vm = useTicketViewModel(ticketId);
  const { theme, isDark } = useTheme();

  const showLiveQr = vm.ticket?.ticket.status === 'ACTIVE' && !!vm.qrToken;
  const styles = useMemo(() => makeStyles(theme, isDark), [theme, isDark]);

  const isSameDay = useMemo(() => {
    if (!vm.ticket?.event.start_time || !vm.ticket?.event.end_time) return true;
    const start = new Date(vm.ticket.event.start_time);
    const end = new Date(vm.ticket.event.end_time);
    return start.getFullYear() === end.getFullYear() &&
           start.getMonth() === end.getMonth() &&
           start.getDate() === end.getDate();
  }, [vm.ticket?.event.start_time, vm.ticket?.event.end_time]);

  if (vm.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingPanel}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Fetching your pass...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (vm.apiError || !vm.ticket) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Ticket</Text>
          </View>
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>Pass not found</Text>
            <Text style={styles.errorText}>
              {vm.apiError || 'We could not find this ticket in your wallet.'}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={vm.refresh}>
              <Text style={styles.retryButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const { ticket, secondsRemaining } = vm;
  const colors = getTicketStatusBadgeColors(ticket.ticket.status);
  const tokenValue = vm.qrToken?.token ?? '';
  const lockedMessage = vm.qrMessage ?? 'You must be near the event location to show this ticket QR.';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ticket</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <View style={styles.walletCard}>
            {vm.eventImageUrl ? (
              <Image source={{ uri: vm.eventImageUrl }} style={styles.heroImage} />
            ) : (
              <View style={[styles.heroImage, styles.heroPlaceholder]}>
                <Feather name="calendar" size={48} color={theme.textTertiary} />
              </View>
            )}

            <View style={styles.walletBody}>
              <Text style={styles.eventTitle}>
                {ticket.event.title}
              </Text>

              <View style={styles.metaSection}>
                <View style={styles.metaRow}>
                  <Feather name="calendar" size={18} color={theme.textSecondary} />
                  <View style={styles.dateCol}>
                    <Text style={styles.metaText}>
                      {formatEventDateLabel(ticket.event.start_time, isSameDay ? ticket.event.end_time : null)}
                    </Text>
                    {!isSameDay && ticket.event.end_time && (
                      <Text style={styles.metaTextSecondary}>
                        • {formatEventDateLabel(ticket.event.end_time, null)}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Feather name="map-pin" size={18} color={theme.textSecondary} />
                  <Text style={styles.metaText}>
                    {ticket.location.address || ticket.event.address}
                  </Text>
                </View>
              </View>

              <View style={styles.qrArea}>
                {showLiveQr ? (
                  <View style={styles.qrContainer}>
                    <DecorativeQrCode
                      value={tokenValue}
                      size={260}
                      color="#000000"
                      backgroundColor="#FFFFFF"
                    />
                    <View style={styles.timerWrapper}>
                      {secondsRemaining != null && secondsRemaining > 0 ? (
                        <CircularTimer
                          remaining={secondsRemaining}
                          total={10}
                          color="#000000"
                          trackColor="#F1F5F9"
                          textColor="#000000"
                        />
                      ) : (
                        <ActivityIndicator testID="qr-refreshing-indicator" size="small" color="#4B5563" />
                      )}
                    </View>
                  </View>
                ) : ticket.ticket.status === 'USED' ? (
                  <View style={styles.lockedBox}>
                    <Ionicons name="checkmark-circle" size={56} color={theme.successText} />
                    <Text style={styles.lockedTitle}>Ticket used</Text>
                    <Text style={styles.lockedText}>
                      This ticket was successfully validated.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.lockedBox}>
                    <Ionicons name="lock-closed-outline" size={48} color={theme.textTertiary} />
                    <Text style={styles.lockedTitle}>Live QR locked</Text>
                    <Text style={styles.lockedText}>{lockedMessage}</Text>
                  </View>
                )}
              </View>

              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, { backgroundColor: colors.backgroundColor }]}>
                  <Feather
                    name={
                      ticket.ticket.status === 'ACTIVE'
                        ? 'check'
                        : ticket.ticket.status === 'USED'
                          ? 'check'
                          : ticket.ticket.status === 'CANCELED'
                            ? 'x'
                            : 'clock'
                    }
                    size={16}
                    color={colors.textColor}
                  />
                  <Text style={[styles.statusBadgeText, { color: colors.textColor }]}>
                    {ticket.ticket.status === 'ACTIVE'
                      ? 'Valid'
                      : ticket.ticket.status.charAt(0) + ticket.ticket.status.slice(1).toLowerCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {!showLiveQr && (
                <Text style={styles.footerHelper}>
                  {ticket.ticket.status === 'ACTIVE'
                    ? 'You must be near the event location to show this ticket QR.'
                    : 'This ticket is no longer valid for entry.'}
                </Text>
              )}

              {ticket.ticket.status === 'ACTIVE' && (
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={vm.refresh}
                  activeOpacity={0.7}
                >
                  <Feather name="refresh-cw" size={16} color={theme.text} />
                  <Text style={styles.refreshBtnText}>Refresh Code</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme, isDark: boolean) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: t.background,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    container: {
      paddingHorizontal: 20,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: t.text,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceVariant,
    },
    walletCard: {
      overflow: 'hidden',
      borderRadius: 32,
      backgroundColor: t.surface,
      marginTop: 8,
      borderWidth: 1,
      borderColor: t.border,
    },
    heroImage: {
      width: '100%',
      aspectRatio: 2.4,
      backgroundColor: t.surfaceAlt,
    },
    heroPlaceholder: {
      width: '100%',
      aspectRatio: 2.4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceAlt,
    },
    walletBody: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 32,
    },
    eventTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: t.text,
      lineHeight: 32,
    },
    metaSection: {
      marginTop: 20,
      gap: 12,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    metaText: {
      flex: 1,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '600',
      color: t.text,
    },
    metaTextSecondary: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '500',
      color: t.textSecondary,
      marginTop: 2,
    },
    dateCol: {
      flex: 1,
    },
    qrArea: {
      marginTop: 32,
      alignItems: 'center',
    },
    qrContainer: {
      backgroundColor: '#FFFFFF',
      padding: 20,
      borderRadius: 24,
      alignItems: 'center',
    },
    timerWrapper: {
      marginTop: 16,
    },
    lockedBox: {
      width: '100%',
      aspectRatio: 1,
      maxHeight: 280,
      borderRadius: 24,
      backgroundColor: t.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
    },
    lockedTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: t.text,
    },
    lockedText: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
      color: t.textSecondary,
      textAlign: 'center',
    },
    statusRow: {
      marginTop: 24,
      alignItems: 'center',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    statusBadgeText: {
      fontSize: 16,
      fontWeight: '700',
    },
    divider: {
      height: 1,
      backgroundColor: t.border,
      marginVertical: 32,
      width: '100%',
    },
    footerHelper: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '600',
      color: t.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 12,
    },
    refreshBtn: {
      marginTop: 28,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      alignSelf: 'center',
    },
    refreshBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: t.text,
    },
    loadingPanel: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
    },
    loadingText: {
      fontSize: 16,
      color: t.textSecondary,
    },
    errorPanel: {
      marginTop: 48,
      borderRadius: 24,
      backgroundColor: t.surfaceVariant,
      padding: 24,
    },
    errorTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: t.text,
    },
    errorText: {
      marginTop: 12,
      fontSize: 16,
      lineHeight: 24,
      color: t.textSecondary,
    },
    retryButton: {
      marginTop: 20,
      alignSelf: 'flex-start',
      borderRadius: 16,
      backgroundColor: t.primary,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    retryButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: t.textOnPrimary,
    },
  });
}
