import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, colors, Spacing } from '@/constants/theme';
import type { LocalizedSpecialMessage } from '@/special-messages/types';

type SpecialMessageViewProps = {
  imageUri: string;
  message: LocalizedSpecialMessage;
  onDismiss: () => void;
};

export function SpecialMessageView({
  imageUri,
  message,
  onDismiss,
}: SpecialMessageViewProps) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Image
        source={{ uri: imageUri }}
        accessibilityLabel={message.imageDescription}
        resizeMode="contain"
        style={styles.image}
      />
      <View style={styles.message}>
        {message.blocks.map((block, index) => (
          <ThemedText
            key={`${block.kind}-${index}`}
            style={[styles.block, styles[block.kind]]}>
            {block.text}
          </ThemedText>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onDismiss}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <ThemedText style={styles.buttonText}>{message.buttonLabel}</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.six,
  },
  image: {
    width: '100%',
    maxWidth: 440,
    height: 360,
    borderRadius: 24,
  },
  message: {
    width: '100%',
    maxWidth: 600,
    alignItems: 'center',
    gap: Spacing.three,
  },
  block: {
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
    color: colors.pink.dark,
  },
  shout: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '900',
    color: colors.pink.medium,
  },
  emphasis: {
    fontSize: 23,
    lineHeight: 32,
    fontWeight: '800',
    color: colors.turquoise.dark,
  },
  decoration: {
    fontSize: 24,
    lineHeight: 34,
  },
  body: {
    fontSize: 17,
    lineHeight: 26,
  },
  signature: {
    fontSize: 16,
    lineHeight: 25,
    fontWeight: '700',
    color: colors.pink.dark,
  },
  button: {
    width: '100%',
    maxWidth: 440,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
    borderRadius: 999,
    backgroundColor: colors.pink.light,
  },
  buttonText: {
    fontWeight: '800',
    textAlign: 'center',
    color: colors.pink.dark,
  },
  pressed: {
    opacity: 0.75,
  },
});
