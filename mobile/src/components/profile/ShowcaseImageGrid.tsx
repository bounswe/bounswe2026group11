import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Image, TouchableOpacity, Dimensions, Text, Modal, PanResponder, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShowcaseImageItem } from '@/models/profile';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const { width, height } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const GAP = 10;
const ITEM_SIZE = (width - 40 - (COLUMN_COUNT - 1) * GAP) / COLUMN_COUNT;

interface ShowcaseImageGridProps {
  images: ShowcaseImageItem[];
  onDelete?: (id: string) => void;
  isOwner?: boolean;
}

export default function ShowcaseImageGrid({ images, onDelete, isOwner }: ShowcaseImageGridProps) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: width, height: height * 0.8 });

  // Calculate actual image dimensions to avoid the "invisible frame" blocking background taps
  useEffect(() => {
    if (selectedImage) {
      Image.getSize(
        selectedImage,
        (imgWidth, imgHeight) => {
          const imgAspect = imgWidth / imgHeight;
          const maxContainerHeight = height * 0.8;
          const containerAspect = width / maxContainerHeight;

          if (imgAspect > containerAspect) {
            // Image is wider than container ratio
            setImageSize({
              width: width,
              height: width / imgAspect,
            });
          } else {
            // Image is taller than container ratio
            setImageSize({
              width: maxContainerHeight * imgAspect,
              height: maxContainerHeight,
            });
          }
        },
        () => {
          // Fallback if unable to get size
          setImageSize({ width: width, height: height * 0.8 });
        }
      );
    }
  }, [selectedImage]);

  if (images.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyTextWrapper}>
          <Ionicons name="images-outline" size={32} color={theme.textMuted} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyText}>No showcase images uploaded yet.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {images.map((image) => (
        <View key={image.id} style={styles.imageWrapper}>
          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={() => setSelectedImage(image.image_url)}
            style={{ width: '100%', height: '100%' }}
          >
            <Image source={{ uri: image.image_url }} style={styles.image} />
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity 
              style={styles.deleteBadge} 
              onPress={() => onDelete?.(image.id)}
            >
              <View style={styles.deleteBadgeInner}>
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <Modal
        visible={!!selectedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setSelectedImage(null)}
        >
          <TouchableOpacity 
            style={styles.modalCloseButton} 
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close" size={32} color="#FFFFFF" />
          </TouchableOpacity>
          
          {selectedImage && (
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()}
              style={[styles.exactImageContainer, { width: imageSize.width, height: imageSize.height }]}
            >
              <Image 
                source={{ uri: selectedImage }} 
                style={styles.image} 
                resizeMode="contain" 
              />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingVertical: 10,
  },
  imageWrapper: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 12,
    backgroundColor: t.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  deleteBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 5,
  },
  deleteBadgeInner: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    borderStyle: 'dashed',
    width: '100%',
  },
  emptyTextWrapper: {
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: t.textSecondary,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  imageContainer: {
    width: width,
    height: height * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exactImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullImage: {
    width: width,
    height: '100%',
  },
});
