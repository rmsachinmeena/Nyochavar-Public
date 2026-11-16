import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { CartItem } from '../types';
import { eventTracker } from '../services/eventTracker';
import { useAuth } from './AuthContext';

export const MAX_QTY_PER_PRODUCT = 5;

interface CartContextType {
  cart: CartItem[];
  cartTotalCount: number;
  cartSubtotal: number;
  handleAddToCart: (newItem: Omit<CartItem, 'id'>) => boolean;
  handleUpdateQuantity: (id: string, delta: number) => boolean;
  handleRemoveCartItem: (id: string) => void;
  handleClearCart: () => void;
  getItemQuantityInCart: (productId: string) => number;
}

const STORAGE_KEY = 'petal_pen_cart';

const readStoredCart = (): CartItem[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.id === 'string' && item.quantity > 0)
      : [];
  } catch {
    return [];
  }
};

const addonSignature = (item: Omit<CartItem, 'id'>) =>
  (item.addons ?? [])
    .map((addon) => addon.id)
    .sort()
    .join('|');

// Items only stack when the design and every customisation match, so two designs
// of one product, or two hampers with different letters, never collapse into one line.
const hasSameConfiguration = (a: Omit<CartItem, 'id'>, b: Omit<CartItem, 'id'>) =>
  a.productId === b.productId &&
  (a.variant?.id ?? '') === (b.variant?.id ?? '') &&
  (a.selectedHue ?? '') === (b.selectedHue ?? '') &&
  (a.message ?? '') === (b.message ?? '') &&
  (a.palette ?? '') === (b.palette ?? '') &&
  (a.customPhoto ?? '') === (b.customPhoto ?? '') &&
  addonSignature(a) === addonSignature(b);

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(readStoredCart);
  const { loggedInUser } = useAuth();

  // Signing out empties the cart, so the next person on this device never sees it. A guest's own cart is left alone:
  // it only clears when a signed-in shopper becomes signed-out.
  const wasSignedIn = useRef(Boolean(loggedInUser));
  useEffect(() => {
    const signedIn = Boolean(loggedInUser);
    if (wasSignedIn.current && !signedIn) setCart([]);
    wasSignedIn.current = signedIn;
  }, [loggedInUser]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Storage can be full (large photo uploads) or blocked; the in-memory cart keeps working.
    }
  }, [cart]);

  const getItemQuantityInCart = (productId: string) => {
    return cart
      .filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleAddToCart = (newItem: Omit<CartItem, 'id'>): boolean => {
    let success = true;
    setCart((prev) => {
      const currentQty = prev
        .filter((item) => item.productId === newItem.productId)
        .reduce((sum, item) => sum + item.quantity, 0);

      if (currentQty >= MAX_QTY_PER_PRODUCT) {
        success = false;
        return prev;
      }

      const allowedAdd = Math.min(newItem.quantity, MAX_QTY_PER_PRODUCT - currentQty);
      if (allowedAdd <= 0) {
        success = false;
        return prev;
      }

      const existing = prev.find((item) => hasSameConfiguration(item, newItem));
      if (existing) {
        return prev.map((item) =>
          item.id === existing.id ? { ...item, quantity: item.quantity + allowedAdd } : item
        );
      }
      return [...prev, { ...newItem, quantity: allowedAdd, id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }];
    });
    if (success) {
      eventTracker.trackAddToCart({
        productId: newItem.productId,
        name: newItem.name || 'Gift item',
        price: newItem.price,
        quantity: newItem.quantity || 1,
        has_custom_message: Boolean(newItem.message && newItem.message.trim()),
        selected_hue: newItem.selectedHue,
        addons_count: (newItem.addons || []).length,
      });
    }
    return success;
  };

  const handleUpdateQuantity = (id: string, delta: number): boolean => {
    let success = true;
    setCart((prev) => {
      const targetItem = prev.find((item) => item.id === id);
      if (!targetItem) return prev;

      if (delta > 0) {
        const currentQty = prev
          .filter((item) => item.productId === targetItem.productId)
          .reduce((sum, item) => sum + item.quantity, 0);

        if (currentQty + delta > MAX_QTY_PER_PRODUCT) {
          success = false;
          return prev;
        }
      }

      return prev.map((item) => {
        if (item.id === id) {
          const nextQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: nextQty };
        }
        return item;
      });
    });
    return success;
  };

  const handleRemoveCartItem = (id: string) => {
    const itemToRemove = cart.find((item) => item.id === id);
    if (itemToRemove) {
      eventTracker.trackRemoveFromCart({
        productId: itemToRemove.productId,
        name: itemToRemove.name || 'Gift item',
        price: itemToRemove.price,
      });
    }
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const cartTotalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        cartTotalCount,
        cartSubtotal,
        handleAddToCart,
        handleUpdateQuantity,
        handleRemoveCartItem,
        handleClearCart,
        getItemQuantityInCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
