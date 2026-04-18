import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, Screen, Title } from '../components/Ui';
import { useApp } from '../context/AppContext';
import { t } from '../i18n';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RoleSelection'>;

export function RoleSelectionScreen({ navigation }: Props) {
  const { selectRole } = useApp();

  return (
    <Screen>
      <Title subtitle={t('role.selectSubtitle')}>{t('role.selectTitle')}</Title>

      <Card>
        <Text style={styles.text}>{t('role.selectDescription')}</Text>
        <Button
          label={t('role.collector')}
          onPress={() => {
            selectRole('collector');
            navigation.replace('QrScanner', { origin: 'onboarding' });
          }}
        />
        <Button
          label={t('role.analyst')}
          variant="secondary"
          onPress={() => {
            selectRole('analyst');
            navigation.replace('PlaceholderRole', { role: 'analyst' });
          }}
        />
        <Button
          label={t('role.manager')}
          variant="secondary"
          onPress={() => {
            selectRole('manager');
            navigation.replace('PlaceholderRole', { role: 'manager' });
          }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});
