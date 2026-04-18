import React from 'react';
import { Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, Screen, Title } from '../components/Ui';
import { t } from '../i18n';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PlaceholderRole'>;

export function PlaceholderRoleScreen({ route, navigation }: Props) {
  const title = route.params.role === 'analyst' ? t('role.analyst') : t('role.manager');

  return (
    <Screen>
      <Title>{title}</Title>
      <Card>
        <Text style={{ fontSize: 16, lineHeight: 24 }}>{t('role.placeholderDescription')}</Text>
        <Button
          label={t('role.chooseAgain')}
          variant="secondary"
          onPress={() => navigation.replace('RoleSelection')}
        />
      </Card>
    </Screen>
  );
}
