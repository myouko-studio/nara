import {
  TabList,
  TabListProps,
  Tabs,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
} from 'expo-router/ui';
import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, Spacing, tabBarColors, tabColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLanguage } from '@/i18n/language-context';

export default function AppTabs() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.nara.title}
        onPress={() => router.push('/nara')}
        style={({ pressed }) => [styles.naraShortcut, { top: insets.top + Spacing.two }, pressed && styles.pressed]}>
        <Image
          accessible={false}
          resizeMode="contain"
          source={require('@/assets/images/logo.png')}
          style={styles.naraIcon}
        />
      </Pressable>
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="universe" href="/universe" asChild>
            <TabButton
              icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
              color={tabColors.universe}>
              {t.tabs.universe}
            </TabButton>
          </TabTrigger>
          <TabTrigger name="index" href="/" asChild>
            <TabButton
              icon={{ ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }}
              color={tabColors.statistics}>
              {t.tabs.statistics}
            </TabButton>
          </TabTrigger>
          <TabTrigger name="register" href="/register" asChild>
            <TabButton
              icon={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
              color={colors.yellow}
              primaryAction>
              {t.tabs.register}
            </TabButton>
          </TabTrigger>
          <TabTrigger name="categories" href="/categories" asChild>
            <TabButton
              icon={{ ios: 'tag.fill', android: 'label', web: 'label' }}
              color={tabColors.categories}>
              {t.tabs.categories}
            </TabButton>
          </TabTrigger>
          <TabTrigger name="account" href="/account" asChild>
            <TabButton
              icon={{
                ios: 'person.crop.circle.fill',
                android: 'account_circle',
                web: 'account_circle',
              }}
              color={tabColors.account}>
              {t.tabs.account}
            </TabButton>
          </TabTrigger>
          {__DEV__ && Platform.OS !== 'web' && (
            <TabTrigger name="matching-debug" href="/matching-debug" asChild>
              <TabButton
                icon={{ ios: 'viewfinder', android: 'image_search', web: 'image_search' }}
                color={tabColors.universe}>
                Embeddings
              </TabButton>
            </TabTrigger>
          )}
          <TabTrigger name="nara" href="/nara" style={styles.hiddenTabTrigger} />
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = Omit<TabTriggerSlotProps, 'ref'> & {
  ref?: ComponentProps<typeof Pressable>['ref'];
  icon: SymbolViewProps['name'];
  color: (typeof tabColors)[keyof typeof tabColors];
  primaryAction?: boolean;
};

function TabButton({
  children,
  color,
  icon,
  isFocused,
  primaryAction = false,
  ...props
}: TabButtonProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const accessibilityLabel = typeof children === 'string' ? children : undefined;
  const activeContrastColor = color[isDark ? 'dark' : 'light'];
  const iconAndTextColor = primaryAction
    ? tabBarColors.inactive
    : isFocused
      ? activeContrastColor
      : tabBarColors.inactive;
  const capsuleColor = primaryAction
    ? colors.yellow.medium
    : isFocused
      ? color.medium
      : 'transparent';

  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [
        styles.tabButton,
        primaryAction && styles.primaryActionButton,
        primaryAction && Platform.OS === 'web' && styles.primaryActionButtonWeb,
        pressed && styles.pressed,
      ]}>
      <View
        style={[
          styles.tabButtonContent,
          (isFocused || primaryAction) && { backgroundColor: capsuleColor },
          (isFocused || primaryAction) && styles.activeTabButtonContent,
          primaryAction &&
            (Platform.OS === 'web'
              ? styles.primaryActionContentWeb
              : styles.primaryActionMobile),
        ]}>
        <SymbolView
          name={icon}
          tintColor={iconAndTextColor}
          size={primaryAction ? 28 : Platform.OS === 'web' ? 22 : 25}
          style={[
            styles.tabIcon,
            primaryAction &&
              (Platform.OS === 'web'
                ? styles.primaryActionIconWeb
                : styles.primaryActionIconMobile),
          ]}
        />
        {Platform.OS === 'web' && !primaryAction && (
          <Text style={[styles.tabLabel, { color: iconAndTextColor }]}>{children}</Text>
        )}
      </View>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      {...props}
      style={[
        styles.tabListContainer,
        { paddingBottom: Math.max(insets.bottom, Spacing.one) },
      ]}>
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Spacing.one,
    paddingHorizontal: Spacing.half,
    backgroundColor: tabBarColors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButton: {
    flex: 1,
    minWidth: 0,
  },
  primaryActionButton: {
    zIndex: 1,
  },
  primaryActionButtonWeb: {
    flex: 0,
    flexBasis: 76,
    width: 76,
  },
  tabButtonContent: {
    minHeight: Platform.OS === 'web' ? 56 : 48,
    marginHorizontal: Spacing.half,
    paddingHorizontal: Platform.OS === 'web' ? Spacing.half : Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  activeTabButtonContent: {
    borderRadius: 999,
  },
  primaryActionMobile: {
    width: 70,
    height: 70,
    minHeight: 70,
    alignSelf: 'center',
    marginTop: -25,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: tabBarColors.background,
    shadowColor: colors.yellow.dark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryActionContentWeb: {
    width: 68,
    height: 68,
    minHeight: 68,
    alignSelf: 'center',
    marginTop: -24,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: tabBarColors.background,
    shadowColor: colors.yellow.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 6,
    elevation: 8,
  },
  primaryActionIconWeb: {
    width: 28,
    height: 28,
  },
  primaryActionIconMobile: {
    width: 28,
    height: 28,
  },
  tabIcon: {
    width: Platform.OS === 'web' ? 22 : 25,
    height: Platform.OS === 'web' ? 22 : 25,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  naraShortcut: {
    position: 'absolute',
    left: Spacing.three,
    zIndex: 2,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.one,
  },
  hiddenTabTrigger: {
    display: 'none',
  },
  naraIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
