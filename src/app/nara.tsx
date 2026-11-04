import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage } from '@/i18n/language-context';
import type { NaraOutfit, Personality } from '@/i18n/translations';

const CARD_SIZE = 84;
const CARD_GAP = 8;
const MOOD_CARD_SIZE = CARD_SIZE;

const outfits: {
  id: NaraOutfit;
  icon: SymbolViewProps['name'];
  background: string;
  primary: string;
}[] = [
  {
    id: 'unicornio',
    icon: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
    background: '#E5CDED',
    primary: '#7B428C',
  },
  {
    id: 'capibara',
    icon: { ios: 'pawprint.fill', android: 'pets', web: 'pets' },
    background: '#67513F',
    primary: '#F2DFC5',
  },
  {
    id: 'algodon',
    icon: { ios: 'cloud.fill', android: 'cloud', web: 'cloud' },
    background: '#F4C6DF',
    primary: '#A93475',
  },
  {
    id: 'cerezo',
    icon: { ios: 'leaf.fill', android: 'eco', web: 'eco' },
    background: '#F0BBC8',
    primary: '#9B233F',
  },
  {
    id: 'pato',
    icon: { ios: 'bird.fill', android: 'flutter_dash', web: 'flutter_dash' },
    background: '#BDE2E2',
    primary: '#376D35',
  },
];

const moods: { id: Personality }[] = [
  { id: 'serena' },
  { id: 'nara' },
  { id: 'delulu' },
  { id: 'segura' },
];

