import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/services/api';

export interface CartItem {
    product: Product;
    quantity: number;
}

interface CartState {
    items: CartItem[];

    // Actions
    addItem: (product: Product, quantity?: number) => void;
    removeItem: (productId: number) => void;
    updateQuantity: (productId: number, quantity: number) => void;
    clearCart: () => void;

    // Computed (as functions — Zustand doesn't have getters)
    getItemCount: () => number;
    getTotal: () => number;
    getItem: (productId: number) => CartItem | undefined;
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],

            addItem: (product, quantity = 1) => {
                const items = get().items;
                const existingIndex = items.findIndex(
                    (i) => i.product.id_producto === product.id_producto
                );

                if (existingIndex >= 0) {
                    // Increment quantity
                    const updated = [...items];
                    updated[existingIndex] = {
                        ...updated[existingIndex],
                        quantity: updated[existingIndex].quantity + quantity,
                    };
                    set({ items: updated });
                } else {
                    // Add new item
                    set({ items: [...items, { product, quantity }] });
                }
            },

            removeItem: (productId) => {
                set({ items: get().items.filter((i) => i.product.id_producto !== productId) });
            },

            updateQuantity: (productId, quantity) => {
                if (quantity <= 0) {
                    get().removeItem(productId);
                    return;
                }
                const updated = get().items.map((i) =>
                    i.product.id_producto === productId ? { ...i, quantity } : i
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

            getItem: (productId) =>
                get().items.find((i) => i.product.id_producto === productId),
        }),
        {
            name: 'catalogo-cart',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
