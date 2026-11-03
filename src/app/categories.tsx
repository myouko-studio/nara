import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  CategoryNameConflictError,
  createGroup,
  createMember,
  deleteGroup,
  deleteMember,
  getGroups,
  getMembers,
  updateGroup,
  updateMember,
} from '@/database';
import type { GroupCategory, MemberCategory } from '@/domain/category';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage } from '@/i18n/language-context';
import { BottomTabInset, colors, Spacing } from '@/constants/theme';

type CategoryError = 'duplicateGroup' | 'duplicateMember' | 'saveError' | 'loadError';
type PendingDeletion =
  | { type: 'group'; category: GroupCategory }
  | { type: 'member'; category: MemberCategory };
type CategoryForm = 'group' | 'member';

function CategoryPicker({
  label,
  placeholder,
  value,
  options,
  open,
  disabled,
  onToggle,
  onSelect,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  const isDarkTheme = useColorScheme() === 'dark';

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={onToggle}
        style={[
          styles.pickerButton,
          {
            backgroundColor: isDarkTheme ? '#202719' : '#F3F8E9',
            borderColor: open ? colors.green.medium : isDarkTheme ? '#587511' : '#A8C46A',
          },
          disabled && styles.disabled,
        ]}>
        <ThemedText style={!value ? { color: theme.textSecondary } : undefined}>
          {value || placeholder}
        </ThemedText>
        <ThemedText>{open ? '⌃' : '⌄'}</ThemedText>
      </Pressable>
      {open && (
        <View
          style={[
            styles.pickerOptions,
            {
              backgroundColor: theme.background,
              borderColor: isDarkTheme ? '#587511' : '#A8C46A',
            },
          ]}>
          {options.map((option, index) => (
            <Pressable
              accessibilityRole="button"
              key={option.id}
              onPress={() => onSelect(option.id)}
              style={[
                styles.pickerOption,
                index === options.length - 1 && styles.pickerOptionLast,
              ]}>
              <ThemedText>{option.name}</ThemedText>
            </Pressable>
          ))}
          {options.length === 0 && <ThemedText>{placeholder}</ThemedText>}
        </View>
      )}
    </View>
  );
}

