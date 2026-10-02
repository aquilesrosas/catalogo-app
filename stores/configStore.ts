import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ConfigState {
    tenantSlug: string | null;
    primaryColor: string;
    kioskCategoryIds: number[];
    kioskExtraCategoryIds: number[];
    kioskTitle: string;
    showClasesTab: boolean;
    showMesaDelivery: boolean;
    showPedirComida: boolean;
    bookingMode: string;
    destacadosIds: number[];
    storeName: string;
    storeAddress: string;
    storeTimeRanges: { start: string; end: string }[];
    storeWhatsapp: string;
    storeLat: number | null;
    storeLng: number | null;
    isConfigured: () => boolean;
    setTenantSlug: (slug: string) => void;
    clearConfig: () => void;
    setKioskCategoryIds: (ids: number[]) => void;
    setKioskExtraCategoryIds: (ids: number[]) => void;
    setKioskTitle: (title: string) => void;
    setShowClasesTab: (val: boolean) => void;
    setShowMesaDelivery: (val: boolean) => void;
    setShowPedirComida: (val: boolean) => void;
    setBookingMode: (val: string) => void;
    setPrimaryColor: (color: string) => void;
    setDestacadosIds: (ids: number[]) => void;
    setStoreInfo: (name: string, address: string, timeRanges: { start: string; end: string }[], whatsapp?: string, lat?: number | null, lng?: number | null) => void;
}

export const useConfigStore = create<ConfigState>()(
    persist(
        (set, get) => ({
            tenantSlug: null,
            primaryColor: '#1B5E20',
            kioskCategoryIds: [],
            kioskExtraCategoryIds: [],
            kioskTitle: '🍔 Pedir Comida',
            showClasesTab: true,
            showMesaDelivery: true,
            showPedirComida: true,
            bookingMode: '',
            destacadosIds: [],
            storeName: '',
            storeAddress: '',
            storeTimeRanges: [],
            storeWhatsapp: '',
            storeLat: null,
            storeLng: null,
            isConfigured: () => !!get().tenantSlug,
            setTenantSlug: (slug: string) => set({ tenantSlug: slug }),
            clearConfig: () => set({ tenantSlug: null }),
            setKioskCategoryIds: (ids: number[]) => set({ kioskCategoryIds: ids }),
            setKioskExtraCategoryIds: (ids: number[]) => set({ kioskExtraCategoryIds: ids }),
            setKioskTitle: (title: string) => set({ kioskTitle: title }),
            setShowClasesTab: (val: boolean) => set({ showClasesTab: val }),
            setShowMesaDelivery: (val: boolean) => set({ showMesaDelivery: val }),
            setShowPedirComida: (val: boolean) => set({ showPedirComida: val }),
            setBookingMode: (val: string) => set({ bookingMode: val }),
            setPrimaryColor: (color: string) => set({ primaryColor: color }),
            setDestacadosIds: (ids: number[]) => set({ destacadosIds: ids }),
            setStoreInfo: (name, address, timeRanges, whatsapp = '', lat = null, lng = null) => set({ storeName: name, storeAddress: address, storeTimeRanges: timeRanges, storeWhatsapp: whatsapp, storeLat: lat, storeLng: lng }),
        }),
        {
            name: 'catalogo-config',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
