import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, Screen, StatPill, Title, uiStyles } from '../components/Ui';
import { useApp } from '../context/AppContext';
import { t } from '../i18n';
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
      <Title subtitle={t('qr.validationTitle')}>{state.pendingVariety.title}</Title>
      <Card>
        <Text style={styles.centerText}>{t('qr.addVarietyQuestion')}</Text>
        <StatPill label={t('qr.linkResolved')} tone="success" />
        <Button
          label={t('qr.yes')}
          onPress={() => {
            confirmPendingVariety();
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainMenu' }],
            });
          }}
        />
        <Button
          label={t('common.back')}
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
      <Title>{t('testMode.title')}</Title>
      <Card>
        <Text style={uiStyles.paragraph}>{t('testMode.description')}</Text>
        <Button
          label={t('testMode.ok')}
          onPress={() => {
            enableTestMode();
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainMenu' }],
            });
          }}
        />
        <Button label={t('common.back')} variant="secondary" onPress={() => navigation.goBack()} />
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
      <Title subtitle={isTestMode ? t('menu.testMode') : t('menu.workingMode')}>
        {t('menu.title')}
      </Title>

      <Card>
        <Text style={styles.centerText}>
          {isTestMode ? t('menu.testDescription') : t('menu.workingDescription')}
        </Text>
        <Button label={t('menu.varieties')} onPress={() => navigation.navigate('Varieties')} />
        <Button
          label={t('menu.settings')}
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
      ? t('role.collector')
      : state.activeRole === 'analyst'
        ? t('role.analyst')
        : t('role.manager');

  const currentModeLabel =
    state.collectorMode === 'test'
      ? t('settings.testMode')
      : state.collectorMode === 'linked'
        ? t('settings.linkedMode')
        : t('settings.notConfigured');

  const askSwitch = (role: 'collector' | 'analyst' | 'manager') => {
    Alert.alert(t('settings.switchRoleTitle'), t('settings.switchRoleDescription'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.confirmSwitch'),
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
    ]);
  };

  return (
    <Screen>
      <Title>{t('settings.title')}</Title>
      <Card>
        <View style={uiStyles.stack12}>
          <Text style={styles.label}>
            {t('settings.currentRole')}: {currentRoleLabel}
          </Text>
          <Text style={styles.label}>
            {t('settings.currentMode')}: {currentModeLabel}
          </Text>
        </View>
        <Button
          label={t('settings.replaceQr')}
          onPress={() => navigation.navigate('QrScanner', { origin: 'settings' })}
        />
        <Button
          label={t('settings.switchToAnalyst')}
          variant="secondary"
          onPress={() => askSwitch('analyst')}
        />
        <Button
          label={t('settings.switchToManager')}
          variant="secondary"
          onPress={() => askSwitch('manager')}
        />
        <Button
          label={t('settings.switchToCollector')}
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
