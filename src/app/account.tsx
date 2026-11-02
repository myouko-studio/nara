import { ScrollView, StyleSheet, View, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useLanguage, type ThemePreference } from '@/i18n/language-context';
import type { Language, Personality, Pronoun } from '@/i18n/translations';

type Option<Value extends string> = {
  value: Value;
  label: string;
};

type OptionGroupProps<Value extends string> = {
  label: string;
  options: readonly Option<Value>[];
  selectedOption: Value;
  onSelect?: (value: Value) => void;
  disabled?: boolean;
};

function OptionGroup<Value extends string>({
  label,
  options,
  selectedOption,
  onSelect,
  disabled = false,
}: OptionGroupProps<Value>) {
  return (
    <View style={styles.optionGroup}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.options}>
        {options.map((option) => {
          const isSelected = option.value === selectedOption;
          const content = (
            <ThemedView
              type={isSelected ? 'backgroundSelected' : 'background'}
              style={styles.option}>
              <ThemedText
                type="small"
                themeColor={isSelected ? 'text' : 'textSecondary'}
                style={styles.optionText}>
                {isSelected ? '✓ ' : ''}
                {option.label}
              </ThemedText>
            </ThemedView>
          );

          if (!onSelect) {
            return <View key={option.value} style={styles.optionButton}>{content}</View>;
          }

          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={styles.optionButton}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, disabled }}>
              {content}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AccountScreen() {
  const {
    language,
    setLanguage,
    theme,
    setTheme,
    personality,
    setPersonality,
    pronouns,
    setPronouns,
    isLoaded,
    t,
  } = useLanguage();

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedView type="backgroundElement" style={styles.avatar}>
            <ThemedText style={styles.avatarIcon}>👤</ThemedText>
          </ThemedView>
          <ThemedText type="subtitle" style={styles.title}>
            {t.account.title}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.description}>
            {t.account.description}
          </ThemedText>
        </View>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold" style={styles.cardTitle}>
            {t.account.profile}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t.account.name}
          </ThemedText>
          <ThemedView type="background" style={styles.nameField}>
            <ThemedText themeColor="textSecondary">{t.account.namePlaceholder}</ThemedText>
            <ThemedText themeColor="textSecondary">✎</ThemedText>
          </ThemedView>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold" style={styles.cardTitle}>
            {t.account.avatar}
          </ThemedText>
          <ThemedView type="background" style={styles.avatarPlaceholder}>
            <ThemedView type="backgroundSelected" style={styles.avatarPreview}>
              <ThemedText style={styles.avatarPlaceholderIcon}>👤</ThemedText>
            </ThemedView>
            <View style={styles.avatarCopy}>
              <ThemedText type="smallBold">{t.account.avatarPlaceholder}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t.account.avatarComingSoon}
              </ThemedText>
            </View>
          </ThemedView>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold" style={styles.cardTitle}>
            {t.account.preferences}
          </ThemedText>
          <OptionGroup
            label={t.account.language}
            options={[
              { value: 'es', label: t.account.languages.es },
              { value: 'en', label: t.account.languages.en },
            ]}
            selectedOption={language}
            onSelect={(value: Language) => setLanguage(value)}
            disabled={!isLoaded}
          />
          <View style={styles.divider} />
          <OptionGroup
            label={t.account.theme}
            options={[
              { value: 'light', label: t.account.themes.light },
              { value: 'dark', label: t.account.themes.dark },
              { value: 'system', label: t.account.themes.system },
            ]}
            selectedOption={theme}
            onSelect={(value: ThemePreference) => setTheme(value)}
            disabled={!isLoaded}
          />
          <View style={styles.divider} />
          <OptionGroup
            label={t.account.naraMood}
            options={[
              { value: 'serena', label: t.personality.options.serena },
              { value: 'nara', label: t.personality.options.nara },
              { value: 'delulu', label: t.personality.options.delulu },
            ]}
            selectedOption={personality}
            onSelect={(value: Personality) => setPersonality(value)}
            disabled={!isLoaded}
          />
          <View style={styles.divider} />
          <OptionGroup
            label={t.account.pronouns}
            options={[
              { value: 'feminine', label: t.account.pronounOptions.feminine },
              { value: 'masculine', label: t.account.pronounOptions.masculine },
              { value: 'neutral', label: t.account.pronounOptions.neutral },
            ]}
            selectedOption={pronouns}
            onSelect={(value: Pronoun) => setPronouns(value)}
            disabled={!isLoaded}
          />
        </ThemedView>
      </ScrollView>
    </ThemedView>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: 120,
    gap: Spacing.four,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  avatarIcon: {
    fontSize: 32,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
  },
  description: {
    textAlign: 'center',
  },
  card: {
    padding: Spacing.four,
    borderRadius: 24,
    gap: Spacing.three,
  },
  cardTitle: {
    fontSize: 18,
    marginBottom: Spacing.one,
  },
  nameField: {
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarPlaceholder: {
    minHeight: 88,
    padding: Spacing.three,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatarPreview: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderIcon: {
    fontSize: 26,
  },
  avatarCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  optionGroup: {
    gap: Spacing.two,
  },
  options: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  optionButton: {
    flex: 1,
    minWidth: 0,
  },
  option: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: Spacing.two,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 13,
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#80808040',
  },
});
