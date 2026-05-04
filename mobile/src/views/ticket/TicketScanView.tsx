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
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const vm = useTicketScanViewModel(eventId);
  const [permission, requestPermission] = useCameraPermissions();
  const [isScannerPaused, setIsScannerPaused] = React.useState(false);

  const handleBarCodeScanned = React.useCallback(async ({ data }: { data: string }) => {
    if (vm.isSubmitting || isScannerPaused) return;
    setIsScannerPaused(true);
    await vm.submitToken(data);
  }, [isScannerPaused, vm]);

  React.useEffect(() => {
    if (!vm.isSubmitting) {
      setIsScannerPaused(false);
    }
  }, [vm.isSubmitting]);

  if (vm.isLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.loadingPanel}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading scan tools...</Text>
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
              accessibilityLabel="Go back"
              activeOpacity={0.8}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={26} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scan Ticket</Text>
          </View>

          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>Unable to open scanner</Text>
            <Text style={styles.errorText}>{vm.errorMessage}</Text>
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
              accessibilityLabel="Go back"
              activeOpacity={0.8}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={26} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scan Ticket</Text>
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
              <Text style={styles.eventTitle}>{event?.title ?? 'Event'}</Text>
              {event ? (
                <>
                  <Text style={styles.metaText}>{formatEventDateLabel(event.start_time, event.end_time)}</Text>
                  <Text style={styles.metaText}>{formatEventLocation(event.location.address)}</Text>
                </>
              ) : null}
            </View>
          </View>

          <View style={styles.scanCard}>
            {cameraPermissionGranted ? (
              <View style={styles.scanFrame}>
                <CameraView
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                  }}
                  onBarcodeScanned={isScannerPaused || vm.isSubmitting ? undefined : handleBarCodeScanned}
                  style={styles.cameraView}
                />
                <View pointerEvents="none" style={styles.scanOverlay}>
                  <View style={[styles.scanCorner, styles.scanCornerTopLeft]} />
                  <View style={[styles.scanCorner, styles.scanCornerTopRight]} />
                  <View style={[styles.scanCorner, styles.scanCornerBottomLeft]} />
                  <View style={[styles.scanCorner, styles.scanCornerBottomRight]} />
                </View>
              </View>
            ) : (
              <View style={[styles.scanFrame, styles.scanFrameFallback]}>
                <Feather name="camera-off" size={48} color={theme.textTertiary} />
                <Text style={styles.scanFrameFallbackText}>
                  {cameraPermissionDenied
                    ? 'Camera access is denied. You can still validate by pasting the QR token below.'
                    : 'Camera access lets hosts scan tickets instantly.'}
                </Text>
                {permission?.granted === false ? (
                  <TouchableOpacity
                    accessibilityLabel="Enable camera access"
                    activeOpacity={0.85}
                    onPress={() => void requestPermission()}
                    style={styles.permissionButton}
                  >
                    <Text style={styles.permissionButtonText}>
                      {cameraPermissionDenied ? 'Request Again' : 'Enable Camera'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            <Text style={styles.scanHint}>
              Scan the attendee QR code with your camera, or paste the token below if manual validation is needed.
            </Text>

            <TextInput
              accessibilityLabel="QR token input"
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              onChangeText={vm.setQrToken}
              placeholder="Enter QR token"
              placeholderTextColor={theme.placeholder}
              style={styles.tokenInput}
              value={vm.qrToken}
            />

            {vm.errorMessage ? <Text style={styles.inlineError}>{vm.errorMessage}</Text> : null}

            <TouchableOpacity
              accessibilityLabel="Validate ticket"
              activeOpacity={0.9}
              disabled={vm.isSubmitting}
              onPress={() => void vm.submit()}
              style={[styles.primaryButton, vm.isSubmitting && styles.primaryButtonDisabled]}
            >
              {vm.isSubmitting ? (
                <ActivityIndicator size="small" color={theme.textOnPrimary} />
              ) : (
                <>
                  <Feather name="check-circle" size={18} color={theme.textOnPrimary} />
                  <Text style={styles.primaryButtonText}>Validate Ticket</Text>
                </>
              )}
            </TouchableOpacity>

            {cameraPermissionGranted ? (
              <TouchableOpacity
                accessibilityLabel="Scan another ticket"
                activeOpacity={0.85}
                disabled={vm.isSubmitting}
                onPress={() => {
                  setIsScannerPaused(false);
                  vm.setQrToken('');
                }}
                style={styles.secondaryButton}
              >
                <Feather name="camera" size={16} color={theme.text} />
                <Text style={styles.secondaryButtonText}>Scan Another Ticket</Text>
              </TouchableOpacity>
            ) : null}

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
                    size={20}
                    color={vm.scanResult.result === 'ACCEPTED' ? theme.successText : theme.errorText}
                  />
                  <Text
                    style={[
                      styles.resultTitle,
                      { color: vm.scanResult.result === 'ACCEPTED' ? theme.successText : theme.errorText },
                    ]}
                  >
                    {vm.scanResult.result === 'ACCEPTED' ? 'Ticket accepted' : 'Ticket rejected'}
                  </Text>
                </View>

                <Text style={styles.resultText}>
                  {vm.scanResult.result === 'ACCEPTED'
                    ? 'The attendee can enter the event.'
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
      marginTop: 18,
      fontSize: 15,
      lineHeight: 24,
      color: t.textSecondary,
      textAlign: 'center',
    },
    tokenInput: {
      minHeight: 120,
      marginTop: 20,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.borderStrong,
      backgroundColor: t.surfaceVariant,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      lineHeight: 22,
      color: t.text,
      textAlignVertical: 'top',
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
    resultCard: {
      marginTop: 20,
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
