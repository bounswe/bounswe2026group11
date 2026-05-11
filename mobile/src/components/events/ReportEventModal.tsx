import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { EventReportCategory } from '@/models/event';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

interface ReportEventModalProps {
  visible: boolean;
  onClose: () => void;
  category: EventReportCategory | null;
  onCategoryChange: (cat: EventReportCategory | null) => void;
  message: string;
  onMessageChange: (text: string) => void;
  onSubmit: () => void;
  loading: boolean;
  imageUri: string | null;
  onPickImage: () => void;
  onRemoveImage: () => void;
  allowImage: boolean;
}

const CATEGORIES: { value: EventReportCategory; labelKey: string }[] = [
  { value: EventReportCategory.SAFETY, labelKey: 'events.report.categories.SAFETY' },
  { value: EventReportCategory.HARASSMENT, labelKey: 'events.report.categories.HARASSMENT' },
  { value: EventReportCategory.SPAM_OR_SCAM, labelKey: 'events.report.categories.SPAM_OR_SCAM' },
  { value: EventReportCategory.INAPPROPRIATE_CONTENT, labelKey: 'events.report.categories.INAPPROPRIATE_CONTENT' },
  { value: EventReportCategory.EVENT_NOT_AS_DESCRIBED, labelKey: 'events.report.categories.EVENT_NOT_AS_DESCRIBED' },
  { value: EventReportCategory.ILLEGAL_OR_DANGEROUS, labelKey: 'events.report.categories.ILLEGAL_OR_DANGEROUS' },
  { value: EventReportCategory.OTHER, labelKey: 'events.report.categories.OTHER' },
];

export default function ReportEventModal({
  visible,
  onClose,
  category,
  onCategoryChange,
  message,
  onMessageChange,
  onSubmit,
  loading,
  imageUri,
  onPickImage,
  onRemoveImage,
  allowImage,
}: ReportEventModalProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(theme, isDark), [theme, isDark]);
  const isSubmitDisabled = !category || !message.trim() || loading;

  const handleCategoryPress = (val: EventReportCategory) => {
    onCategoryChange(val);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t('events.report.title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={24} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.form}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>{t('events.report.reason')}</Text>
            <View style={styles.categories}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryChip,
                    category === cat.value && styles.categoryChipSelected,
                  ]}
                  onPress={() => handleCategoryPress(cat.value)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      category === cat.value && styles.categoryTextSelected,
                    ]}
                  >
                    {t(cat.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t('events.report.description')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('events.report.descriptionPlaceholder')}
              placeholderTextColor={theme.placeholder}
              multiline
              numberOfLines={4}
              value={message}
              onChangeText={onMessageChange}
            />

            {allowImage && (
              <>
                <Text style={styles.label}>{t('events.report.attachEvidence')}</Text>
                {imageUri ? (
                  <View style={styles.imageContainer}>
                    <Image source={{ uri: imageUri }} style={styles.previewImage} />
                    <TouchableOpacity
                      style={styles.removeImageBtn}
                      onPress={onRemoveImage}
                    >
                      <Feather name="x" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.imagePlaceholder}
                    onPress={onPickImage}
                  >
                    <Feather name="camera" size={24} color={theme.textTertiary} />
                    <Text style={styles.imagePlaceholderText}>
                      {t('events.report.addImage')}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.submitBtn, isSubmitDisabled && styles.submitBtnDisabled]}
                onPress={onSubmit}
                disabled={isSubmitDisabled}
              >
                {loading ? (
                  <ActivityIndicator color={theme.textOnPrimary} />
                ) : (
                  <Text style={styles.submitBtnText}>{t('events.report.submit')}</Text>
                )}
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function makeStyles(t: Theme, isDark: boolean) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: t.overlay,
      justifyContent: 'flex-end',
    },
    dismissArea: {
      flex: 1,
    },
    container: {
      backgroundColor: t.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: t.text,
    },
    closeBtn: {
      padding: 4,
    },
    form: {
      padding: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: t.textSecondary,
      marginBottom: 8,
      marginTop: 16,
    },
    categories: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: t.surfaceVariant,
      borderWidth: 1,
      borderColor: t.border,
    },
    categoryChipSelected: {
      backgroundColor: isDark ? t.primary + '33' : '#EEF2FF',
      borderColor: isDark ? t.primary : '#6366F1',
    },
    categoryText: {
      fontSize: 14,
      color: t.textSecondary,
    },
    categoryTextSelected: {
      color: isDark ? t.primary : '#4F46E5',
      fontWeight: '600',
    },
    input: {
      backgroundColor: t.surfaceVariant,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      color: t.text,
      textAlignVertical: 'top',
      minHeight: 100,
    },
    imagePlaceholder: {
      borderWidth: 2,
      borderColor: t.border,
      borderStyle: 'dashed',
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceVariant,
    },
    imagePlaceholderText: {
      marginTop: 8,
      fontSize: 14,
      color: t.textTertiary,
    },
    imageContainer: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    },
    previewImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    removeImageBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footer: {
      marginTop: 24,
    },
    submitBtn: {
      backgroundColor: isDark ? p.red600 : '#EF4444',
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    submitBtnDisabled: {
      backgroundColor: isDark ? p.red900 : '#FCA5A5',
      opacity: 0.6,
    },
    submitBtnText: {
      color: t.textOnPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
  });
}

// Reuse palette for specific colors if needed
const p = {
  red600: '#DC2626',
  red900: '#7F1D1D',
};
