import { create } from 'zustand';

// ─── Types ─────────────────────────────────────
export interface KioskCartItem {
    uniqueId: number;
    product: any;
    quantity: number;
    notes: string;
    unitPrice: number;
    total: number;
}

export interface KioskClient {
    id: number;
    name: string;
    phone: string;
    points?: number;
    total_orders?: number;
}

export type CheckoutStep = 'identify' | 'register' | 'payment';

interface KioskState {
    // Cart
    cart: KioskCartItem[];
    addToCart: (product: any, quantity: number, notes: string) => void;
    removeFromCart: (uniqueId: number) => void;
    clearCart: () => void;
    getCartTotal: () => number;
    getCartCount: () => number;

    // Builder Modal
    builderProduct: any | null;
    builderVisible: boolean;
    openBuilder: (product: any) => void;
    closeBuilder: () => void;

    // Checkout Flow
    checkoutVisible: boolean;
    checkoutStep: CheckoutStep;
    selectedClient: KioskClient | null;
    selectedPaymentMethodId: number | null;
    orderProcessing: boolean;

    startCheckout: () => void;
    closeCheckout: () => void;
    setCheckoutStep: (step: CheckoutStep) => void;
    setSelectedClient: (client: KioskClient | null) => void;
    setSelectedPaymentMethodId: (id: number) => void;
    setOrderProcessing: (val: boolean) => void;

    // Auto-reset timer
    lastInteraction: number;
    touchInteraction: () => void;

    // Full reset
    resetKiosk: () => void;
}

export const useKioskStore = create<KioskState>((set, get) => ({
    // ─── Cart ─────────────────────────────────
    cart: [],

    addToCart: (product, quantity, notes) => {
        const unitPrice = parseFloat(product.price || product.precio_venta || '0');
        const total = unitPrice * quantity;
        const item: KioskCartItem = {
            uniqueId: Date.now() + Math.random(),
            product,
            quantity,
            notes,
            unitPrice,
            total,
        };
        set((s) => ({ cart: [...s.cart, item], lastInteraction: Date.now() }));
    },

    removeFromCart: (uniqueId) => {
        set((s) => ({
            cart: s.cart.filter((i) => i.uniqueId !== uniqueId),
            lastInteraction: Date.now(),
        }));
    },

    clearCart: () => set({ cart: [] }),

    getCartTotal: () => get().cart.reduce((sum, i) => sum + i.total, 0),

    getCartCount: () => get().cart.reduce((sum, i) => sum + i.quantity, 0),

    // ─── Builder ──────────────────────────────
    builderProduct: null,
    builderVisible: false,

    openBuilder: (product) =>
        set({ builderProduct: product, builderVisible: true, lastInteraction: Date.now() }),

    closeBuilder: () =>
        set({ builderProduct: null, builderVisible: false }),

    // ─── Checkout ─────────────────────────────
    checkoutVisible: false,
    checkoutStep: 'identify',
    selectedClient: null,
    selectedPaymentMethodId: null,
    orderProcessing: false,

    startCheckout: () =>
        set({
            checkoutVisible: true,
            checkoutStep: 'identify',
            selectedClient: null,
            selectedPaymentMethodId: null,
            lastInteraction: Date.now(),
        }),

    closeCheckout: () =>
        set({ checkoutVisible: false }),

    setCheckoutStep: (step) =>
        set({ checkoutStep: step, lastInteraction: Date.now() }),

    setSelectedClient: (client) =>
        set({ selectedClient: client, lastInteraction: Date.now() }),

    setSelectedPaymentMethodId: (id) =>
        set({ selectedPaymentMethodId: id, lastInteraction: Date.now() }),

    setOrderProcessing: (val) =>
        set({ orderProcessing: val }),

    // ─── Auto Reset ───────────────────────────
    lastInteraction: Date.now(),

    touchInteraction: () =>
        set({ lastInteraction: Date.now() }),

    resetKiosk: () =>
        set({
            cart: [],
            builderProduct: null,
            builderVisible: false,
            checkoutVisible: false,
            checkoutStep: 'identify',
            selectedClient: null,
            selectedPaymentMethodId: null,
            orderProcessing: false,
            lastInteraction: Date.now(),
        }),
}));
