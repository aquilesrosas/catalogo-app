import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useSegments, Redirect } from 'expo-router';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';

// ─── Cart Badge ──────────────────────────────
function CartBadge() {
    const count = useCartStore((s) => s.getItemCount());
    const router = useRouter();

    return (
        <Pressable onPress={() => router.push('/cart')} style={headerStyles.cartBtn}>
            <Text style={headerStyles.cartIcon}>🛒</Text>
            {count > 0 && (
                <View style={headerStyles.badge}>
                    <Text style={headerStyles.badgeText}>
                        {count > 99 ? '99+' : count}
                    </Text>
                </View>
            )}
        </Pressable>
    );
}

// ─── Profile Button ──────────────────────────
function ProfileButton() {
    const { isLoggedIn, clientName } = useAuthStore();
    const router = useRouter();
    const initial = isLoggedIn() && clientName ? clientName[0].toUpperCase() : null;

    return (
        <Pressable onPress={() => router.push('/login')} style={headerStyles.profileBtn}>
            {initial ? (
                <View style={headerStyles.profileCircle}>
                    <Text style={headerStyles.profileInitial}>{initial}</Text>
                </View>
            ) : (
                <Text style={headerStyles.profileIcon}>👤</Text>
            )}
        </Pressable>
    );
}

const headerStyles = StyleSheet.create({
    cartBtn: {
        paddingRight: 8,
        position: 'relative',
    },
    cartIcon: {
        fontSize: 22,
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: 0,
        backgroundColor: '#FF5722',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '800',
    },
    profileBtn: {
        paddingLeft: 6,
        paddingRight: 4,
    },
    profileCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileInitial: {
        color: '#1B5E20',
        fontSize: 15,
        fontWeight: '800',
    },
    profileIcon: {
        fontSize: 20,
    },
});

// ─── Error Boundary ──────────────────────────
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; errorMsg: string }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, errorMsg: '' };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, errorMsg: error?.message || 'Error desconocido' };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('ErrorBoundary caught:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <View style={errorStyles.container}>
                    <Text style={errorStyles.icon}>😵</Text>
                    <Text style={errorStyles.title}>Algo salió mal</Text>
                    <Text style={errorStyles.detail}>{this.state.errorMsg}</Text>
                    <Pressable
                        style={errorStyles.button}
                        onPress={() => this.setState({ hasError: false, errorMsg: '' })}
                    >
                        <Text style={errorStyles.buttonText}>Reintentar</Text>
                    </Pressable>
                </View>
            );
        }
        return this.props.children;
    }
}

const errorStyles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        gap: 16,
        padding: 24,
    },
    icon: { fontSize: 48 },
    title: { fontSize: 18, fontWeight: '600', color: '#333' },
    detail: { fontSize: 13, color: '#888', textAlign: 'center', maxWidth: 300 },
    button: {
        backgroundColor: '#1B5E20',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    buttonText: { color: '#fff', fontWeight: '600' },
});

// ─── Hydration Loading Screen ────────────────
function HydrationLoading() {
    return (
        <View style={hydrationStyles.container}>
            <ActivityIndicator size="large" color="#1B5E20" />
            <Text style={hydrationStyles.text}>Cargando...</Text>
        </View>
    );
}

const hydrationStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1B5E20',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    text: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

// ─── Root Layout ─────────────────────────────
export default function RootLayout() {
    const [hasHydrated, setHasHydrated] = useState(false);

    useEffect(() => {
        // Wait for all persisted stores to hydrate
        const unsub = useConfigStore.persist.onFinishHydration(() => {
            setHasHydrated(true);
        });

        // If already hydrated (fast path)
        if (useConfigStore.persist.hasHydrated()) {
            setHasHydrated(true);
        }

        return () => {
            if (typeof unsub === 'function') unsub();
        };
    }, []);

    if (!hasHydrated) {
        return <HydrationLoading />;
    }

    return (
        <ErrorBoundary>
            <RootLayoutContent />
        </ErrorBoundary>
    );
}

function RootLayoutContent() {
    const isConfigured = useConfigStore((s) => s.isConfigured());
    const segments = useSegments();
    const router = useRouter();

    // Redirect to config_setup if not configured
    if (!isConfigured && segments[0] !== 'config_setup') {
        return <Redirect href="/config_setup" />;
    }

    return (
        <>
            <StatusBar style="light" />
            <Stack
                screenOptions={{
                    headerStyle: { backgroundColor: '#1B5E20' },
                    headerTintColor: '#fff',
                    headerTitleStyle: { fontWeight: '700' },
                    contentStyle: { backgroundColor: '#FAFAFA' },
                }}
            >
                <Stack.Screen
                    name="config_setup"
                    options={{
                        headerShown: false,
                        gestureEnabled: false,
                    }}
                />
                <Stack.Screen
                    name="index"
                    options={{
                        title: 'Catálogo',
                        headerRight: () => (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <CartBadge />
                                <ProfileButton />
                            </View>
                        ),
                    }}
                />
                <Stack.Screen
                    name="product/[id]"
                    options={{
                        title: 'Detalle',
                        headerBackTitle: 'Volver',
                        headerRight: () => <CartBadge />,
                    }}
                />
                <Stack.Screen
                    name="cart"
                    options={{
                        title: '🛒 Carrito',
                        headerBackTitle: 'Volver',
                    }}
                />
                <Stack.Screen
                    name="checkout"
                    options={{
                        title: 'Confirmar pedido',
                        headerBackTitle: 'Carrito',
                    }}
                />
                <Stack.Screen
                    name="orders"
                    options={{
                        title: 'Mis Pedidos',
                        headerBackTitle: 'Volver',
                    }}
                />
                <Stack.Screen
                    name="ofertas"
                    options={{
                        headerShown: false,
                    }}
                />
                <Stack.Screen
                    name="login"
                    options={{
                        title: 'Mi cuenta',
                        headerBackTitle: 'Volver',
                    }}
                />
                <Stack.Screen
                    name="chat"
                    options={{
                        headerShown: true,
                        title: '🤖 Asesor Virtual',
                        headerBackTitle: 'Catálogo',
                    }}
                />
                <Stack.Screen
                    name="kiosk"
                    options={{
                        headerShown: false,
                        gestureEnabled: false,
                    }}
                />
            </Stack>

            {/* Global FAB Asesor Virtual */}
            {isConfigured && segments[0] !== 'config_setup' && segments[0] !== 'chat' && segments[0] !== 'kiosk' && (
                <Pressable
                    onPress={() => router.push('/chat')}
                    style={fabStyles.fabContainer}
                >
                    <Text style={fabStyles.fabIcon}>🤖</Text>
                </Pressable>
            )}
        </>
    );
}

const fabStyles = StyleSheet.create({
    fabContainer: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        backgroundColor: '#2E7D32',
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    fabIcon: {
        fontSize: 30,
    },
});
