import { useEffect, useRef, useState } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type PointerEvent,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SpecialMessageView } from '@/components/special-message-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, colors, Spacing } from '@/constants/theme';
import {
  getGroups,
  getMembers,
  savePhotocardFromImage,
  type PhotocardCatalogInput,
} from '@/database';
import type { GroupCategory, MemberCategory } from '@/domain/category';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLanguage } from '@/i18n/language-context';
import { getSpecialMessage } from '@/special-messages';

type RegisterError =
  | 'cameraPermission'
  | 'selectionError'
  | 'saveError'
  | 'imageEditError'
  | 'imageRequired'
  | 'categoryLoadError';
type RegistrationStep = 'capture' | 'preview' | 'crop' | 'catalog' | 'firstPiece';
type CatalogFormState = Omit<PhotocardCatalogInput, 'group' | 'member' | 'customCategories'> & {
  customCategoriesText: string;
};
type CropRect = { x: number; y: number; width: number; height: number };
type CategoryOption = { id: string; name: string };

const EMPTY_CATALOG: CatalogFormState = {
  album: '',
  version: '',
  era: '',
  itemEvent: '',
  acquisitionEvent: '',
  customCategoriesText: '',
  favorite: false,
  wanted: false,
  rating: 0,
  notes: '',
};

function CategorySelector<T extends CategoryOption>({
  label,
  value,
  placeholder,
  emptyMessage,
  options,
  expanded,
  disabled,
  onToggle,
  onSelect,
}: {
  label: string;
  value: string;
  placeholder: string;
  emptyMessage: string;
  options: T[];
  expanded: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onSelect: (option: T) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded, disabled }}
        disabled={disabled}
        onPress={onToggle}
        style={[styles.selectorButton, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={!value ? { color: theme.textSecondary } : undefined}>
          {value || placeholder}
        </ThemedText>
        <ThemedText>{expanded ? '⌃' : '⌄'}</ThemedText>
      </Pressable>
      {expanded && (
        <View style={[styles.selectorOptions, { backgroundColor: theme.backgroundElement }]}>
          {options.length === 0 ? (
            <ThemedText style={styles.selectorEmpty}>{emptyMessage}</ThemedText>
          ) : (
            options.map((option) => (
              <Pressable
                accessibilityRole="button"
                key={option.id}
                onPress={() => onSelect(option)}
                style={styles.selectorOption}>
                <ThemedText>{option.name}</ThemedText>
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}

function CatalogField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { backgroundColor: theme.backgroundElement, color: theme.text },
          multiline && styles.multilineInput,
        ]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
    </View>
  );
}

function CropEditor({
  image,
  instruction,
  applyLabel,
  cancelLabel,
  isBusy,
  onApply,
  onCancel,
}: {
  image: ImagePicker.ImagePickerAsset;
  instruction: string;
  applyLabel: string;
  cancelLabel: string;
  isBusy: boolean;
  onApply: (rect: CropRect, displayWidth: number, displayHeight: number) => void;
  onCancel: () => void;
}) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const imageRatio = image.width / image.height;
  const maxWidth = Math.max(160, Math.min(windowWidth - Spacing.five, 360));
  const maxHeight = Math.max(160, Math.min(windowHeight * 0.42, 400));
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const displayWidth = image.width * scale;
  const displayHeight = image.height * scale;
  const [crop, setCrop] = useState<CropRect>(() => ({
    x: displayWidth * 0.1,
    y: displayHeight * 0.1,
    width: displayWidth * 0.8,
    height: displayHeight * 0.8,
  }));
  const cropRef = useRef(crop);
  const startingCrop = useRef(crop);
  const interaction = useRef<'move' | 'resize' | null>(null);
  const startingPoint = useRef({ x: 0, y: 0 });

  const updateCrop = (nextCrop: CropRect) => {
    cropRef.current = nextCrop;
    setCrop(nextCrop);
  };

  const startInteraction = (mode: 'move' | 'resize', event: PointerEvent) => {
    event.stopPropagation();
    interaction.current = mode;
    startingCrop.current = cropRef.current;
    startingPoint.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };
  };
  const moveInteraction = (event: PointerEvent) => {
    if (!interaction.current) {
      return;
    }

    const start = startingCrop.current;
    const deltaX = event.nativeEvent.pageX - startingPoint.current.x;
    const deltaY = event.nativeEvent.pageY - startingPoint.current.y;
    if (interaction.current === 'move') {
      updateCrop({
        ...start,
        x: Math.max(0, Math.min(displayWidth - start.width, start.x + deltaX)),
        y: Math.max(0, Math.min(displayHeight - start.height, start.y + deltaY)),
      });
      return;
    }

    const minSize = Math.min(displayWidth, displayHeight) * 0.2;
    updateCrop({
      ...start,
      width: Math.max(minSize, Math.min(displayWidth - start.x, start.width + deltaX)),
      height: Math.max(minSize, Math.min(displayHeight - start.y, start.height + deltaY)),
    });
  };

  if (!Number.isFinite(imageRatio) || imageRatio <= 0) {
    throw new Error('Cannot create a crop editor for an image with invalid dimensions.');
  }

  return (
    <View
      onPointerMove={moveInteraction}
      onPointerUp={() => {
        interaction.current = null;
      }}
      onPointerCancel={() => {
        interaction.current = null;
      }}
      style={styles.cropContent}>
    <ThemedText style={styles.cropInstruction}>{instruction}</ThemedText>
    <View style={[styles.cropCanvas, { width: displayWidth, height: displayHeight }]}>
        <Image
          source={{ uri: image.uri }}
          resizeMode="stretch"
          style={[StyleSheet.absoluteFill, { width: displayWidth, height: displayHeight }]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.cropShade,
            { left: 0, top: 0, width: displayWidth, height: crop.y },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.cropShade,
            { left: 0, top: crop.y, width: crop.x, height: crop.height },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.cropShade,
            {
              left: crop.x + crop.width,
              top: crop.y,
              width: displayWidth - crop.x - crop.width,
              height: crop.height,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.cropShade,
            {
              left: 0,
              top: crop.y + crop.height,
              width: displayWidth,
              height: displayHeight - crop.y - crop.height,
            },
          ]}
        />
        <View
          onPointerDown={(event) => startInteraction('move', event)}
          style={[
            styles.cropWindow,
            { left: crop.x, top: crop.y, width: crop.width, height: crop.height },
          ]}>
          <View
            onPointerDown={(event) => startInteraction('resize', event)}
            style={styles.cropResizeHandle}
          />
        </View>
      </View>
      <View style={styles.actions}>
        <ActionButton
          backgroundColor={colors.green.medium}
          disabled={isBusy}
          label={applyLabel}
          onPress={() => onApply(crop, displayWidth, displayHeight)}
          loading={isBusy}
        />
        <ActionButton
          backgroundColor={colors.yellow.light}
          disabled={isBusy}
          label={cancelLabel}
          onPress={onCancel}
        />
      </View>
    </View>
  );
}

export default function RegisterScreen() {
  const db = useSQLiteContext();
  const { language, t } = useLanguage();
  const isDarkTheme = useColorScheme() === 'dark';
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [savedImageUri, setSavedImageUri] = useState<string | null>(null);
  const [step, setStep] = useState<RegistrationStep>('capture');
  const [catalog, setCatalog] = useState<CatalogFormState>(EMPTY_CATALOG);
  const [groups, setGroups] = useState<GroupCategory[]>([]);
  const [members, setMembers] = useState<MemberCategory[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupCategory | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberCategory | null>(null);
  const [openSelector, setOpenSelector] = useState<'group' | 'member' | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<RegisterError | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    },
    []
  );

  const selectImage = async (source: 'camera' | 'gallery') => {
    setError(null);
    setIsBusy(true);

    try {
      if (source === 'camera' && Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('cameraPermission');
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.8,
              base64: Platform.OS === 'web',
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
              base64: Platform.OS === 'web',
            });

      if (!result.canceled) {
        const asset = result.assets[0];
        setSelectedImage(
          Platform.OS === 'web' && asset.base64
            ? {
                ...asset,
                uri: `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`,
              }
            : asset
        );
        setStep('preview');
      }
    } catch (selectionError) {
      console.error(`Unable to select an image from the ${source}.`, selectionError);
      setError('selectionError');
    } finally {
      setIsBusy(false);
    }
  };

  const showSavedToast = () => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    setToast(t.register.saveConfirmation);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const rotateSelectedImage = async () => {
    if (!selectedImage) {
      return;
    }

    setError(null);
    setIsBusy(true);
    try {
      const context = ImageManipulator.ImageManipulator.manipulate(selectedImage.uri);
      context.rotate(90);
      const rendered = await context.renderAsync();
      const result = await rendered.saveAsync({
        format: ImageManipulator.SaveFormat.JPEG,
        compress: 0.92,
      });
      setSelectedImage((current) =>
        current ? { ...current, uri: result.uri, width: result.width, height: result.height } : current
      );
    } catch (editError) {
      console.error('Unable to rotate the selected photocard.', editError);
      setError('imageEditError');
    } finally {
      setIsBusy(false);
    }
  };

  const applyCrop = async (crop: CropRect, displayWidth: number, displayHeight: number) => {
    if (!selectedImage) {
      return;
    }

    setError(null);
    setIsBusy(true);
    try {
      const scaleX = selectedImage.width / displayWidth;
      const scaleY = selectedImage.height / displayHeight;
      const originX = Math.max(0, Math.floor(crop.x * scaleX));
      const originY = Math.max(0, Math.floor(crop.y * scaleY));
      const width = Math.min(selectedImage.width - originX, Math.floor(crop.width * scaleX));
      const height = Math.min(selectedImage.height - originY, Math.floor(crop.height * scaleY));
      const context = ImageManipulator.ImageManipulator.manipulate(selectedImage.uri);
      context.crop({ originX, originY, width, height });
      const rendered = await context.renderAsync();
      const result = await rendered.saveAsync({
        format: ImageManipulator.SaveFormat.JPEG,
        compress: 0.92,
      });
      setSelectedImage((current) =>
        current ? { ...current, uri: result.uri, width: result.width, height: result.height } : current
      );
      setStep('preview');
    } catch (editError) {
      console.error('Unable to crop the selected photocard.', editError);
      setError('imageEditError');
    } finally {
      setIsBusy(false);
    }
  };

  const resetToCapture = () => {
    setSelectedImage(null);
    setSavedImageUri(null);
    setCatalog(EMPTY_CATALOG);
    setSelectedGroup(null);
    setSelectedMember(null);
    setOpenSelector(null);
    setError(null);
    setToast(null);
    setStep('capture');
  };

  const saveSelectedImage = async (catalogInput: PhotocardCatalogInput | null) => {
    if (!selectedImage) {
      setError('imageRequired');
      return;
    }

    setError(null);
    setIsBusy(true);
    let storedImage: File | null = null;

    try {
      let imageUri = selectedImage.uri;
      if (Platform.OS !== 'web') {
        const imageDirectory = new Directory(Paths.document, 'photocards');
        imageDirectory.create({ idempotent: true, intermediates: true });

        const extensionByMimeType: Record<string, string> = {
          'image/gif': 'gif',
          'image/heic': 'heic',
          'image/heif': 'heif',
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp',
        };
        const extension = extensionByMimeType[selectedImage.mimeType ?? 'image/jpeg'] ?? 'jpg';
        storedImage = new File(
          imageDirectory,
          `photocard-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.${extension}`
        );
        await new File(selectedImage.uri).copy(storedImage);
        imageUri = storedImage.uri;
      }

      const shouldShowFirstPiece = await savePhotocardFromImage(db, imageUri, catalogInput);
      if (shouldShowFirstPiece) {
        setSavedImageUri(imageUri);
        setStep('firstPiece');
        return;
      }

      resetToCapture();
      showSavedToast();
    } catch (saveError) {
      if (storedImage?.exists) {
        try {
          storedImage.delete();
        } catch (cleanupError) {
          console.error('Unable to remove the unused photocard image.', cleanupError);
        }
      }
      console.error('Unable to save the photocard.', saveError);
      setError('saveError');
    } finally {
      setIsBusy(false);
    }
  };

  const updateCatalog = <K extends keyof CatalogFormState>(
    key: K,
    value: CatalogFormState[K]
  ) => {
    setCatalog((current) => ({ ...current, [key]: value }));
  };

  const openCatalogForm = async () => {
    setError(null);
    setIsBusy(true);
    try {
      const [registeredGroups, registeredMembers] = await Promise.all([
        getGroups(db),
        getMembers(db),
      ]);
      setGroups(registeredGroups);
      setMembers(registeredMembers);
      setSelectedGroup(null);
      setSelectedMember(null);
      setOpenSelector(null);
      setStep('catalog');
    } catch (categoryError) {
      console.error('Unable to load group and member categories for cataloging.', categoryError);
      setError('categoryLoadError');
    } finally {
      setIsBusy(false);
    }
  };

  const saveCatalog = () => {
    const catalogInput: PhotocardCatalogInput = {
      group: selectedGroup ? { id: selectedGroup.id, value: selectedGroup.name } : null,
      member: selectedMember ? { id: selectedMember.id, value: selectedMember.name } : null,
      album: catalog.album,
      version: catalog.version,
      era: catalog.era,
      itemEvent: catalog.itemEvent,
      acquisitionEvent: catalog.acquisitionEvent,
      customCategories: catalog.customCategoriesText
        .split(/[,\n]/)
        .map((category) => category.trim())
        .filter(Boolean),
      favorite: catalog.favorite,
      wanted: catalog.wanted,
      rating: catalog.rating,
      notes: catalog.notes,
    };

    void saveSelectedImage(catalogInput);
  };

  const memberOptions = selectedGroup
    ? members.filter((member) => member.groupId === selectedGroup.id)
    : [];

  if (step === 'firstPiece' && savedImageUri) {
    return (
      <ThemedView style={styles.container}>
        <SpecialMessageView
          imageUri={savedImageUri}
          message={getSpecialMessage('firstCollectionItem', language)}
          onDismiss={resetToCapture}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {toast && (
        <View
          pointerEvents="none"
          style={[styles.toast, { top: insets.top + Spacing.two }]}>
          <ThemedText style={styles.toastText}>{toast}</ThemedText>
        </View>
      )}

      {step === 'capture' && (
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">{t.register.title}</ThemedText>
          <ThemedText type="subtitle">{t.register.greeting}</ThemedText>
          <ThemedText style={styles.centeredText}>{t.register.chooseImage}</ThemedText>

          <View style={styles.actions}>
            <ActionButton
              backgroundColor={colors.turquoise.light}
              textColor={colors.turquoise.dark}
              disabled={isBusy}
              label={t.register.takePhoto}
              onPress={() => void selectImage('camera')}
            />
            <ActionButton
              backgroundColor={colors.pink.light}
              textColor={colors.pink.dark}
              disabled={isBusy}
              label={t.register.chooseFromGallery}
              onPress={() => void selectImage('gallery')}
            />
          </View>
          {isBusy && <ActivityIndicator color={colors.turquoise.dark} />}
          {error && <ThemedText style={styles.error}>{t.register[error]}</ThemedText>}
        </ScrollView>
      )}

      {step === 'preview' && selectedImage && (
        <ScrollView contentContainerStyle={styles.previewContent}>
          <ThemedText style={styles.previewTitle}>{t.register.title}</ThemedText>
          <View style={styles.imageTools}>
            <View style={styles.cropTool}>
              <PreviewActionButton
                backgroundColor={colors.pink.medium}
                foregroundColor={isDarkTheme ? colors.pink.dark : colors.pink.light}
                icon={{ ios: 'crop', android: 'crop', web: 'crop' }}
                disabled={isBusy}
                label={t.register.cropImage}
                onPress={() => {
                  setError(null);
                  setStep('crop');
                }}
                prominent
              />
            </View>
            <View style={styles.imageTool}>
              <PreviewActionButton
                backgroundColor={colors.violet.medium}
                foregroundColor={isDarkTheme ? colors.violet.dark : colors.violet.light}
                icon={{ ios: 'rotate.right', android: 'rotate_right', web: 'rotate_right' }}
                disabled={isBusy}
                label={t.register.rotateImage}
                loading={isBusy}
                onPress={() => void rotateSelectedImage()}
              />
            </View>
          </View>
          <Image
            source={{ uri: selectedImage.uri }}
            accessibilityLabel={t.register.preview}
            resizeMode="contain"
            style={[styles.preview, { height: Math.max(280, Math.min(560, windowHeight - 260)) }]}
          />
          <View style={styles.previewActions}>
            <View style={styles.positiveActionGroup}>
              <PreviewActionButton
                backgroundColor={colors.green.medium}
                foregroundColor={isDarkTheme ? colors.green.dark : colors.green.light}
                icon={{ ios: 'square.and.arrow.down.fill', android: 'save', web: 'save' }}
                disabled={isBusy}
                label={t.register.saveQuick}
                loading={isBusy}
                onPress={() => void saveSelectedImage(null)}
                prominent
              />
              <PreviewActionButton
                backgroundColor={colors.turquoise.medium}
                foregroundColor={isDarkTheme ? colors.turquoise.dark : colors.turquoise.light}
                icon={{ ios: 'square.and.pencil', android: 'edit', web: 'edit' }}
                disabled={isBusy}
                label={t.register.editPhotocard}
                onPress={() => void openCatalogForm()}
              />
            </View>
            <View style={styles.discardAction}>
              <PreviewActionButton
                backgroundColor={colors.orange.medium}
                foregroundColor={isDarkTheme ? colors.orange.dark : colors.orange.light}
                icon={{ ios: 'trash', android: 'delete', web: 'delete' }}
                disabled={isBusy}
                label={t.register.discardPhotocard}
                onPress={resetToCapture}
                compact
              />
            </View>
          </View>
          {error && <ThemedText style={styles.error}>{t.register[error]}</ThemedText>}
        </ScrollView>
      )}

      {step === 'crop' && selectedImage && (
        <ScrollView contentContainerStyle={styles.content}>
          <CropEditor
            image={selectedImage}
            instruction={t.register.cropInstruction}
            applyLabel={t.register.applyCrop}
            cancelLabel={t.register.cancelCrop}
            isBusy={isBusy}
            onApply={(crop, displayWidth, displayHeight) =>
              void applyCrop(crop, displayWidth, displayHeight)
            }
            onCancel={() => {
              setError(null);
              setStep('preview');
            }}
          />
          {error && <ThemedText style={styles.error}>{t.register[error]}</ThemedText>}
        </ScrollView>
      )}

      {step === 'catalog' && selectedImage && (
        <ScrollView
          contentContainerStyle={[
            styles.catalogContent,
            Platform.OS === 'web' && {
              paddingBottom:
                Math.max(BottomTabInset, 56 + insets.bottom) + Spacing.four,
            },
          ]}>
          <ThemedText type="subtitle">{t.register.catalogTitle}</ThemedText>
          <ThemedText style={styles.centeredText}>{t.register.catalogIntro}</ThemedText>
          <Image
            source={{ uri: selectedImage.uri }}
            accessibilityLabel={t.register.preview}
            resizeMode="contain"
            style={styles.catalogPreview}
          />

          <View style={styles.form}>
            <CategorySelector<GroupCategory>
              label={t.register.group}
              value={selectedGroup?.name ?? ''}
              placeholder={t.register.selectGroup}
              emptyMessage={t.register.noGroupsAvailable}
              options={groups}
              expanded={openSelector === 'group'}
              onToggle={() => setOpenSelector(openSelector === 'group' ? null : 'group')}
              onSelect={(group) => {
                setSelectedGroup(group);
                setSelectedMember(null);
                setOpenSelector(null);
              }}
            />
            <CategorySelector<MemberCategory>
              label={t.register.member}
              value={selectedMember?.name ?? ''}
              placeholder={t.register.selectMember}
              emptyMessage={
                selectedGroup ? t.register.noMembersAvailable : t.register.selectGroup
              }
              options={memberOptions}
              expanded={openSelector === 'member'}
              disabled={!selectedGroup}
              onToggle={() => setOpenSelector(openSelector === 'member' ? null : 'member')}
              onSelect={(member) => {
                setSelectedMember(member);
                setOpenSelector(null);
              }}
            />
            <CatalogField
              label={t.register.album}
              value={catalog.album}
              onChangeText={(value) => updateCatalog('album', value)}
            />
            <CatalogField
              label={t.register.version}
              value={catalog.version}
              onChangeText={(value) => updateCatalog('version', value)}
            />
            <CatalogField
              label={t.register.era}
              value={catalog.era}
              onChangeText={(value) => updateCatalog('era', value)}
            />
            <CatalogField
              label={t.register.itemEvent}
              value={catalog.itemEvent}
              onChangeText={(value) => updateCatalog('itemEvent', value)}
            />
            <CatalogField
              label={t.register.acquisitionEvent}
              value={catalog.acquisitionEvent}
              onChangeText={(value) => updateCatalog('acquisitionEvent', value)}
            />
            <CatalogField
              label={t.register.customCategories}
              value={catalog.customCategoriesText}
              onChangeText={(value) => updateCatalog('customCategoriesText', value)}
              placeholder={t.register.customCategoriesPlaceholder}
            />

            <PreferenceToggle
              label={t.register.favorite}
              colorFamily={colors.orange}
              activeSymbol="★"
              inactiveSymbol="☆"
              value={catalog.favorite}
              onChange={(value) => updateCatalog('favorite', value)}
            />
            <PreferenceToggle
              label={t.register.wanted}
              colorFamily={colors.pink}
              activeSymbol="♥"
              inactiveSymbol="♡"
              value={catalog.wanted}
              onChange={(value) => updateCatalog('wanted', value)}
            />

            <View style={styles.field}>
              <ThemedText type="smallBold">{t.register.rating}</ThemedText>
              <View style={styles.ratingChoices}>
                {([1, 2, 3, 4, 5] as const).map((rating) => (
                  <Pressable
                    accessibilityLabel={`${t.register.rating}: ${rating} of 5`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: catalog.rating >= rating }}
                    key={rating}
                    onPress={() =>
                      updateCatalog('rating', catalog.rating === rating ? 0 : rating)
                    }
                    style={styles.ratingChoice}>
                    <ThemedText
                      style={[
                        styles.ratingStar,
                        { color: colors.yellow.medium },
                      ]}>
                      {catalog.rating >= rating ? '★' : '☆'}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <CatalogField
              label={t.register.notes}
              value={catalog.notes}
              onChangeText={(value) => updateCatalog('notes', value)}
              placeholder={t.register.notesPlaceholder}
              multiline
            />
          </View>

          {error && <ThemedText style={styles.error}>{t.register[error]}</ThemedText>}
          <View style={styles.actions}>
            <ActionButton
              backgroundColor={colors.green.medium}
              textColor={isDarkTheme ? colors.green.dark : colors.green.light}
              disabled={isBusy}
              label={t.register.saveCatalogued}
              loading={isBusy}
              onPress={saveCatalog}
            />
            <ActionButton
              backgroundColor={colors.yellow.light}
              textColor={colors.yellow.dark}
              disabled={isBusy}
              label={t.register.cancelEditing}
              onPress={() => {
                setError(null);
                setStep('preview');
              }}
            />
          </View>
        </ScrollView>
      )}
    </ThemedView>
  );
}

function ActionButton({
  backgroundColor,
  textColor = colors.yellow.dark,
  disabled,
  label,
  loading = false,
  onPress,
}: {
  backgroundColor: string;
  textColor?: string;
  disabled: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <ThemedText style={[styles.buttonText, { color: textColor }]}>{label}</ThemedText>
      )}
    </Pressable>
  );
}

function PreviewActionButton({
  backgroundColor,
  foregroundColor,
  icon,
  disabled,
  label,
  loading = false,
  onPress,
  prominent = false,
  compact = false,
}: {
  backgroundColor: string;
  foregroundColor: string;
  icon: SymbolViewProps['name'];
  disabled: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  prominent?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.previewActionButton,
        prominent && styles.prominentPreviewAction,
        compact && styles.compactPreviewAction,
        { backgroundColor },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={foregroundColor} />
      ) : (
        <SymbolView
          name={icon}
          tintColor={foregroundColor}
          size={compact ? 20 : 18}
          style={compact ? styles.compactPreviewActionIcon : styles.previewActionIcon}
        />
      )}
      {!compact && (
        <ThemedText style={[styles.previewActionText, { color: foregroundColor }]}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

function PreferenceToggle({
  label,
  colorFamily,
  activeSymbol,
  inactiveSymbol,
  value,
  onChange,
}: {
  label: string;
  colorFamily: (typeof colors)[keyof typeof colors];
  activeSymbol: string;
  inactiveSymbol: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: value }}
      onPress={() => onChange(!value)}
      style={[styles.toggle, { backgroundColor: colorFamily.light }]}>
      <ThemedText style={[styles.preferenceLabel, { color: colorFamily.dark }]}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.preferenceIcon, { color: colorFamily.medium }]}>
        {value ? activeSymbol : inactiveSymbol}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: Spacing.five,
    paddingBottom: BottomTabInset + Spacing.six,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  catalogContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    alignItems: 'center',
    gap: Spacing.three,
  },
  centeredText: {
    textAlign: 'center',
  },
  preview: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 18,
  },
  catalogPreview: {
    width: '100%',
    maxWidth: 340,
    height: 240,
    borderRadius: 20,
  },
  actions: {
    width: '100%',
    maxWidth: 420,
    gap: Spacing.two,
  },
  imageTools: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  imageTool: {
    flex: 1,
  },
  cropTool: {
    flex: 1.08,
  },
  previewContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.two,
  },
  previewTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  previewActions: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  positiveActionGroup: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  discardAction: {
    width: 48,
  },
  previewActionButton: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
    borderRadius: 999,
  },
  prominentPreviewAction: {
    minHeight: 48,
  },
  compactPreviewAction: {
    width: 48,
    minHeight: 48,
    flex: 0,
    paddingHorizontal: 0,
  },
  compactPreviewActionIcon: {
    width: 20,
    height: 20,
  },
  previewActionIcon: {
    width: 18,
    height: 18,
  },
  previewActionText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  cropContent: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cropInstruction: {
    textAlign: 'center',
  },
  cropCanvas: {
    overflow: 'hidden',
    backgroundColor: '#111111',
    touchAction: 'none',
  },
  cropShade: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  cropWindow: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  cropResizeHandle: {
    position: 'absolute',
    right: -18,
    bottom: -18,
    width: 36,
    height: 36,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 18,
    backgroundColor: colors.turquoise.medium,
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  buttonText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    textAlign: 'center',
    color: colors.orange.dark,
  },
  toast: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 2,
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 18,
    backgroundColor: colors.green.light,
  },
  toastText: {
    fontWeight: '700',
    color: colors.green.dark,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    gap: Spacing.three,
  },
  field: {
    width: '100%',
    gap: Spacing.one,
  },
  selectorButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
  },
  selectorOptions: {
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
  },
  selectorOption: {
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.yellow.dark,
  },
  selectorEmpty: {
    paddingVertical: Spacing.three,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 14,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 112,
  },
  toggle: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
  },
  preferenceLabel: {
    fontWeight: '700',
  },
  preferenceIcon: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  ratingChoices: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  ratingChoice: {
    minWidth: 48,
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingStar: {
    fontSize: 32,
    lineHeight: 40,
  },
});
