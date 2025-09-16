import { atom } from 'jotai';
import { User, AuthState } from '@/types';

export const authAtom = atom<AuthState>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
});

export const userAtom = atom(
  (get) => get(authAtom).user,
  (get, set, user: User | null) => {
    set(authAtom, {
      user,
      isAuthenticated: !!user,
      isLoading: false,
    });
  }
);