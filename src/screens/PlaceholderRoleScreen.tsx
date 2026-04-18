import React from 'react';
import { Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, Screen, Title } from '../components/Ui';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PlaceholderRole'>;

export function PlaceholderRoleScreen({ route, navigation }: Props) {
  const title =
    route.params.role === 'analyst' ? 'Аналитик данных' : 'Руководитель';

  return (
    <Screen>
      <Title>{title}</Title>
      <Card>
        <Text style={{ fontSize: 16, lineHeight: 24 }}>
          Этот поток пока оставлен каркасом. Основная реализация в v1 сделана
          для роли сборщика данных.
        </Text>
        <Button
          label="Сменить тип аккаунта"
          variant="secondary"
          onPress={() => navigation.replace('RoleSelection')}
        />
      </Card>
    </Screen>
  );
}
