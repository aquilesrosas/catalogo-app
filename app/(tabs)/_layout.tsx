import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';

// ─── Custom Tab Bar ──────────────────────────
function CustomTabBar({ state, descriptors, navigation }: any) {
    const count = useCartStore((s) => s.getItemCount());
    const router = useRouter();
    const insets = useSafeAreaInsets();

    return (
        <View style={[tabBarStyles.container, { paddingBottom: insets.bottom }]}>
            <View style={tabBarStyles.bar}>
                {state.routes.map((route: any, index: number) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;

                    // ── Cart Button (center) ──
                    if (route.name === '_cart_placeholder') {
                        return (
                            <Pressable
                                key={route.key}
                                style={tabBarStyles.cartButton}
                                onPress={() => router.push('/cart')}
                            >
                                <View style={tabBarStyles.cartCircle}>
                                    <Text style={tabBarStyles.cartIcon}>🛒</Text>
                                    {count > 0 && (
                                        <View style={tabBarStyles.cartBadge}>
                                            <Text style={tabBarStyles.cartBadgeText}>
                                                {count > 99 ? '99+' : count}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </Pressable>
                        );
                    }

                    const icon = options.tabBarIcon;
                    const label = options.tabBarLabel || options.title || route.name;

                    return (
                        <Pressable
                            key={route.key}
                            style={tabBarStyles.tab}
                            onPress={() => {
                                const event = navigation.emit({
                                    type: 'tabPress',
                                    target: route.key,
                                    canPreventDefault: true,
                                });
                                if (!isFocused && !event.defaultPrevented) {
                                    navigation.navigate(route.name);
                                }
                            }}
                        >
                            {icon && icon({ focused: isFocused, color: isFocused ? '#1B5E20' : '#999', size: 24 })}
                            <Text style={[
                                tabBarStyles.tabLabel,
                                isFocused && tabBarStyles.tabLabelActive,
                            ]}>
                                {label}
                            </Text>
                            {isFocused && <View style={tabBarStyles.activeIndicator} />}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

// ─── Tab Icons ───────────────────────────────
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
    return (
        <Text style={{ fontSize: focused ? 24 : 22, opacity: focused ? 1 : 0.6 }}>
            {emoji}
        </Text>
    );
}

// ─── Tabs Layout ─────────────────────────────
export default function TabsLayout() {
    const { isLoggedIn, clientName } = useAuthStore();
    const initial = isLoggedIn() && clientName ? clientName[0].toUpperCase() : null;

    return (
        <Tabs
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{
                headerStyle: { backgroundColor: '#1B5E20' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: '700' },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Catálogo',
                    tabBarLabel: 'Inicio',
                    tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
                    headerRight: () => null, // Clean header — cart is in tab bar
                }}
            />
            <Tabs.Screen
                name="ofertas"
                options={{
                    title: '🔥 Promos',
                    tabBarLabel: 'Promos',
                    tabBarIcon: ({ focused }) => <TabIcon emoji="🏷️" focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="_cart_placeholder"
                options={{
                    title: 'Carrito',
                    tabBarLabel: '',
                    // This screen never renders — the tab button opens /cart modal
                }}
                listeners={{
                    tabPress: (e) => {
                        e.preventDefault(); // Never navigate to this fake screen
                    },
                }}
            />
            <Tabs.Screen
                name="orders"
                options={{
                    title: 'Mis Pedidos',
                    tabBarLabel: 'Pedidos',
                    tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Mi Cuenta',
                    tabBarLabel: 'Perfil',
                    tabBarIcon: ({ focused }) => (
                        initial ? (
                            <View style={{
                                width: 28, height: 28, borderRadius: 14,
                                backgroundColor: focused ? '#1B5E20' : '#E0E0E0',
                                justifyContent: 'center', alignItems: 'center',
                            }}>
                                <Text style={{
                                    color: focused ? '#fff' : '#666',
                                    fontSize: 14, fontWeight: '800',
                                }}>
                                    {initial}
                                </Text>
                            </View>
                        ) : (
                            <TabIcon emoji="👤" focused={focused} />
                        )
                    ),
                }}
            />
        </Tabs>
    );
}

// ─── Tab Bar Styles ──────────────────────────
const tabBarStyles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingTop: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 10,
    },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        height: 56,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        position: 'relative',
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#999',
        marginTop: 2,
    },
    tabLabelActive: {
        color: '#1B5E20',
        fontWeight: '800',
    },
    activeIndicator: {
        position: 'absolute',
        top: -6,
        width: 20,
        height: 3,
        borderRadius: 2,
        backgroundColor: '#1B5E20',
    },
    // ─── Center Cart Button ───
    cartButton: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -28,
    },
    cartCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#1B5E20',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#1B5E20',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 8,
        borderWidth: 4,
        borderColor: '#fff',
    },
    cartIcon: {
        fontSize: 26,
    },
    cartBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#FF5722',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#fff',
    },
    cartBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
    },
});