export default function CategoriesScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const isDarkTheme = useColorScheme() === 'dark';
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<GroupCategory[]>([]);
  const [members, setMembers] = useState<MemberCategory[]>([]);
  const [memberGroupId, setMemberGroupId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [openPicker, setOpenPicker] = useState<'memberGroup' | null>(null);
  const [error, setError] = useState<CategoryError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [focusedForm, setFocusedForm] = useState<CategoryForm | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null);
  const scrollViewRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const groupInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const memberInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const focusedInputRef = useRef<ComponentRef<typeof TextInput> | null>(null);
  const scrollOffset = useRef(0);

  const scrollInputToComfortablePosition = useCallback(
    (input: ComponentRef<typeof TextInput>) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const scrollView = scrollViewRef.current;
          if (!scrollView) {
            return;
          }

          input.measureInWindow((_inputX, inputY, _inputWidth, inputHeight) => {
            scrollView.measureInWindow((_scrollX, scrollY, _scrollWidth, scrollHeight) => {
              const visibleTop = scrollY + Spacing.two;
              const visibleBottom = scrollY + scrollHeight - Spacing.three;
              const inputBottom = inputY + inputHeight;
              let adjustment = 0;

              if (inputBottom > visibleBottom) {
                adjustment = inputBottom - visibleBottom;
              } else if (inputY < visibleTop) {
                adjustment = inputY - visibleTop;
              }

              if (adjustment !== 0) {
                scrollView.scrollTo({
                  y: Math.max(0, scrollOffset.current + adjustment),
                  animated: true,
                });
              }
            });
          });
        });
      });
    },
    []
  );

  const loadCategories = useCallback(async () => {
    setError(null);
    try {
      const [nextGroups, nextMembers] = await Promise.all([getGroups(db), getMembers(db)]);
      setGroups(nextGroups);
      setMembers(nextMembers);
      setMemberGroupId((current) =>
        nextGroups.some((group) => group.id === current) ? current : (nextGroups[0]?.id ?? '')
      );
    } catch (loadError) {
      console.error('Unable to load group and member categories.', loadError);
      setError('loadError');
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      if (focusedInputRef.current) {
        scrollInputToComfortablePosition(focusedInputRef.current);
      }
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setFocusedForm(null);
      focusedInputRef.current = null;
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [scrollInputToComfortablePosition]);

  const selectedMemberGroup = groups.find((group) => group.id === memberGroupId) ?? null;
  const visibleMembers = useMemo(
    () => members.filter((member) => member.groupId === memberGroupId),
    [members, memberGroupId]
  );

  const saveGroup = async () => {
    setError(null);
    setIsSaving(true);
    try {
      if (editingGroupId) {
        await updateGroup(db, editingGroupId, groupName);
      } else {
        await createGroup(db, groupName);
      }
      setGroupName('');
      setEditingGroupId(null);
      await loadCategories();
    } catch (saveError) {
      if (saveError instanceof CategoryNameConflictError) {
        setError('duplicateGroup');
      } else {
        console.error('Unable to save a group category.', saveError);
        setError('saveError');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const saveMember = async () => {
    if (!memberGroupId) {
      setError('saveError');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      if (editingMemberId) {
        await updateMember(db, editingMemberId, memberName);
      } else {
        await createMember(db, memberGroupId, memberName);
      }
      setMemberName('');
      setEditingMemberId(null);
      await loadCategories();
    } catch (saveError) {
      if (saveError instanceof CategoryNameConflictError) {
        setError('duplicateMember');
      } else {
        console.error('Unable to save a member category.', saveError);
        setError('saveError');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const removeGroup = async (group: GroupCategory) => {
    setError(null);
    try {
      await deleteGroup(db, group.id);
      if (editingGroupId === group.id) {
        setEditingGroupId(null);
        setGroupName('');
      }
      if (
        editingMemberId &&
        members.some((member) => member.groupId === group.id && member.id === editingMemberId)
      ) {
        setEditingMemberId(null);
        setMemberName('');
      }
      await loadCategories();
    } catch (deleteError) {
      console.error(`Unable to delete group "${group.name}".`, deleteError);
      setError('saveError');
    }
  };

  const removeMember = async (member: MemberCategory) => {
    setError(null);
    try {
      await deleteMember(db, member.id);
      if (editingMemberId === member.id) {
        setEditingMemberId(null);
        setMemberName('');
      }
      await loadCategories();
    } catch (deleteError) {
      console.error(`Unable to delete member "${member.name}".`, deleteError);
      setError('saveError');
    }
  };

  const confirmDeletion = async () => {
    if (!pendingDeletion) {
      return;
    }

    const deletion = pendingDeletion;
    setPendingDeletion(null);
    if (deletion.type === 'group') {
      await removeGroup(deletion.category);
    } else {
      await removeMember(deletion.category);
    }
  };

  const deleteConfirmation =
    pendingDeletion &&
    t.categories.deleteConfirmation.replace('{name}', pendingDeletion.category.name);
  const deleteNote =
    pendingDeletion?.type === 'group'
      ? t.categories.deleteGroupNote
      : t.categories.deleteMemberNote;

  const startEditingGroup = (group: GroupCategory) => {
    setError(null);
    setEditingGroupId(group.id);
    setGroupName(group.name);
  };

  const startEditingMember = (member: MemberCategory) => {
    setError(null);
    setEditingMemberId(member.id);
    setMemberGroupId(member.groupId);
    setMemberName(member.name);
    setOpenPicker(null);
  };

  const cancelGroupEdit = () => {
    setEditingGroupId(null);
    setGroupName('');
    setError(null);
  };

  const cancelMemberEdit = () => {
    setEditingMemberId(null);
    setMemberName('');
    setError(null);
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined
        }
        style={styles.keyboardAvoidingView}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom:
                Math.max(BottomTabInset, 56 + insets.bottom) +
                (Platform.OS === 'web' ? Spacing.four : Spacing.two),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => {
            scrollOffset.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          scrollsChildToFocus={false}>
          <ThemedText type="title">{t.categories.title}</ThemedText>
          <ThemedText style={[styles.help, { backgroundColor: theme.backgroundElement }]}>
            {t.categories.help}
          </ThemedText>
          <ThemedText style={styles.historyNote}>{t.categories.historyNote}</ThemedText>

          <View
            style={[
              styles.section,
              styles.sectionCard,
              { backgroundColor: theme.backgroundElement, borderColor: isDarkTheme ? '#3A3D38' : '#E2E6DC' },
            ]}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionAccent} />
              <ThemedText type="subtitle">{t.categories.groups}</ThemedText>
            </View>
            <View style={styles.editor}>
              <ThemedText type="smallBold">{t.categories.groupName}</ThemedText>
              <TextInput
                accessibilityLabel={t.categories.groupName}
                ref={groupInputRef}
                onBlur={() => {
                  if (focusedInputRef.current === groupInputRef.current) {
                    focusedInputRef.current = null;
                  }
                }}
                onChangeText={setGroupName}
                onFocus={() => {
                  const input = groupInputRef.current;
                  if (input) {
                    focusedInputRef.current = input;
                    if (keyboardVisible) {
                      scrollInputToComfortablePosition(input);
                    }
                  }
                  setFocusedForm('group');
                }}
                placeholder={t.categories.groupNamePlaceholder}
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  {
                    backgroundColor: isDarkTheme ? '#202719' : '#F3F8E9',
                    borderColor:
                      focusedForm === 'group'
                        ? colors.green.medium
                        : isDarkTheme
                          ? '#587511'
                          : '#A8C46A',
                    color: theme.text,
                  },
                  focusedForm === 'group' && styles.focusedInput,
                ]}
                value={groupName}
              />
              <View
                style={[
                  styles.actions,
                  keyboardVisible && focusedForm === 'group' && styles.hiddenActions,
                ]}>
                <CategoryAction
                  label={editingGroupId ? t.categories.save : t.categories.addGroup}
                  disabled={isSaving || !groupName.trim()}
                  textColor={colors.green.dark}
                  disabledBackgroundColor={colors.green.light}
                  onPress={() => void saveGroup()}
                />
                {editingGroupId && (
                  <CategoryAction
                    label={t.categories.cancel}
                    secondary
                    disabled={isSaving}
                    onPress={cancelGroupEdit}
                  />
                )}
              </View>
            </View>

            {isLoading ? (
              <ThemedText>{t.universe.loading}</ThemedText>
            ) : groups.length === 0 ? (
              <ThemedText>{t.categories.noGroups}</ThemedText>
            ) : (
              groups.map((group) => (
                <View
                  key={group.id}
                  style={[
                    styles.row,
                    {
                      backgroundColor: theme.background,
                      borderColor: isDarkTheme ? '#35383A' : '#E1E4E8',
                    },
                  ]}>
                  <ThemedText style={styles.rowTitle}>{group.name}</ThemedText>
                  <View style={styles.rowActions}>
                    <TextAction
                      label={t.categories.edit}
                      onPress={() => startEditingGroup(group)}
                    />
                    <TextAction
                      label={t.categories.delete}
                      destructive
                      onPress={() => {
                        Keyboard.dismiss();
                        setPendingDeletion({ type: 'group', category: group });
                      }}
                    />
                  </View>
                </View>
              ))
            )}
          </View>

          <View
            style={[
              styles.section,
              styles.sectionCard,
              { backgroundColor: theme.backgroundElement, borderColor: isDarkTheme ? '#3A3D38' : '#E2E6DC' },
            ]}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionAccent} />
              <ThemedText type="subtitle">{t.categories.members}</ThemedText>
            </View>
            <View style={styles.editor}>
              <CategoryPicker
                label={t.categories.memberGroup}
                placeholder={t.categories.selectGroup}
                value={selectedMemberGroup?.name ?? ''}
                options={groups}
                open={openPicker === 'memberGroup'}
                disabled={groups.length === 0 || Boolean(editingMemberId)}
                onToggle={() => setOpenPicker(openPicker ? null : 'memberGroup')}
                onSelect={(id) => {
                  setMemberGroupId(id);
                  setOpenPicker(null);
                  setError(null);
                }}
              />
              <ThemedText type="smallBold">{t.categories.memberName}</ThemedText>
              <TextInput
                accessibilityLabel={t.categories.memberName}
                ref={memberInputRef}
                onBlur={() => {
                  if (focusedInputRef.current === memberInputRef.current) {
                    focusedInputRef.current = null;
                  }
                }}
                onChangeText={setMemberName}
                onFocus={() => {
                  const input = memberInputRef.current;
                  if (input) {
                    focusedInputRef.current = input;
                    if (keyboardVisible) {
                      scrollInputToComfortablePosition(input);
                    }
                  }
                  setFocusedForm('member');
                }}
                placeholder={t.categories.memberNamePlaceholder}
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  {
                    backgroundColor: isDarkTheme ? '#202719' : '#F3F8E9',
                    borderColor:
                      focusedForm === 'member'
                        ? colors.green.medium
                        : isDarkTheme
                          ? '#587511'
                          : '#A8C46A',
                    color: theme.text,
                  },
                  focusedForm === 'member' && styles.focusedInput,
                ]}
                value={memberName}
              />
              <View
                style={[
                  styles.actions,
                  keyboardVisible && focusedForm === 'member' && styles.hiddenActions,
                ]}>
                <CategoryAction
                  label={editingMemberId ? t.categories.save : t.categories.addMember}
                  disabled={isSaving || !memberName.trim() || !memberGroupId}
                  textColor={colors.green.dark}
                  disabledBackgroundColor={colors.green.light}
                  onPress={() => void saveMember()}
                />
                {editingMemberId && (
                  <CategoryAction
                    label={t.categories.cancel}
                    secondary
                    disabled={isSaving}
                    onPress={cancelMemberEdit}
                  />
                )}
              </View>
            </View>

            {!isLoading && groups.length > 0 && visibleMembers.length === 0 && (
              <ThemedText>{t.categories.noMembers}</ThemedText>
            )}
            {visibleMembers.map((member) => (
              <View
                key={member.id}
                style={[
                  styles.row,
                  {
                    backgroundColor: theme.background,
                    borderColor: isDarkTheme ? '#35383A' : '#E1E4E8',
                  },
                ]}>
                <ThemedText style={styles.rowTitle}>{member.name}</ThemedText>
                <View style={styles.rowActions}>
                  <TextAction
                    label={t.categories.edit}
                    onPress={() => startEditingMember(member)}
                  />
                  <TextAction
                    label={t.categories.delete}
                    destructive
                    onPress={() => {
                      Keyboard.dismiss();
                      setPendingDeletion({ type: 'member', category: member });
                    }}
                  />
                </View>
              </View>
            ))}
          </View>

          {error && <ThemedText style={styles.error}>{t.categories[error]}</ThemedText>}
        </ScrollView>
        {keyboardVisible && focusedForm && (
          <View style={[styles.keyboardActions, { backgroundColor: theme.background }]}>
            <CategoryAction
              label={
                focusedForm === 'group'
                  ? editingGroupId
                    ? t.categories.save
                    : t.categories.addGroup
                  : editingMemberId
                    ? t.categories.save
                    : t.categories.addMember
              }
              disabled={
                isSaving ||
                (focusedForm === 'group'
                  ? !groupName.trim()
                  : !memberName.trim() || !memberGroupId)
              }
              textColor={colors.green.dark}
              disabledBackgroundColor={colors.green.light}
              onPress={() => {
                if (focusedForm === 'group') {
                  void saveGroup();
                } else {
                  void saveMember();
                }
              }}
            />
            {(focusedForm === 'group' ? editingGroupId : editingMemberId) && (
              <CategoryAction
                label={t.categories.cancel}
                secondary
                disabled={isSaving}
                onPress={focusedForm === 'group' ? cancelGroupEdit : cancelMemberEdit}
              />
            )}
          </View>
        )}
      </KeyboardAvoidingView>
      <Modal
        animationType="fade"
        onRequestClose={() => setPendingDeletion(null)}
        transparent
        visible={pendingDeletion !== null}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.confirmationCard, { backgroundColor: theme.background }]}>
            <ThemedText type="subtitle">
              {pendingDeletion?.type === 'group'
                ? t.categories.deleteGroupTitle
                : t.categories.deleteMemberTitle}
            </ThemedText>
            <ThemedText style={styles.confirmationText}>{deleteConfirmation}</ThemedText>
            <ThemedText style={styles.confirmationNote}>{deleteNote}</ThemedText>
            <View style={styles.confirmationActions}>
              <CategoryAction
                label={t.categories.deleteCancel}
                secondary
                textColor={colors.yellow.dark}
                disabled={isSaving}
                onPress={() => setPendingDeletion(null)}
              />
              <CategoryAction
                label={t.categories.deleteConfirm}
                destructive
                textColor={isDarkTheme ? colors.orange.dark : colors.orange.light}
                disabled={isSaving}
                onPress={() => void confirmDeletion()}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

function CategoryAction({
  label,
  disabled,
  secondary = false,
  destructive = false,
  textColor,
  disabledBackgroundColor,
  onPress,
}: {
  label: string;
  disabled: boolean;
  secondary?: boolean;
  destructive?: boolean;
  textColor?: string;
  disabledBackgroundColor?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: disabled && disabledBackgroundColor
            ? disabledBackgroundColor
            : destructive
              ? colors.orange.medium
              : secondary
                ? colors.yellow.light
                : colors.green.medium,
        },
        disabled && !disabledBackgroundColor && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <ThemedText style={[styles.actionText, textColor ? { color: textColor } : undefined]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function TextAction({
  label,
  destructive = false,
  onPress,
}: {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <ThemedText style={{ color: destructive ? colors.orange.dark : colors.green.dark }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  keyboardActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  help: {
    padding: Spacing.three,
    borderRadius: 16,
    lineHeight: 22,
  },
  historyNote: {
    color: colors.yellow.dark,
  },
  section: {
    gap: Spacing.three,
  },
  sectionCard: {
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 20,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionAccent: {
    width: 4,
    height: 24,
    borderRadius: 999,
    backgroundColor: colors.green.medium,
  },
  editor: {
    gap: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  pickerButton: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerOptions: {
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
  },
  pickerOption: {
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.yellow.dark,
  },
  pickerOptionLast: {
    borderBottomWidth: 0,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
    borderWidth: 1.5,
    fontSize: 16,
  },
  focusedInput: {
    borderWidth: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  hiddenActions: {
    display: 'none',
  },
  action: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: 999,
  },
  actionText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: colors.green.medium,
    gap: Spacing.two,
  },
  rowTitle: {
    flex: 1,
    fontWeight: '700',
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  error: {
    color: colors.orange.dark,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.75,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },
  confirmationCard: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: Spacing.four,
    borderRadius: 20,
    gap: Spacing.three,
  },
  confirmationText: {
    fontWeight: '700',
  },
  confirmationNote: {
    lineHeight: 22,
  },
  confirmationActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
