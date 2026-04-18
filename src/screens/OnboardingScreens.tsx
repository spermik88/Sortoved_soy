import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, Screen, StatPill, Title, uiStyles } from '../components/Ui';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../navigation/types';

export function QrValidationScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'QrValidation'>) {
  const { state, confirmPendingVariety, clearPendingVariety } = useApp();

  if (!state.pendingVariety) {
    navigation.replace('QrScanner', { origin: 'onboarding' });
    return null;
  }

  return (
    <Screen>
      <Title subtitle="Валидация ссылки">{state.pendingVariety.title}</Title>
      <Card>
        <Text style={styles.centerText}>Добавить сорт?</Text>
        <StatPill label="Ссылка распознана" tone="success" />
        <Button
          label="Да"
          onPress={() => {
            confirmPendingVariety();
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainMenu' }],
            });
          }}
        />
        <Button
          label="Назад"
          variant="secondary"
          onPress={() => {
            clearPendingVariety();
            navigation.replace('QrScanner', { origin: 'onboarding' });
          }}
        />
      </Card>
    </Screen>
  );
}

export function TestModeWarningScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'TestModeWarning'>) {
  const { enableTestMode } = useApp();

  return (
    <Screen>
      <Title>Тестовый режим</Title>
      <Card>
        <Text style={uiStyles.paragraph}>
          Это тестовый режим. Прогресс будет храниться только локально на
          устройстве. Позже вы сможете добавить QR-код аналитика в настройках и
          переключиться на полноценную рабочую связку.
        </Text>
        <Button
          label="Ок"
          onPress={() => {
            enableTestMode();
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainMenu' }],
            });
          }}
        />
        <Button label="Назад" variant="secondary" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}

export function MainMenuScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'MainMenu'>) {
  const { state } = useApp();
  const isTestMode = state.collectorMode === 'test';

  return (
    <Screen>
      <Title subtitle={isTestMode ? 'Тестовый режим' : 'Рабочий режим'}>
        Главное меню
      </Title>

      <Card>
        <Text style={styles.centerText}>
          {isTestMode
            ? 'Можно проходить шаги и сохранять данные локально.'
            : 'Выберите раздел для продолжения работы.'}
        </Text>
        <Button label="Сорта" onPress={() => navigation.navigate('Varieties')} />
        <Button
          label="Настройки"
          variant="secondary"
          onPress={() => navigation.navigate('Settings')}
        />
      </Card>
    </Screen>
  );
}

export function SettingsScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Settings'>) {
  const { state, switchRole } = useApp();

  const currentRoleLabel =
    state.activeRole === 'collector'
      ? 'Сборщик данных'
      : state.activeRole === 'analyst'
        ? 'Аналитик данных'
        : 'Руководитель';

  const currentModeLabel =
    state.collectorMode === 'test'
      ? 'Тестовый режим'
      : state.collectorMode === 'linked'
        ? 'Привязан к QR'
        : 'Не настроено';

  const askSwitch = (role: 'collector' | 'analyst' | 'manager') => {
    Alert.alert(
      'Сменить тип аккаунта?',
      'Локальные данные сборщика будут очищены перед переключением роли.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сменить',
          style: 'destructive',
          onPress: () => {
            switchRole(role);
            if (role === 'collector') {
              navigation.reset({
                index: 0,
                routes: [{ name: 'QrScanner', params: { origin: 'settings' } }],
              });
            } else {
              navigation.reset({
                index: 0,
                routes: [{ name: 'PlaceholderRole', params: { role } }],
              });
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Title>Настройки</Title>
      <Card>
        <View style={uiStyles.stack12}>
          <Text style={styles.label}>Текущий аккаунт: {currentRoleLabel}</Text>
          <Text style={styles.label}>Режим сборщика: {currentModeLabel}</Text>
        </View>
        <Button
          label="Добавить или заменить QR-привязку"
          onPress={() => navigation.navigate('QrScanner', { origin: 'settings' })}
        />
        <Button
          label="Переключить на аналитика"
          variant="secondary"
          onPress={() => askSwitch('analyst')}
        />
        <Button
          label="Переключить на руководителя"
          variant="secondary"
          onPress={() => askSwitch('manager')}
        />
        <Button
          label="Выбрать сборщика заново"
          variant="ghost"
          onPress={() => askSwitch('collector')}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    color: '#2E2417',
  },
});
