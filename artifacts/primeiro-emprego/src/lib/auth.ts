export type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

export type AuthSession = {
  access_token: string;
  refresh_token?: string;
  user: AuthUser;
};

const ACCESS_TOKEN_KEY = 'primeiro-emprego.access-token';
const USER_KEY = 'primeiro-emprego.user';
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const apiBaseUrl = ((import.meta.env.VITE_API_URL as string | undefined) || '').replace(/\/+$/, '');

export const hasSupabaseAuth = Boolean(supabaseUrl && supabaseAnonKey);
export const hasBackendAuth = Boolean(apiBaseUrl);

function saveSession(session: AuthSession | null) {
  if (!session) {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    return;
  }
  sessionStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}

export function clearSession() {
  saveSession(null);
}

async function supabaseRequest(path: string, body: Record<string, unknown>) {
  if (!hasSupabaseAuth) return null;
  const response = await fetch(`${supabaseUrl}${path}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload?.msg === 'string'
        ? payload.msg
        : typeof payload?.error_description === 'string'
          ? payload.error_description
          : 'Não foi possível concluir o acesso.',
    );
  }
  return payload as AuthSession & { user: AuthUser };
}

export async function signIn(email: string, password: string): Promise<AuthSession | null> {
  const session = await supabaseRequest('/auth/v1/token?grant_type=password', { email, password });
  if (session) {
    saveSession(session);
    return session;
  }
  const payload = await backendRequest('/api/auth/login', { email, password });
  if (payload.session?.access_token) {
    saveSession(payload.session);
    return payload.session as AuthSession;
  }
  return null;
}

export async function signOut() {
  const token = getAccessToken();
  if (apiBaseUrl && token) {
    await fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    }).catch(() => undefined);
  }
  if (hasSupabaseAuth && token) {
    await fetch(`${supabaseUrl}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: supabaseAnonKey!, Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
  clearSession();
}

function apiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

async function backendRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Não foi possível concluir o acesso.');
  }
  return payload;
}

export async function checkFirstAccess(email: string): Promise<{
  eligible: boolean;
  firstAccess?: boolean;
  needsPassword?: boolean;
  demo?: boolean;
}> {
  if (!apiBaseUrl && !hasSupabaseAuth) return { eligible: true, firstAccess: true, demo: true };
  return backendRequest('/api/auth/first-access/check', { email });
}

export async function completeFirstAccess(
  email: string,
  password: string,
  name: string,
): Promise<{ session?: AuthSession; demo?: boolean }> {
  if (!apiBaseUrl && !hasSupabaseAuth) return { demo: true };
  const payload = await backendRequest('/api/auth/first-access/complete', { email, password, name });
  if (payload.session?.access_token) saveSession(payload.session);
  return payload;
}

export async function startCheckout(name: string, email: string): Promise<string> {
  if (!apiBaseUrl) {
    throw new Error('Não foi possível abrir a etapa de pagamento agora. Tente novamente em instantes.');
  }
  const payload = await backendRequest('/api/checkout/start', { name, email });
  if (typeof payload.checkout_url !== 'string' || !/^(https?:\/\/|\/)/i.test(payload.checkout_url)) {
    throw new Error('Não foi possível abrir a etapa de pagamento agora. Tente novamente em instantes.');
  }
  return payload.checkout_url;
}