import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ConfigState {
    tenantSlug: string | null;
    // Kiosk config: which category IDs to show (empty = show all)
    kioskCategoryIds: number[];
    // Kiosk config: which categories act as Aderezos/Extras
    kioskExtraCategoryIds: number[];
    kioskTitle: string;
    // Catalog feature flags (from server catalog_config)
    showClasesTab: boolean;
    showMesaDelivery: boolean;
    // '' = catálogo de productos normal | 'dance' = academia de baile
    bookingMode: string;
    isConfigured: () => boolean;
    setTenantSlug: (slug: string) => void;
    clearConfig: () => void;
    setKioskCategoryIds: (ids: number[]) => void;
    setKioskExtraCategoryIds: (ids: number[]) => void;
    setKioskTitle: (title: string) => void;
    setShowClasesTab: (val: boolean) => void;
    setShowMesaDelivery: (val: boolean) => void;
    setBookingMode: (val: string) => void;
}

export const useConfigStore = create<ConfigState>()(
    persist(
        (set, get) => ({
            tenantSlug: null,
            kioskCategoryIds: [],
            kioskExtraCategoryIds: [],
            kioskTitle: '🍔 Pedir Comida',
            showClasesTab: true,
            showMesaDelivery: true,
            bookingMode: '',
            isConfigured: () => !!get().tenantSlug,
            setTenantSlug: (slug: string) => set({ tenantSlug: slug }),
            clearConfig: () => set({ tenantSlug: null }),
            setKioskCategoryIds: (ids: number[]) => set({ kioskCategoryIds: ids }),
            setKioskExtraCategoryIds: (ids: number[]) => set({ kioskExtraCategoryIds: ids }),
            setKioskTitle: (title: string) => set({ kioskTitle: title }),
            setShowClasesTab: (val: boolean) => set({ showClasesTab: val }),
            setShowMesaDelivery: (val: boolean) => set({ showMesaDelivery: val }),
            setBookingMode: (val: string) => set({ bookingMode: val }),
        }),
        {
            name: 'catalogo-config',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
