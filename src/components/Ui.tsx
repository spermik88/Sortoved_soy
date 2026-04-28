import React, { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../constants/theme';

export function Screen({
  children,
  scroll = true,
}: PropsWithChildren<{ scroll?: boolean }>) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>
  ) : (
    <View style={styles.fill}>{children}</View>
  );

  return <SafeAreaView style={styles.safeArea}>{content}</SafeAreaView>;
}

export function Title({
  children,
  subtitle,
}: PropsWithChildren<{ subtitle?: string }>) {
  return (
    <View style={styles.titleWrap}>
      <Text style={styles.title}>{children}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'secondary' || variant === 'ghost'
            ? styles.secondaryButtonText
            : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  placeholder,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'numeric';
  placeholder?: string;
  editable?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        editable={editable}
        style={styles.input}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

export function StatPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === 'success' && styles.pillSuccess,
        tone === 'warning' && styles.pillWarning,
      ]}
    >
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export function PhotoFrame({
  uri,
  source,
  fallback,
}: {
  uri?: string;
  source?: ImageSourcePropType;
  fallback: string;
}) {
  const imageSource = source || (uri ? { uri } : undefined);

  return imageSource ? (
    <Image source={imageSource} style={styles.photo} />
  ) : (
    <View style={[styles.photo, styles.photoPlaceholder]}>
      <Text style={styles.placeholderText}>{fallback}</Text>
    </View>
  );
}

export function LinkText({ label, url }: { label: string; url?: string }) {
  return (
    <Text
      style={[styles.link, !url && styles.linkDisabled]}
      onPress={() => {
        if (url) {
          void Linking.openURL(url);
        }
      }}
    >
      {label}
    </Text>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.accentStrong} />
        <Text style={styles.subtitle}>{label}</Text>
      </View>
    </SafeAreaView>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.placeholderText}>{description}</Text> : null}
    </View>
  );
}

export function StepIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <View style={styles.stepWrap}>
      {Array.from({ length: total }).map((_, index) => {
        const active = index + 1 <= current;
        return <View key={index} style={[styles.stepDot, active && styles.stepDotActive]} />;
      })}
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stack12: {
    gap: 12,
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fill: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  titleWrap: {
    gap: 6,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  button: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: colors.accentStrong,
  },
  secondary: {
    backgroundColor: colors.surfaceMuted,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
    borderColor: colors.disabled,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonText: {
    color: '#FFF9EF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: colors.text,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFCF6',
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  pillSuccess: {
    backgroundColor: '#D6F0C7',
  },
  pillWarning: {
    backgroundColor: '#F9E3BA',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F1E8D5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  placeholderText: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  link: {
    fontSize: 15,
    color: colors.accentStrong,
    textDecorationLine: 'underline',
  },
  linkDisabled: {
    color: colors.textMuted,
    textDecorationLine: 'none',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  emptyWrap: {
    paddingVertical: 10,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  stepWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  stepDot: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.disabled,
  },
  stepDotActive: {
    backgroundColor: colors.accentStrong,
  },
});
