import React from 'react';
import { Alert, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, Screen, StatPill, Title, uiStyles } from '../components/Ui';
import { v2Copy } from '../config/copy';
import { useV2App } from '../context/V2AppContext';
import { V2RootStackParamList } from '../navigation/types';

export function StartScreen({
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'Start'>) {
  const { state, signOut, beginCreation } = useV2App();
  const hasSession = Boolean(state.session?.accessToken);

  return (
    <Screen>
      <Title subtitle={v2Copy.startSubtitle}>{v2Copy.appTitle}</Title>
      <Card>
        <Text style={uiStyles.paragraph}>{v2Copy.startIntro}</Text>
        <Button label={v2Copy.startLink} onPress={() => navigation.navigate('Auth', { mode: 'link' })} />
        <Button
          label={v2Copy.startCreate}
          onPress={() => {
            if (hasSession) {
              beginCreation();
              navigation.navigate('Creation');
              return;
            }
            navigation.navigate('Auth', { mode: 'create' });
          }}
        />
        <Button
          label={v2Copy.startCatalog}
          variant="secondary"
          disabled={!state.catalog.length}
          onPress={() => navigation.navigate('Catalog')}
        />
        <Button label={v2Copy.startQueue} variant="ghost" onPress={() => navigation.navigate('Queue')} />
      </Card>
      <Card>
        <StatPill
          label={
            hasSession
              ? `Google: ${state.session?.email || 'авторизован'}`
              : v2Copy.googleDisabled
          }
          tone={hasSession ? 'success' : 'warning'}
        />
        {hasSession ? (
          <Button
            label="Выйти из Google"
            variant="secondary"
            onPress={() => void signOut()}
          />
        ) : null}
      </Card>
    </Screen>
  );
}

export function AuthScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'Auth'>) {
  const { state, prepareMode, importVarietyFromClipboard, beginCreation } = useV2App();

  const proceed = async () => {
    try {
      if (route.params.mode === 'create') {
        beginCreation();
        navigation.replace('Creation');
        return;
      }

      if (!state.session?.accessToken) {
        await prepareMode(route.params.mode);
      }

      if (route.params.mode === 'link') {
        await importVarietyFromClipboard();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Catalog' }],
        });
        return;
      }

    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.continueFailed,
      );
    }
  };

  return (
    <Screen>
      <Title>{route.params.mode === 'link' ? v2Copy.authLinkTitle : v2Copy.authCreateTitle}</Title>
      <Card>
        <Text style={uiStyles.paragraph}>
          {route.params.mode === 'link' ? v2Copy.authLinkBody : v2Copy.authCreateBody}
        </Text>
        <Button
          label={route.params.mode === 'link' ? v2Copy.authLinkAction : v2Copy.authCreateAction}
          onPress={() => void proceed()}
        />
        <Button label={v2Copy.back} variant="secondary" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}
