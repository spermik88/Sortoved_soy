import * as SecureStore from 'expo-secure-store';

import { GoogleSession } from '../types/app';

const STORAGE_KEY = 'sortoved-soy.google-session-v2';
const revocationEndpoint = 'https://oauth2.googleapis.com/revoke';

export type GoogleAuthenticationResult = {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresIn?: number | null;
  issuedAt?: number | null;
};

async function fetchGoogleEmail(accessToken: string) {
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userInfoResponse.ok) {
    return undefined;
  }

  const userInfo = (await userInfoResponse.json()) as { email?: string };
  return userInfo.email;
}

export async function buildGoogleSession(
  authentication: GoogleAuthenticationResult | null | undefined,
): Promise<GoogleSession> {
  if (!authentication?.accessToken) {
    throw new Error('Google authorization did not return an access token');
  }

  return {
    accessToken: authentication.accessToken,
    refreshToken: authentication.refreshToken || undefined,
    expiresAt: authentication.issuedAt && authentication.expiresIn
      ? authentication.issuedAt + authentication.expiresIn
      : undefined,
    email: await fetchGoogleEmail(authentication.accessToken),
  };
}

export interface AuthService {
  restoreSession(): Promise<GoogleSession | null>;
  persistSession(session: GoogleSession | null): Promise<void>;
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

  async signOut(session: GoogleSession | null) {
    if (session?.accessToken) {
      try {
        await fetch(`${revocationEndpoint}?token=${session.accessToken}`, {
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
