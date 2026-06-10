/**
 * lastOrderStore — almacena temporalmente los datos del último pedido realizado.
 * NO persiste en AsyncStorage (solo en memoria) para que se limpie al cerrar la app.
 * Se usa para mostrar la pantalla de confirmación post-checkout.
 */
import { create } from 'zustand';

export interface LastOrderItem {
    name_snapshot: string;
    quantity: string;
    subtotal_final: string;
    unit_snapshot: string;
}

export interface LastOrderData {
    id: number;
    order_number: number | null;
    total: string;
    payment_method: string;
    delivery_type: string;
    direccion_envio: string;
    is_scheduled: boolean;
    scheduled_at: string | null;
    items: LastOrderItem[];
    created_at: string;
    points_redeemed: number;
    points_discount: string;
}

interface LastOrderState {
    order: LastOrderData | null;
    setOrder: (order: LastOrderData) => void;
    clearOrder: () => void;
}

export const useLastOrderStore = create<LastOrderState>()((set) => ({
    order: null,
    setOrder: (order) => set({ order }),
    clearOrder: () => set({ order: null }),
}));