export default function NaraScreen() {
  const { language, setLanguage, outfit, setOutfit, personality, setPersonality, isLoaded, t } =
    useLanguage();
  const theme = useTheme();
  const selectedIndex = outfits.findIndex((item) => item.id === outfit);
  const selectedMoodIndex = moods.findIndex((item) => item.id === personality);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <ThemedText type="subtitle" style={styles.pageTitle}>
          {t.nara.title}
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            {t.nara.language}
          </ThemedText>
          <View style={styles.languageOptions}>
            {(['es', 'en'] as const).map((option) => {
              const isSelected = language === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected, disabled: !isLoaded }}
                  aria-checked={isSelected}
                  disabled={!isLoaded}
                  onPress={() => setLanguage(option)}
                  style={[
                    styles.languageOption,
                    isSelected && styles.languageOptionSelected,
                  ]}>
                  <ThemedText
                    type="small"
                    style={[styles.languageText, isSelected && styles.languageTextSelected]}>
                    {t.nara.languages[option]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            {t.nara.wardrobe}
          </ThemedText>
          <LoopingGallery
            items={outfits}
            selectedIndex={selectedIndex}
            itemSize={CARD_SIZE}
            renderItem={(item, accessibilityCopy, selected) => (
              <OutfitCard
                key={`${accessibilityCopy ? 'accessible' : 'copy'}-${item.id}`}
                outfit={item}
                selected={selected}
                name={t.nara.outfits[item.id]}
                surfaceColor={theme.backgroundElement}
                disabled={!isLoaded}
                accessibilityCopy={accessibilityCopy}
                onPress={() => setOutfit(item.id)}
              />
            )}
          />
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            {t.nara.mood}
          </ThemedText>
          <LoopingGallery
            items={moods}
            selectedIndex={selectedMoodIndex}
            itemSize={MOOD_CARD_SIZE}
            renderItem={(item, accessibilityCopy, selected) => (
              <MoodCard
                key={`${accessibilityCopy ? 'accessible' : 'copy'}-${item.id}`}
                mood={item.id}
                name={t.nara.moodOptions[item.id]}
                selected={selected}
                disabled={!isLoaded}
                accessibilityCopy={accessibilityCopy}
                onPress={() => setPersonality(item.id)}
              />
            )}
          />
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

type LoopingGalleryProps<Item extends { id: string }> = {
  items: Item[];
  selectedIndex: number;
  itemSize: number;
  renderItem: (
    item: Item,
    accessibilityCopy: boolean,
    selected: boolean
  ) => ReactNode;
};

function LoopingGallery<Item extends { id: string }>({
  items,
  selectedIndex,
  itemSize,
  renderItem,
}: LoopingGalleryProps<Item>) {
  const galleryRef = useRef<ScrollViewInstance>(null);
  const [galleryWidth, setGalleryWidth] = useState(0);
  const itemPitch = itemSize + CARD_GAP;
  const loopWidth = items.length * itemPitch;

  useEffect(() => {
    if (!galleryWidth || selectedIndex < 0 || !items.length) {
      return;
    }

    galleryRef.current?.scrollTo({
      x: (items.length + selectedIndex) * itemPitch,
      animated: false,
    });
  }, [galleryWidth, itemPitch, items.length, selectedIndex]);

  const recenterGallery = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.x;
    if (offset < loopWidth) {
      galleryRef.current?.scrollTo({ x: offset + loopWidth, animated: false });
    } else if (offset >= loopWidth * 2) {
      galleryRef.current?.scrollTo({ x: offset - loopWidth, animated: false });
    }
  };

  return (
    <View
      onLayout={(event) => setGalleryWidth(event.nativeEvent.layout.width)}
      style={styles.galleryViewport}>
      {galleryWidth > 0 && (
        <ScrollView
          ref={galleryRef}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.galleryContent,
            { paddingHorizontal: (galleryWidth - itemSize) / 2 },
          ]}
          onMomentumScrollEnd={recenterGallery}>
          {[0, 1, 2].flatMap((copy) =>
            items.map((item, index) => {
              const selected = index === selectedIndex;

              return (
                <View
                  key={`${copy}-${item.id}`}
                  style={[
                    styles.galleryItem,
                    { width: itemSize, height: itemSize },
                    selected ? styles.selectedGalleryItem : styles.unselectedGalleryItem,
                  ]}>
                  {renderItem(item, copy === 1, selected)}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

type OutfitCardProps = {
  outfit: (typeof outfits)[number];
  selected: boolean;
  name: string;
  surfaceColor: string;
  disabled: boolean;
  accessibilityCopy: boolean;
  onPress: () => void;
};

function OutfitCard({
  outfit,
  selected,
  name,
  surfaceColor,
  disabled,
  accessibilityCopy,
  onPress,
}: OutfitCardProps) {
  return (
    <Pressable
      accessible={accessibilityCopy}
      focusable={accessibilityCopy}
      accessibilityRole={accessibilityCopy ? 'radio' : undefined}
      accessibilityLabel={accessibilityCopy ? name : undefined}
      accessibilityState={
        accessibilityCopy ? { checked: selected, disabled } : undefined
      }
      aria-checked={accessibilityCopy ? selected : undefined}
      accessibilityElementsHidden={!accessibilityCopy}
      importantForAccessibility={accessibilityCopy ? 'auto' : 'no-hide-descendants'}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.outfitCard,
        !selected && { backgroundColor: outfit.background },
        { opacity: pressed ? 0.78 : 1 },
      ]}>
      {selected && (
        <ShirtShape
          color={outfit.background}
          surfaceColor={surfaceColor}
        />
      )}
      <View style={styles.outfitContent}>
        <SymbolView
          name={outfit.icon}
          size={selected ? 36 : 25}
          tintColor={outfit.primary}
          style={[styles.outfitIcon, selected && styles.selectedOutfitIcon]}
        />
        {!selected && (
          <ThemedText
            numberOfLines={2}
            style={[styles.outfitName, { color: outfit.primary }]}>
            {name}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

type MoodCardProps = {
  mood: Personality;
  name: string;
  selected: boolean;
  disabled: boolean;
  accessibilityCopy: boolean;
  onPress: () => void;
};

function MoodCard({
  mood,
  name,
  selected,
  disabled,
  accessibilityCopy,
  onPress,
}: MoodCardProps) {
  return (
    <Pressable
      accessible={accessibilityCopy}
      focusable={accessibilityCopy}
      accessibilityRole={accessibilityCopy ? 'radio' : undefined}
      accessibilityLabel={accessibilityCopy ? name : undefined}
      accessibilityState={
        accessibilityCopy ? { checked: selected, disabled } : undefined
      }
      aria-checked={accessibilityCopy ? selected : undefined}
      accessibilityElementsHidden={!accessibilityCopy}
      importantForAccessibility={accessibilityCopy ? 'auto' : 'no-hide-descendants'}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.moodCard,
        selected && styles.selectedMoodCard,
        pressed && styles.pressed,
      ]}>
      <SmileyFace mood={mood} selected={selected} />
      {!selected && (
        <ThemedText type="small" style={styles.moodLabel}>
          {name}
        </ThemedText>
      )}
    </Pressable>
  );
}

function ShirtShape({ color, surfaceColor }: { color: string; surfaceColor: string }) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.shirt}>
      <View
        style={[
          styles.shirtSleeve,
          styles.leftSleeve,
          { backgroundColor: color, borderRightColor: color },
        ]}
      />
      <View
        style={[
          styles.shirtSleeve,
          styles.rightSleeve,
          { backgroundColor: color, borderLeftColor: color },
        ]}
      />
      <View style={[styles.shirtBody, { backgroundColor: color }]} />
      <View style={[styles.shirtNeck, { backgroundColor: surfaceColor }]} />
    </View>
  );
}

function SmileyFace({ mood, selected }: { mood: Personality; selected: boolean }) {
  const faceColor = selected ? '#5C3467' : '#8E4FA6';
  const smileSize = {
    serena: styles.kindSmile,
    nara: styles.bigSmile,
    delulu: styles.deluluSmile,
  }[mood === 'segura' ? 'serena' : mood];

  return (
    <View style={[styles.face, selected && styles.selectedFace]}>
      {mood === 'delulu' ? (
        <View style={styles.heartEyes}>
          <Text
            style={[
              styles.heartEye,
              selected && styles.selectedHeartEye,
              { color: faceColor },
            ]}>
            {selected ? '♥' : '♡'}
          </Text>
          <Text
            style={[
              styles.heartEye,
              selected && styles.selectedHeartEye,
              { color: faceColor },
            ]}>
            {selected ? '♥' : '♡'}
          </Text>
        </View>
      ) : mood === 'segura' ? (
        <View style={styles.questionEyes}>
          <View style={[styles.questionEyebrow, { backgroundColor: faceColor }]} />
          <View style={styles.eyes}>
            <View style={[styles.eye, { backgroundColor: faceColor }]} />
            <View style={[styles.eye, styles.sideEye, { backgroundColor: faceColor }]} />
          </View>
        </View>
      ) : (
        <View style={styles.eyes}>
          <View style={[styles.eye, { backgroundColor: faceColor }]} />
          <View style={[styles.eye, { backgroundColor: faceColor }]} />
        </View>
      )}
      {mood === 'segura' ? (
        <View style={[styles.questionMouth, { backgroundColor: faceColor }]} />
      ) : (
        <View style={[styles.smile, smileSize, { borderBottomColor: faceColor }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five,
    paddingBottom: 120,
    gap: Spacing.three,
  },
  pageTitle: {
    textAlign: 'center',
    fontSize: 28,
    lineHeight: 36,
    marginBottom: Spacing.one,
  },
  section: {
    padding: Spacing.three,
    borderRadius: 22,
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 17,
  },
  languageOptions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  languageOption: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#FFFFFF80',
  },
  languageOptionSelected: {
    backgroundColor: '#C48FD1',
  },
  languageText: {
    color: '#4B4550',
  },
  languageTextSelected: {
    color: '#2B1D30',
  },
  galleryViewport: {
    marginHorizontal: -Spacing.three,
    overflow: 'hidden',
  },
  galleryContent: {
    alignItems: 'center',
    gap: CARD_GAP,
    paddingVertical: Spacing.one,
    minHeight: 112,
  },
  galleryItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedGalleryItem: {
    transform: [{ scale: 1.06 }],
    zIndex: 1,
  },
  unselectedGalleryItem: {
    transform: [{ scale: 0.88 }],
  },
  outfitCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 17,
    paddingHorizontal: 3,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  outfitIcon: {
    width: 25,
    height: 25,
  },
  selectedOutfitIcon: {
    width: 36,
    height: 36,
  },
  outfitName: {
    width: '100%',
    paddingHorizontal: 5,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
  },
  shirt: {
    position: 'absolute',
    top: -4,
    left: -6,
    width: CARD_SIZE + 12,
    height: CARD_SIZE + 8,
  },
  shirtSleeve: {
    position: 'absolute',
    top: 19,
    width: 0,
    height: 0,
    borderTopWidth: 11,
    borderBottomWidth: 11,
  },
  leftSleeve: {
    left: 1,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightWidth: 19,
  },
  rightSleeve: {
    right: 1,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftWidth: 19,
  },
  shirtBody: {
    position: 'absolute',
    top: 7.5,
    left: 12,
    width: 72,
    height: 77,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
  },
  shirtNeck: {
    position: 'absolute',
    top: -0.5,
    left: 40,
    width: 16,
    height: 16,
    borderRadius: 8,
    zIndex: 2,
  },
  moodCard: {
    width: MOOD_CARD_SIZE,
    height: MOOD_CARD_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
    borderRadius: 18,
    backgroundColor: '#F0E7F2',
  },
  selectedMoodCard: {
    backgroundColor: '#C48FD1',
    borderRadius: MOOD_CARD_SIZE / 2,
  },
  moodLabel: {
    width: '100%',
    paddingHorizontal: 2,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    minHeight: 24,
    color: '#38263D',
  },
  face: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  selectedFace: {
    width: 44,
    height: 44,
    transform: [{ scale: 1.35 }],
  },
  eyes: {
    flexDirection: 'row',
    gap: 8,
  },
  heartEyes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  questionEyes: {
    height: 15,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  questionEyebrow: {
    position: 'absolute',
    top: 0,
    left: 12,
    width: 9,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '-18deg' }],
  },
  sideEye: {
    transform: [{ translateX: 2 }],
  },
  questionMouth: {
    width: 10,
    height: 2,
    borderRadius: 2,
    transform: [{ rotate: '-8deg' }],
  },
  heartEye: {
    fontSize: 13,
    lineHeight: 14,
  },
  selectedHeartEye: {
    fontSize: 17,
    lineHeight: 18,
  },
  eye: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  smile: {
    borderBottomWidth: 2,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  kindSmile: {
    width: 10,
    height: 4,
  },
  bigSmile: {
    width: 18,
    height: 8,
  },
  deluluSmile: {
    width: 15,
    height: 7,
  },
  pressed: {
    opacity: 0.72,
  },
});
