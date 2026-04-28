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

const TOKEN_EXPIRY_SKEW_MS = 5 * 60 * 1000;

function toEpochMs(value: number) {
  return value < 1000000000000 ? value * 1000 : value;
}

export function isGoogleSessionExpired(session: GoogleSession | null | undefined) {
  if (!session?.accessToken) {
    return true;
  }

  if (!session.expiresAt) {
    return true;
  }

  return toEpochMs(session.expiresAt) <= Date.now() + TOKEN_EXPIRY_SKEW_MS;
}

export function isGoogleSessionUsable(session: GoogleSession | null | undefined) {
  return Boolean(session?.accessToken && !isGoogleSessionExpired(session));
}

export function assertGoogleSessionUsable(session: GoogleSession | null | undefined) {
  if (!isGoogleSessionUsable(session)) {
    throw new Error('Сначала выполните авторизацию Google');
  }

  return session as GoogleSession;
}

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

async function isAccessTokenAccepted(accessToken: string) {
  try {
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return userInfoResponse.ok;
  } catch {
    return false;
  }
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
    if (!raw) {
      return null;
    }

    const session = JSON.parse(raw) as GoogleSession;
    if (!isGoogleSessionUsable(session) || !(await isAccessTokenAccepted(session.accessToken))) {
      await this.persistSession(null);
      return null;
    }

    return session;
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
