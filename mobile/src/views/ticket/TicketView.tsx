import React from 'react';
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
import { useTicketViewModel } from '@/viewmodels/ticket/useTicketViewModel';
import { formatEventDateLabel } from '@/utils/eventDate';
import {
  formatTicketStatusLabel,
  getTicketStatusBadgeColors,
} from '@/utils/ticketStatus';

interface TicketViewProps {
  ticketId: string;
}

export default function TicketView({ ticketId }: TicketViewProps) {
  const vm = useTicketViewModel(ticketId);

  if (vm.isLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.loadingPanel}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={styles.loadingText}>Loading ticket...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (vm.errorMessage || !vm.ticket) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              accessibilityLabel="Go back"
              activeOpacity={0.8}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={26} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Ticket</Text>
          </View>

          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>Unable to load ticket</Text>
            <Text style={styles.errorText}>
              {vm.errorMessage ?? 'Something went wrong while loading this ticket.'}
            </Text>
            <TouchableOpacity
              accessibilityLabel="Try again"
              activeOpacity={0.85}
              onPress={() => void vm.reload()}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const { ticket } = vm;
  const colors = getTicketStatusBadgeColors(ticket.ticket.status);
  const tokenValue = vm.qrToken?.token ?? '';
  const showLiveQr = Boolean(vm.qrToken);
  const lockedMessage = vm.qrMessage ?? 'Allow location access, then refresh to reveal your live rotating ticket QR.';
  const liveCodeMeta = vm.qrToken
    ? `Live code v${vm.qrToken.version} · refreshes about every 10s`
    : null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              accessibilityLabel="Go back"
              activeOpacity={0.8}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={26} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Ticket</Text>
          </View>

          <View style={styles.walletCard}>
            {vm.eventImageUrl ? (
              <Image source={{ uri: vm.eventImageUrl }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={[styles.heroImage, styles.heroPlaceholder]}>
                <Feather name="calendar" size={32} color="#94A3B8" />
              </View>
            )}

            <View style={styles.walletBody}>
              <Text style={styles.eventTitle}>{ticket.event.title}</Text>

              <View style={styles.metaRow}>
                <Feather name="calendar" size={20} color="#6B7280" />
                <Text style={styles.metaText}>
                  {formatEventDateLabel(ticket.event.start_time, ticket.event.end_time)}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Feather name="map-pin" size={20} color="#6B7280" />
                <Text style={styles.metaText}>{ticket.location.address ?? 'Event location'}</Text>
              </View>

              <View style={styles.qrContainer}>
                {showLiveQr ? (
                  <>
                    <DecorativeQrCode
                      value={tokenValue}
                      size={200}
                      color="#111827"
                      backgroundColor="#E5E7EB"
                    />
                    {liveCodeMeta ? (
                      <Text style={styles.liveCodeMeta}>{liveCodeMeta}</Text>
                    ) : null}
                    <Text style={styles.tokenText}>{tokenValue}</Text>
                  </>
                ) : (
                  <View style={styles.qrPlaceholder}>
                    <Feather name="lock" size={34} color="#94A3B8" />
                    <Text style={styles.qrPlaceholderTitle}>Live QR locked</Text>
                    <Text style={styles.qrPlaceholderText}>{lockedMessage}</Text>
                  </View>
                )}
              </View>

              <View style={[styles.statusPill, { backgroundColor: colors.backgroundColor }]}>
                <Feather
                  name={
                    ticket.ticket.status === 'ACTIVE'
                      ? 'check-circle'
                      : ticket.ticket.status === 'CANCELED'
                        ? 'x-circle'
                        : 'clock'
                  }
                  size={18}
                  color={colors.textColor}
                />
                <Text style={[styles.statusPillText, { color: colors.textColor }]}>
                  {formatTicketStatusLabel(ticket.ticket.status)}
                </Text>
              </View>

              {vm.qrMessage ? (
                <Text style={styles.helperText}>{vm.qrMessage}</Text>
              ) : ticket.ticket.status === 'ACTIVE' ? (
                <Text style={styles.helperText}>Show this live ticket at the event entrance.</Text>
              ) : (
                <Text style={styles.helperText}>This ticket remains visible for your event history.</Text>
              )}

              {vm.canRetryQr ? (
                <TouchableOpacity
                  accessibilityLabel="Refresh ticket code"
                  activeOpacity={0.85}
                  disabled={vm.isRefreshingQr}
                  onPress={() => void vm.refreshQr()}
                  style={[styles.refreshButton, vm.isRefreshingQr && styles.refreshButtonDisabled]}
                >
                  {vm.isRefreshingQr ? (
                    <ActivityIndicator size="small" color="#111827" />
                  ) : (
                    <>
                      <Feather name="refresh-cw" size={16} color="#111827" />
                      <Text style={styles.refreshButtonText}>Refresh Code</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 28,
  },
  container: {
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingTop: 12,
    paddingBottom: 18,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  backButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  walletCard: {
    overflow: 'hidden',
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  heroImage: {
    width: '100%',
    aspectRatio: 2.2,
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  walletBody: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 26,
  },
  eventTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  metaRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    color: '#6B7280',
  },
  qrContainer: {
    marginTop: 26,
    width: 236,
    minHeight: 236,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
    padding: 18,
  },
  qrPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  qrPlaceholderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  qrPlaceholderText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  tokenText: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  liveCodeMeta: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  statusPill: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  statusPillText: {
    fontSize: 18,
    fontWeight: '700',
  },
  helperText: {
    marginTop: 24,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 22,
    fontSize: 17,
    lineHeight: 24,
    color: '#6B7280',
    textAlign: 'center',
  },
  refreshButton: {
    marginTop: 18,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  refreshButtonDisabled: {
    opacity: 0.7,
  },
  refreshButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  loadingPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: 16,
    color: '#475569',
  },
  errorPanel: {
    marginTop: 48,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: '#64748B',
  },
  retryButton: {
    marginTop: 20,
    alignSelf: 'flex-start',
    borderRadius: 16,
    backgroundColor: '#111827',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
