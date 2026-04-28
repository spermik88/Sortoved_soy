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
import { buildGoogleSession, isGoogleSessionUsable } from '../services/authService';

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

function parseAuthenticationFromUrl(url: string): Parameters<typeof buildGoogleSession>[0] {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  if (parsed.hash) {
    const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    hashParams.forEach((value, key) => params.set(key, value));
  }

  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    expiresIn: params.get('expires_in') ? Number(params.get('expires_in')) : undefined,
    issuedAt: Math.floor(Date.now() / 1000),
  };
}

export function StartScreen({
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'Start'>) {
  const { state, signOut, beginCreation } = useV2App();
  const hasSession = isGoogleSessionUsable(state.session);

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

    if (route.params.mode === 'resumeCreation') {
      navigation.replace('CreationCloudSync');
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
      const shouldAuthorize = Boolean(route.params.force) || !isGoogleSessionUsable(state.session);
      if (shouldAuthorize) {
        if (!process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || !process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
          throw new Error('Google OAuth не настроен. Заполните EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID и EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
        }
        setSubmitting(true);

        const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
        const proxyAuthUrl = request?.url && webClientId
          ? buildExpoProxyGoogleAuthUrl(request.url, webClientId)
          : undefined;
        const proxyStartUrl = proxyAuthUrl && request?.redirectUri
          ? buildExpoProxyStartUrl(proxyAuthUrl, request.redirectUri)
          : undefined;
        console.log('[Auth] start', {
          mode: route.params.mode,
          redirectUri: request?.redirectUri,
          proxyStartUrl,
        });
        if (!proxyStartUrl || !request?.redirectUri) {
          throw new Error('Google OAuth request is not ready. Попробуйте нажать еще раз.');
        }

        const result = USE_EXPO_PROXY
          ? await WebBrowser.openAuthSessionAsync(proxyStartUrl, request.redirectUri)
          : await promptAsync({ useProxy: true } as Parameters<typeof promptAsync>[0] & { useProxy: true });
        console.log('[Auth] result', result);
        if (result.type !== 'success') {
          throw new Error('Авторизация отменена или не завершена');
        }

        const authentication = 'authentication' in result
          ? result.authentication
          : parseAuthenticationFromUrl(result.url);

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
