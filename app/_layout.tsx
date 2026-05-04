import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useSegments, Redirect } from 'expo-router';
import { useConfigStore } from '@/stores/configStore';

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
            <ActivityIndicator size="large" color="#fff" />
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
                        animation: 'none',
                    }}
                />
                {/* ── Bottom Tabs Group ── */}
                <Stack.Screen
                    name="(tabs)"
                    options={{
                        headerShown: false,
                        animation: 'none',
                    }}
                />
                {/* ── Modal Screens (outside tabs) ── */}
                <Stack.Screen
                    name="store"
                    options={{
                        title: 'Nuestro Local',
                        headerBackTitle: 'Volver',
                    }}
                />
                <Stack.Screen
                    name="product/[id]"
                    options={{
                        title: 'Detalle',
                        headerBackTitle: 'Volver',
                    }}
                />
                <Stack.Screen
                    name="cart"
                    options={{
                        title: '🛒 Carrito',
                        headerBackTitle: 'Volver',
                        presentation: 'modal',
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
                    name="chat"
                    options={{
                        headerShown: true,
                        title: '🤖 Asesor Virtual',
                        headerBackTitle: 'Volver',
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
        bottom: 90,
        right: 20,
        backgroundColor: '#2E7D32',
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    fabIcon: {
        fontSize: 26,
    },
});
