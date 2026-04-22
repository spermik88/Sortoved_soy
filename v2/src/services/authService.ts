import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import { googleConfig, hasGoogleAuthConfig } from '../config/google';
import { GoogleSession } from '../types/app';

WebBrowser.maybeCompleteAuthSession();

const STORAGE_KEY = 'sortoved-soy/google-session-v2';
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export interface AuthService {
  restoreSession(): Promise<GoogleSession | null>;
  persistSession(session: GoogleSession | null): Promise<void>;
  signIn(): Promise<GoogleSession>;
  signOut(session: GoogleSession | null): Promise<void>;
}

class GoogleAuthService implements AuthService {
  async restoreSession() {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GoogleSession) : null;
  }

  async persistSession(session: GoogleSession | null) {
    if (!session) {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
      return;
    }

    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session));
  }

  async signIn() {
    if (!hasGoogleAuthConfig()) {
      throw new Error('Google OAuth не настроен. Заполните EXPO_PUBLIC_GOOGLE_* client ids.');
    }

    const clientId =
      googleConfig.expoClientId ||
      googleConfig.iosClientId ||
      googleConfig.androidClientId ||
      googleConfig.webClientId;

    const request = new AuthSession.AuthRequest({
      clientId,
      scopes: googleConfig.scopes,
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'sortovedsoy',
      }),
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    });

    const result = await request.promptAsync(discovery);
    if (result.type !== 'success' || !result.params.code) {
      throw new Error('Авторизация отменена или не завершена');
    }

    const tokenResult = await AuthSession.exchangeCodeAsync(
      {
        code: result.params.code,
        clientId,
        redirectUri: request.redirectUri,
        extraParams: {
          code_verifier: request.codeVerifier || '',
        },
      },
      discovery,
    );

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
    });
    const userInfo = (await userInfoResponse.json()) as { email?: string };

    const session: GoogleSession = {
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      expiresAt: tokenResult.issuedAt && tokenResult.expiresIn
        ? tokenResult.issuedAt + tokenResult.expiresIn
        : undefined,
      email: userInfo.email,
    };

    await this.persistSession(session);
    return session;
  }

  async signOut(session: GoogleSession | null) {
    if (session?.accessToken) {
      try {
        await fetch(`${discovery.revocationEndpoint}?token=${session.accessToken}`, {
          method: 'POST',
        });
      } catch {
        // Ignore revocation failures; local cleanup still matters.
      }
    }

    await this.persistSession(null);
  }
}

export const authService: AuthService = new GoogleAuthService();
