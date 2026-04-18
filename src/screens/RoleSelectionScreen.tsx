import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, Screen, Title } from '../components/Ui';
import { RootStackParamList } from '../navigation/types';
import { useApp } from '../context/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'RoleSelection'>;

export function RoleSelectionScreen({ navigation }: Props) {
  const { selectRole } = useApp();

  return (
    <Screen>
      <Title subtitle="Тип аккаунта можно изменить позже в настройках">
        Выберите тип аккаунта
      </Title>

      <Card>
        <Text style={styles.text}>Кем вы будете работать в приложении?</Text>
        <Button
          label="Сборщик данных"
          onPress={() => {
            selectRole('collector');
            navigation.replace('QrScanner', { origin: 'onboarding' });
          }}
        />
        <Button
          label="Аналитик данных"
          variant="secondary"
          onPress={() => {
            selectRole('analyst');
            navigation.replace('PlaceholderRole', { role: 'analyst' });
          }}
        />
        <Button
          label="Руководитель"
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
