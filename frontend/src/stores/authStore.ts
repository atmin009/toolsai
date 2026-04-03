import { create } from "zustand";

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  hydrate: () => void;
}

const TOKEN_KEY = "zettaword_token";
const USER_KEY = "zettaword_user";

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null });
  },
  hydrate: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (!token || !raw) return;
    try {
      const user = JSON.parse(raw) as AuthUser;
      set({ token, user });
    } catch {
      localStorage.removeItem(USER_KEY);
    }
  },
}));
