import React from 'react';
import { Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, Screen, Title, uiStyles } from '../components/Ui';
import { v2Copy } from '../config/copy';
import { V2RootStackParamList } from '../navigation/types';

export function PlaceholderRoleScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'PlaceholderRole'>) {
  return (
    <Screen>
      <Title>{route.params.role === 'analyst' ? v2Copy.analyst : v2Copy.manager}</Title>
      <Card>
        <Text style={uiStyles.paragraph}>{v2Copy.rolePlaceholder}</Text>
        <Button label={v2Copy.back} onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}
