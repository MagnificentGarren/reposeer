/**
 * Retrieves the existing session UUID from localStorage or generates
 * a new crypto-random UUID if none exists.
 */
export const getOrCreateSessionId = (): string => {
  // Ensure this only runs on the client browser
  if (typeof window === 'undefined') return '';

  const STORAGE_KEY = 'reposeer_session_id';
  let sessionId = localStorage.getItem(STORAGE_KEY);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, sessionId);
  }

  return sessionId;
};