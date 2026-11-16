// One-shot flag: set when a new account is created, read once by the home page to play the welcome celebration.
const KEY = 'petal_pen_welcome_celebration';
const MAX_AGE_MS = 2 * 60 * 1000;

export const markWelcomeCelebration = () => {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage can be blocked (private mode); the celebration is purely decorative.
  }
};

export const peekWelcomeCelebration = (): boolean => {
  try {
    const stamp = Number(sessionStorage.getItem(KEY));
    return Boolean(stamp) && Date.now() - stamp < MAX_AGE_MS;
  } catch {
    return false;
  }
};

export const clearWelcomeCelebration = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
};
