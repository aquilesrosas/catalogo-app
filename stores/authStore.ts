import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
    token: string | null;
    clientName: string | null;
    clientPhone: string | null;
    clientId: number | null;
    clientPoints: number;
    isStaff: boolean;
    loyaltyConfig: {
        is_active: boolean;
        currency_per_point: number;
        min_points_to_redeem: number;
    } | null;

    // Computed
    isLoggedIn: () => boolean;

    // Actions
    login: (token: string, name: string, phone: string, id: number, isStaff?: boolean) => void;
    logout: () => void;
    setName: (name: string) => void;
    setPoints: (points: number) => void;
    setLoyaltyConfig: (config: any) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            clientName: null,
            clientPhone: null,
            clientId: null,
            clientPoints: 0,
            isStaff: false,
            loyaltyConfig: null,

            isLoggedIn: () => !!get().token,

            login: (token, name, phone, id, isStaff = false) =>
                set({ token, clientName: name, clientPhone: phone, clientId: id, isStaff }),

            logout: () =>
                set({ token: null, clientName: null, clientPhone: null, clientId: null, clientPoints: 0, isStaff: false }),

            setName: (name) => set({ clientName: name }),
            setPoints: (points) => set({ clientPoints: points }),
            setLoyaltyConfig: (config) => set({ loyaltyConfig: config }),
        }),
        {
            name: 'catalogo-auth',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
