import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
    token: string | null;
    clientName: string | null;
    clientPhone: string | null;
    clientId: number | null;
    clientPoints: number;

    // Computed
    isLoggedIn: () => boolean;

    // Actions
    login: (token: string, name: string, phone: string, id: number) => void;
    logout: () => void;
    setName: (name: string) => void;
    setPoints: (points: number) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            clientName: null,
            clientPhone: null,
            clientId: null,
            clientPoints: 0,

            isLoggedIn: () => !!get().token,

            login: (token, name, phone, id) =>
                set({ token, clientName: name, clientPhone: phone, clientId: id }),

            logout: () =>
                set({ token: null, clientName: null, clientPhone: null, clientId: null, clientPoints: 0 }),

            setName: (name) => set({ clientName: name }),
            setPoints: (points) => set({ clientPoints: points }),
        }),
        {
            name: 'catalogo-auth',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
