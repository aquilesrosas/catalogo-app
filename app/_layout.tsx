import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';

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
    { hasError: boolean }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) {
            return (
                <View style={errorStyles.container}>
                    <Text style={errorStyles.icon}>😵</Text>
                    <Text style={errorStyles.title}>Algo salió mal</Text>
                    <Pressable
                        style={errorStyles.button}
                        onPress={() => this.setState({ hasError: false })}
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
    },
    icon: { fontSize: 48 },
    title: { fontSize: 18, fontWeight: '600', color: '#333' },
    button: {
        backgroundColor: '#1B5E20',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    buttonText: { color: '#fff', fontWeight: '600' },
});

// ─── Root Layout ─────────────────────────────
export default function RootLayout() {
    return (
        <ErrorBoundary>
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
                    name="login"
                    options={{
                        title: 'Mi cuenta',
                        headerBackTitle: 'Volver',
                    }}
                />
            </Stack>
        </ErrorBoundary>
    );
}
