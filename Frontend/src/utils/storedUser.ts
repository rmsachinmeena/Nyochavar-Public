import type { User } from '../types';

export const STORED_USER_KEY = 'petal_pen_current_user';

/**
 * Only what is needed to know "who is signed in" is kept in the browser. Phone, addresses and the rest of the
 * profile live in memory and are loaded from the server, so a stolen localStorage (XSS, shared computer) leaks little.
 */
export const saveStoredUser = (user: User | null) => {
  try {
    if (!user) {
      localStorage.removeItem(STORED_USER_KEY);
      return;
    }
    const { id, name, email, role, is_verified } = user;
    localStorage.setItem(STORED_USER_KEY, JSON.stringify({ id, name, email, role, is_verified }));
  } catch {
    /* storage unavailable */
  }
};

export const readStoredUser = (): User | null => {
  try {
    const saved = localStorage.getItem(STORED_USER_KEY);
    const user = saved ? JSON.parse(saved) : null;
    return user && user.id ? (user as User) : null;
  } catch {
    return null;
  }
};
