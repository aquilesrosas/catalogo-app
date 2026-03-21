import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/services/api';

export interface CartItem {
    cartItemId: string; // Unique ID for the line item (product + extras combo)
    product: Product;
    quantity: number;
    extras_ids?: number[];
    description?: string;
}

interface CartState {
    items: CartItem[];

    // Actions
    addItem: (product: Product, quantity?: number, extras_ids?: number[], description?: string) => void;
    removeItem: (cartItemId: string) => void;
    updateQuantity: (cartItemId: string, quantity: number) => void;
    clearCart: () => void;

    // Computed (as functions — Zustand doesn't have getters)
    getItemCount: () => number;
    getTotal: () => number;
    getItem: (cartItemId: string) => CartItem | undefined;
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],

            addItem: (product, quantity = 1, extras_ids = [], description = '') => {
                const items = get().items;
                const cartItemId = `${product.id_producto}-${extras_ids.sort().join(',')}-${description}`;
                
                const existingIndex = items.findIndex(
                    (i) => i.cartItemId === cartItemId
                );

                if (existingIndex >= 0) {
                    const updated = [...items];
                    updated[existingIndex] = {
                        ...updated[existingIndex],
                        quantity: updated[existingIndex].quantity + quantity,
                    };
                    set({ items: updated });
                } else {
                    set({ items: [...items, { cartItemId, product, quantity, extras_ids, description }] });
                }
            },

            removeItem: (cartItemId) => {
                set({ items: get().items.filter((i) => i.cartItemId !== cartItemId) });
            },

            updateQuantity: (cartItemId, quantity) => {
                if (quantity <= 0) {
                    get().removeItem(cartItemId);
                    return;
                }
                const updated = get().items.map((i) =>
                    i.cartItemId === cartItemId ? { ...i, quantity } : i
                );
                set({ items: updated });
            },

            clearCart: () => set({ items: [] }),

            getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

            getTotal: () =>
                get().items.reduce((sum, i) => {
                    const price = parseFloat(i.product.price || (i.product as any).precio_venta) || 0;
                    return sum + price * i.quantity;
                }, 0),

            getItem: (cartItemId) =>
                get().items.find((i) => i.cartItemId === cartItemId),
        }),
        {
            name: 'catalogo-cart',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
