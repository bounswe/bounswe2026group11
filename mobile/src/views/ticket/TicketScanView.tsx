import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { useTicketScanViewModel } from '@/viewmodels/ticket/useTicketScanViewModel';
import { formatEventDateLabel } from '@/utils/eventDate';
import { formatEventLocation } from '@/utils/eventLocation';
import {
  formatTicketStatusLabel,
  getTicketScanRejectMessage,
  getTicketStatusBadgeColors,
} from '@/utils/ticketStatus';
import { useTheme, type Theme } from '@/theme';

interface TicketScanViewProps {
  eventId: string;
}

export default function TicketScanView({ eventId }: TicketScanViewProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const vm = useTicketScanViewModel(eventId);
  const [permission, requestPermission] = useCameraPermissions();
  const [isScannerPaused, setIsScannerPaused] = React.useState(false);

  const handleBarCodeScanned = React.useCallback(async ({ data }: { data: string }) => {
    if (vm.isSubmitting || isScannerPaused) return;
    setIsScannerPaused(true);
    await vm.submitToken(data);
    // Camera stays paused until the user explicitly starts another scan.
  }, [isScannerPaused, vm]);

  const handleScanAnother = React.useCallback(() => {
    setIsScannerPaused(false);
    vm.clearResult();
  }, [vm]);

  if (vm.isLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.loadingPanel}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t('tickets.scan.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (vm.errorMessage && !vm.event) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              accessibilityLabel={t('common.back')}
              activeOpacity={0.8}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={26} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('tickets.scan.title')}</Text>
          </View>

          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>{t('tickets.scan.unableToOpen')}</Text>
            <Text style={styles.errorText}>{vm.errorMessage}</Text>
            <TouchableOpacity
              accessibilityLabel={t('common.retry')}
              activeOpacity={0.85}
              onPress={() => void vm.reload()}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // GUARD: Only hosts can see the scanner UI
  if (vm.event && !vm.isHost) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              accessibilityLabel={t('common.back')}
              activeOpacity={0.8}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={26} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('tickets.scan.title')}</Text>
          </View>

          <View style={styles.errorPanel}>
            <Feather name="shield-off" size={48} color={theme.errorText} style={{ marginBottom: 16 }} />
            <Text style={styles.errorTitle}>{t('tickets.scan.accessDenied')}</Text>
            <Text style={styles.errorText}>
              {t('tickets.scan.hostOnly')}
            </Text>
            <TouchableOpacity
              accessibilityLabel={t('common.back')}
              activeOpacity={0.85}
              onPress={() => router.back()}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const event = vm.event;
  const scanStatusColors = vm.scanResult?.ticket_status
    ? getTicketStatusBadgeColors(vm.scanResult.ticket_status)
    : null;
  const cameraPermissionGranted = permission?.granted === true;
  const cameraPermissionDenied = permission?.canAskAgain === false && permission.granted === false;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              accessibilityLabel={t('common.back')}
              activeOpacity={0.8}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={26} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('tickets.scan.title')}</Text>
          </View>

          <View style={styles.heroCard}>
            {event?.image_url ? (
              <Image source={{ uri: event.image_url }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={[styles.heroImage, styles.heroPlaceholder]}>
                <Feather name="camera" size={34} color={theme.textTertiary} />
              </View>
            )}
            <View style={styles.heroBody}>
              <Text style={styles.eventTitle}>{event?.title ?? t('tickets.scan.eventFallback')}</Text>
              {event ? (
                <>
                  <Text style={styles.metaText}>{formatEventDateLabel(event.start_time, event.end_time)}</Text>
                  <Text style={styles.metaText}>{formatEventLocation(event.location.address)}</Text>
                </>
              ) : null}
            </View>
          </View>

          <View style={styles.scanCard}>
            {/* Scan result card (shown prominently at the top) */}
            {vm.scanResult ? (
              <View
                style={[
                  styles.resultCard,
                  vm.scanResult.result === 'ACCEPTED' ? styles.resultAccepted : styles.resultRejected,
                ]}
              >
                <View style={styles.resultHeader}>
                  <Feather
                    name={vm.scanResult.result === 'ACCEPTED' ? 'check-circle' : 'x-circle'}
                    size={28}
                    color={vm.scanResult.result === 'ACCEPTED' ? theme.successText : theme.errorText}
                  />
                  <Text
                    style={[
                      styles.resultTitle,
                      { color: vm.scanResult.result === 'ACCEPTED' ? theme.successText : theme.errorText },
                    ]}
                  >
                    {vm.scanResult.result === 'ACCEPTED'
                      ? t('tickets.scan.accepted')
                      : t('tickets.scan.rejected')}
                  </Text>
                </View>

                <Text style={styles.resultText}>
                  {vm.scanResult.result === 'ACCEPTED'
                    ? t('tickets.scan.acceptedDescription')
                    : getTicketScanRejectMessage(vm.scanResult.reason)}
                </Text>

                {vm.scanResult.ticket_status && scanStatusColors ? (
                  <View style={[styles.statusPill, { backgroundColor: scanStatusColors.backgroundColor }]}>
                    <Text style={[styles.statusPillText, { color: scanStatusColors.textColor }]}>
                      {formatTicketStatusLabel(vm.scanResult.ticket_status)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Error message */}
            {vm.errorMessage ? <Text style={styles.inlineError}>{vm.errorMessage}</Text> : null}

            {/* Scan another ticket button (only when there's a result or error) */}
            {cameraPermissionGranted && (vm.scanResult || vm.errorMessage) ? (
              <TouchableOpacity
                accessibilityLabel={t('tickets.scan.scanAnother')}
                activeOpacity={0.85}
                disabled={vm.isSubmitting}
                onPress={handleScanAnother}
                style={styles.scanAnotherButton}
              >
                <Feather name="refresh-cw" size={18} color={theme.textOnPrimary} />
                <Text style={styles.scanAnotherButtonText}>{t('tickets.scan.scanAnother')}</Text>
              </TouchableOpacity>
            ) : null}

            {/* Camera / permission */}
            {!vm.scanResult && !vm.errorMessage ? (
              cameraPermissionGranted ? (
                <View style={styles.scanFrame}>
                  <CameraView
                    barcodeScannerSettings={{
                      barcodeTypes: ['qr'],
                    }}
                    onBarcodeScanned={isScannerPaused || vm.isSubmitting ? undefined : handleBarCodeScanned}
                    style={styles.cameraView}
                  />
                  {vm.isSubmitting ? (
                    <View style={styles.scanSubmittingOverlay}>
                      <ActivityIndicator size="large" color="#fff" />
                      <Text style={styles.scanSubmittingText}>{t('tickets.scan.validating')}</Text>
                    </View>
                  ) : (
                    <View pointerEvents="none" style={styles.scanOverlay}>
                      <View style={[styles.scanCorner, styles.scanCornerTopLeft]} />
                      <View style={[styles.scanCorner, styles.scanCornerTopRight]} />
                      <View style={[styles.scanCorner, styles.scanCornerBottomLeft]} />
                      <View style={[styles.scanCorner, styles.scanCornerBottomRight]} />
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.scanFrame, styles.scanFrameFallback]}>
                  <Feather name="camera-off" size={48} color={theme.textTertiary} />
                  <Text style={styles.scanFrameFallbackText}>
                    {cameraPermissionDenied
                      ? t('tickets.scan.cameraDenied')
                      : t('tickets.scan.cameraPrompt')}
                  </Text>
                  {permission?.granted === false ? (
                    <TouchableOpacity
                      accessibilityLabel={t('tickets.scan.enableCamera')}
                      activeOpacity={0.85}
                      onPress={() => void requestPermission()}
                      style={styles.permissionButton}
                    >
                      <Text style={styles.permissionButtonText}>
                        {cameraPermissionDenied ? t('tickets.scan.requestAgain') : t('tickets.scan.enableCamera')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )
            ) : null}

            {/* Hint text (only when camera is active) */}
            {!vm.scanResult && !vm.errorMessage ? (
              <Text style={styles.scanHint}>
                {t('tickets.scan.scanHint')}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: t.background,
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
      color: t.text,
    },
    backButton: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceVariant,
    },
    heroCard: {
      overflow: 'hidden',
      borderRadius: 30,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    heroImage: {
      width: '100%',
      aspectRatio: 2.2,
    },
    heroPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceAlt,
    },
    heroBody: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      gap: 8,
    },
    eventTitle: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '800',
      color: t.text,
    },
    metaText: {
      fontSize: 15,
      lineHeight: 22,
      color: t.textSecondary,
    },
    scanCard: {
      marginTop: 22,
      borderRadius: 30,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      padding: 22,
    },
    scanFrame: {
      position: 'relative',
      height: 220,
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: t.surfaceVariant,
    },
    cameraView: {
      flex: 1,
    },
    scanOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanFrameFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      gap: 12,
    },
    scanFrameFallbackText: {
      fontSize: 14,
      lineHeight: 22,
      color: t.textSecondary,
      textAlign: 'center',
    },
    scanCorner: {
      position: 'absolute',
      width: 42,
      height: 42,
      borderColor: t.text,
    },
    scanCornerTopLeft: {
      top: 16,
      left: 16,
      borderTopWidth: 4,
      borderLeftWidth: 4,
      borderTopLeftRadius: 16,
    },
    scanCornerTopRight: {
      top: 16,
      right: 16,
      borderTopWidth: 4,
      borderRightWidth: 4,
      borderTopRightRadius: 16,
    },
    scanCornerBottomLeft: {
      bottom: 16,
      left: 16,
      borderBottomWidth: 4,
      borderLeftWidth: 4,
      borderBottomLeftRadius: 16,
    },
    scanCornerBottomRight: {
      bottom: 16,
      right: 16,
      borderBottomWidth: 4,
      borderRightWidth: 4,
      borderBottomRightRadius: 16,
    },
    scanHint: {
      marginTop: 24,
      fontSize: 16,
      lineHeight: 24,
      color: t.textSecondary,
      textAlign: 'center',
    },
    inlineError: {
      marginTop: 12,
      fontSize: 14,
      lineHeight: 20,
      color: t.errorText,
    },
    primaryButton: {
      marginTop: 20,
      minHeight: 60,
      borderRadius: 22,
      backgroundColor: t.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    primaryButtonDisabled: {
      opacity: 0.72,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '800',
      color: t.textOnPrimary,
    },
    secondaryButton: {
      marginTop: 12,
      minHeight: 48,
      borderRadius: 18,
      backgroundColor: t.surfaceVariant,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    secondaryButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: t.text,
    },
    permissionButton: {
      marginTop: 4,
      borderRadius: 16,
      backgroundColor: t.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    permissionButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: t.textOnPrimary,
    },
    scanAnotherButton: {
      marginTop: 16,
      minHeight: 54,
      borderRadius: 20,
      backgroundColor: t.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    scanAnotherButtonText: {
      fontSize: 16,
      fontWeight: '800',
      color: t.textOnPrimary,
    },
    scanSubmittingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    scanSubmittingText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
    resultCard: {
      borderRadius: 22,
      padding: 18,
    },
    resultAccepted: {
      backgroundColor: t.successBg,
    },
    resultRejected: {
      backgroundColor: t.errorBg,
    },
    resultHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    resultTitle: {
      fontSize: 18,
      fontWeight: '800',
    },
    resultText: {
      marginTop: 10,
      fontSize: 15,
      lineHeight: 22,
      color: t.textSecondary,
    },
    statusPill: {
      alignSelf: 'flex-start',
      marginTop: 12,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    statusPillText: {
      fontSize: 14,
      fontWeight: '700',
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
