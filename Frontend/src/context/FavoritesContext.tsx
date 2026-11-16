import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { eventTracker } from '../services/eventTracker';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface FavoritesContextType {
  favorites: string[];
  handleToggleFavorite: (productId: string) => void;
  /** Removes a favourite. Pass `serverAlreadyUpdated` when the caller already deleted it on the server. */
  removeFavorite: (productId: string, options?: { serverAlreadyUpdated?: boolean }) => void;
}

const STORAGE_KEY = 'petal_pen_favorites';
// Which account the stored favourites belong to ('' = saved as a guest). Stops one person's list leaking into another's account.
const OWNER_KEY = 'petal_pen_favorites_owner';

const readStoredFavorites = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

const readOwner = (): string => {
  try {
    return localStorage.getItem(OWNER_KEY) || '';
  } catch {
    return '';
  }
};

const writeOwner = (owner: string) => {
  try {
    if (owner) localStorage.setItem(OWNER_KEY, owner);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    // Storage can be blocked; syncing still works for this session.
  }
};

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { loggedInUser } = useAuth();
  const userId = loggedInUser?.id ?? null;

  const [favorites, setFavorites] = useState<string[]>(readStoredFavorites);
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;
  const hadUserRef = useRef(Boolean(userId));

  // Local copy: instant UI, and the whole list for guests
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // Private browsing can block storage; favourites still work for this session.
    }
  }, [favorites]);

  // Logged in: load the account's saved list and merge in anything saved as a guest.
  // Logged out: clear the list so the next person on this browser starts fresh.
  useEffect(() => {
    if (!userId) {
      if (hadUserRef.current) {
        setFavorites([]);
        writeOwner('');
      }
      hadUserRef.current = false;
      return;
    }
    hadUserRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const rows = await api.getUserWishlist(userId);
        const serverIds: string[] = rows
          .map((row: { product_id?: string }) => row.product_id)
          .filter((id: unknown): id is string => typeof id === 'string');

        // Favourites saved by someone else's account are dropped; guest ones (no owner) are merged in
        const owner = readOwner();
        const local = !owner || owner === userId ? favoritesRef.current : [];
        const localOnly = local.filter((id) => !serverIds.includes(id));

        if (!cancelled) {
          setFavorites([...new Set([...serverIds, ...local])]);
          writeOwner(userId);
        }
        if (localOnly.length > 0) await api.addToWishlist(userId, localOnly);
      } catch (err: any) {
        console.warn('Could not sync wishlist:', err?.message || err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const syncToServer = useCallback(
    (productId: string, add: boolean) => {
      if (!userId) return;
      const request = add ? api.addToWishlist(userId, [productId]) : api.removeFromWishlist(userId, productId);
      request.catch((err: any) => {
        console.warn(`Could not ${add ? 'save to' : 'remove from'} wishlist:`, err?.message || err);
        // Undo the optimistic change so the heart never claims something that was not saved
        setFavorites((prev) =>
          add ? prev.filter((id) => id !== productId) : prev.includes(productId) ? prev : [...prev, productId]
        );
      });
    },
    [userId]
  );

  const handleToggleFavorite = useCallback(
    (productId: string) => {
      const willAdd = !favoritesRef.current.includes(productId);
      setFavorites((prev) =>
        willAdd ? (prev.includes(productId) ? prev : [...prev, productId]) : prev.filter((id) => id !== productId)
      );
      if (willAdd) {
        eventTracker.trackWishlistAdd({
          id: productId,
          name: 'Saved gift item',
        });
      }
      syncToServer(productId, willAdd);
    },
    [syncToServer]
  );

  const removeFavorite = useCallback(
    (productId: string, options?: { serverAlreadyUpdated?: boolean }) => {
      setFavorites((prev) => prev.filter((id) => id !== productId));
      if (!options?.serverAlreadyUpdated) syncToServer(productId, false);
    },
    [syncToServer]
  );

  return (
    <FavoritesContext.Provider value={{ favorites, handleToggleFavorite, removeFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};
