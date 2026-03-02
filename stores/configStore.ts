import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ConfigState {
    tenantSlug: string | null;
    isConfigured: () => boolean;
    setTenantSlug: (slug: string) => void;
    clearConfig: () => void;
}

export const useConfigStore = create<ConfigState>()(
    persist(
        (set, get) => ({
            tenantSlug: null,
            isConfigured: () => !!get().tenantSlug,
            setTenantSlug: (slug: string) => set({ tenantSlug: slug }),
            clearConfig: () => set({ tenantSlug: null }),
        }),
        {
            name: 'catalogo-config',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
