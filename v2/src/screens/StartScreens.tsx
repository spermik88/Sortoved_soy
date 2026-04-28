import React, { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { Button, Card, Screen, StatPill, Title, uiStyles } from '../components/Ui';
import { googleConfig } from '../config/google';
import { v2Copy } from '../config/copy';
import { useV2App } from '../context/V2AppContext';
import { V2RootStackParamList } from '../navigation/types';
import { buildGoogleSession } from '../services/authService';

WebBrowser.maybeCompleteAuthSession();

const EXPO_PROXY_REDIRECT_URI = 'https://auth.expo.io/@spermik/sortoved-soy';
const USE_EXPO_PROXY = true;

function buildExpoProxyStartUrl(authUrl: string, returnUrl: string) {
  return `${EXPO_PROXY_REDIRECT_URI}/start?${new URLSearchParams({
    authUrl,
    returnUrl,
  }).toString()}`;
}

function buildExpoProxyGoogleAuthUrl(authUrl: string, webClientId: string) {
  const url = new URL(authUrl);
  url.searchParams.set('client_id', webClientId);
  url.searchParams.set('redirect_uri', EXPO_PROXY_REDIRECT_URI);
  return url.toString();
}

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
  const [authRequested, setAuthRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: USE_EXPO_PROXY ? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID : undefined,
    androidClientId: USE_EXPO_PROXY
      ? undefined
      : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    redirectUri: USE_EXPO_PROXY ? AuthSession.getDefaultReturnUrl() : undefined,
    responseType: USE_EXPO_PROXY ? AuthSession.ResponseType.Token : undefined,
    shouldAutoExchangeCode: !USE_EXPO_PROXY,
    usePKCE: !USE_EXPO_PROXY,
    scopes: googleConfig.scopes,
  });
  const responseAuthentication =
    response?.type === 'success'
      ? (response as typeof response & { authentication?: unknown }).authentication
      : undefined;

  useEffect(() => {
    console.log('redirectUri:', request?.redirectUri);
    console.log(
      'authUrl:',
      request?.url && process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
        ? buildExpoProxyGoogleAuthUrl(request.url, process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)
        : request?.url,
    );
  }, [request?.redirectUri, request?.url]);

  useEffect(() => {
    if (response?.type === 'success') {
      console.log('SUCCESS', responseAuthentication);
    } else if (response?.type === 'error') {
      console.log('ERROR', response.error);
    }
  }, [response, responseAuthentication]);

  const finishAuthorizedFlow = async (authentication: Parameters<typeof buildGoogleSession>[0]) => {
    const session = await buildGoogleSession(authentication);

    await prepareMode(route.params.mode, session);

    if (route.params.mode === 'create') {
      beginCreation();
      navigation.replace('Creation');
      return;
    }

    await importVarietyFromClipboard();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Catalog' }],
    });
  };

  const proceed = async () => {
    try {
      if (!state.session?.accessToken) {
        if (!process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || !process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
          throw new Error('Google OAuth не настроен. Заполните EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID и EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
        }

        setAuthRequested(true);
        setSubmitting(true);

        const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
        const proxyAuthUrl = request?.url && webClientId
          ? buildExpoProxyGoogleAuthUrl(request.url, webClientId)
          : undefined;
        const proxyStartUrl = proxyAuthUrl && request?.redirectUri
          ? buildExpoProxyStartUrl(proxyAuthUrl, request.redirectUri)
          : undefined;

        const result = await promptAsync({
          useProxy: true,
          url: proxyStartUrl,
        } as Parameters<typeof promptAsync>[0] & { useProxy: true });
        if (result.type !== 'success') {
          setAuthRequested(false);
          throw new Error('Авторизация отменена или не завершена');
        }

        const authentication = result.authentication;

        await finishAuthorizedFlow(authentication as Parameters<typeof buildGoogleSession>[0]);
        return;
      }

      if (route.params.mode === 'create') {
        beginCreation();
        navigation.replace('Creation');
        return;
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
      setAuthRequested(false);
      setSubmitting(false);
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
          disabled={!request || submitting}
          onPress={() => void proceed()}
        />
        <Button label={v2Copy.back} variant="secondary" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}
