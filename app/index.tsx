import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Text,
    Pressable,
    Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCatalogStore } from '@/stores/catalogStore';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { getProfile } from '@/services/api';
import ProductCard from '@/components/ProductCard';
import CategoryChips from '@/components/CategoryChips';
import SearchBar from '@/components/SearchBar';
import EmptyState from '@/components/EmptyState';
import { SkeletonGrid } from '@/components/ProductSkeleton';

export default function HomeScreen() {
    const {
        products,
        categories,
        selectedCategory,
        searchQuery,
        loading,
        loadingMore,
        hasMore,
        error,
        fetchProducts,
        fetchNextPage,
        fetchCategories,
        setCategory,
        setSearch,
        refresh,
    } = useCatalogStore();
    const { isLoggedIn, clientPoints, setPoints } = useAuthStore();
    const router = useRouter();
    const params = useLocalSearchParams();
    const kioskTitle = useConfigStore((s) => s.kioskTitle);
    const slug = useConfigStore((s) => s.tenantSlug);
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const showBanner = !isLoggedIn() && !bannerDismissed;

    // Sync puntos del perfil al montar y al refrescar
    const syncProfile = useCallback(async () => {
        if (!isLoggedIn()) return;
        try {
            const profile = await getProfile();
            if (profile?.points !== undefined) {
                setPoints(profile.points);
            }
        } catch { /* no-op if not logged in or network error */ }
    }, [isLoggedIn()]);

    useEffect(() => {
        syncProfile();
    }, [syncProfile]);

    useEffect(() => {
        // Table Ordering QR redirect
        if (params.kiosk) {
            router.replace(`/kiosk?kiosk=${params.kiosk}`);
        } else {
            fetchCategories();
            fetchProducts(true);
        }
    }, [params.kiosk, slug]);

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View style={styles.footer}>
                <ActivityIndicator size="small" color="#2E7D32" />
            </View>
        );
    };

    const renderEmpty = () => {
        if (loading) return null;
        return <EmptyState />;
    };

    const renderHeader = () => (
        <View style={styles.headerWrapper}>
            {/* HERO BANNER PREMIUM */}
            <View style={styles.heroBanner}>
                <View style={styles.heroContent}>
                    <Text style={styles.heroTitle}>Ofertas Top 🔥</Text>
                    <Text style={styles.heroSubtitle}>Hasta 30% off en seleccionados</Text>
                    <Pressable style={styles.heroBtn} onPress={() => router.push('/ofertas')}>
                        <Text style={styles.heroBtnText}>Ver Promos</Text>
                    </Pressable>
                </View>
                {/* Placeholder graphic block */}
                <View style={styles.heroGraphic}>
                    <Text style={styles.heroEmoji}>🍔🍕</Text>
                </View>
            </View>

            {/* PUNTOS + MIS PEDIDOS (solo si logueado) */}
            {isLoggedIn() && (
                <View style={styles.loyaltyRow}>
                    <View style={styles.pointsBadge}>
                        <Text style={styles.pointsIcon}>⭐</Text>
                        <View>
                            <Text style={styles.pointsValue}>{clientPoints} puntos</Text>
                            <Text style={styles.pointsHint}>
                                {clientPoints >= 100
                                    ? '🎁 ¡Canjeá tus puntos!'
                                    : `Faltan ${100 - clientPoints} para un beneficio`}
                            </Text>
                        </View>
                    </View>
                    <Pressable
                        style={styles.ordersBtn}
                        onPress={() => router.push('/orders')}
                    >
                        <Text style={styles.ordersBtnIcon}>📋</Text>
                        <Text style={styles.ordersBtnText}>Mis Pedidos</Text>
                    </Pressable>
                </View>
            )}

            {/* MODULO PEDIR COMIDA (Kiosk) */}
            <Pressable
                style={styles.kioskBanner}
                onPress={() => router.push('/kiosk')}
            >
                <View style={styles.kioskContent}>
                    <Text style={styles.kioskEmoji}>🍔</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.kioskTitle}>{kioskTitle || '🍔 Pedir Comida'}</Text>
                        <Text style={styles.kioskSubtitle}>Tocá para hacer tu pedido</Text>
                    </View>
                    <Text style={styles.kioskArrow}>›</Text>
                </View>
            </Pressable>

            {/* BUSCADOR PROMINENTE */}
            <SearchBar value={searchQuery} onSearch={setSearch} />

            {/* CHIPS DE NAVEGACION (Circulos) */}
            <CategoryChips
                categories={categories}
                selectedId={selectedCategory}
                onSelect={setCategory}
            />

            {/* ERROR BANNER */}
            {error ? (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>⚠️ {error}</Text>
                    {(error.includes('404') || error.includes('Tienda no encontrada')) && (
                        <Pressable 
                            style={{ marginTop: 10, backgroundColor: '#E65100', padding: 8, borderRadius: 6 }}
                            onPress={() => {
                                useConfigStore.getState().clearConfig();
                                router.replace('/config_setup');
                            }}
                        >
                            <Text style={{ color: '#FFF', fontWeight: 'bold', textAlign: 'center' }}>
                                Buscar otra tienda
                            </Text>
                        </Pressable>
                    )}
                </View>
            ) : null}

            {/* KIOSK / REGISTER (Solo si es pertinente para UX) */}
            {showBanner && (
                <Pressable
                    style={styles.registerBanner}
                    onPress={() => router.push('/login')}
                >
                    <View style={styles.registerContent}>
                        <Text style={styles.registerEmoji}>👋</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.registerTitle}>Creá tu cuenta gratis</Text>
                            <Text style={styles.registerSubtitle}>Guardá tus datos y pedí más rápido</Text>
                        </View>
                    </View>
                    <Pressable
                        style={styles.dismissBtn}
                        onPress={(e) => { e.stopPropagation(); setBannerDismissed(true); }}
                        hitSlop={10}
                    >
                        <Text style={styles.dismissText}>×</Text>
                    </Pressable>
                </Pressable>
            )}
        </View>
    );

    if (loading && products.length === 0) {
        return (
            <View style={styles.container}>
                {renderHeader()}
                <SkeletonGrid />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={products}
                keyExtractor={(item) => item.id_producto.toString()}
                renderItem={({ item }) => <ProductCard product={item} />}
                numColumns={2}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.list}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={renderFooter}
                onEndReached={() => {
                    if (hasMore && !loadingMore) fetchNextPage();
                }}
                onEndReachedThreshold={0.5}
                refreshControl={
                    <RefreshControl
                        refreshing={loading && products.length > 0}
                        onRefresh={() => { refresh(); syncProfile(); }}
                        colors={['#FFC107']}
                        tintColor="#FFC107"
                    />
                }
                initialNumToRender={6}
                maxToRenderPerBatch={8}
                windowSize={5}
            />

            {/* FAB BOT IA */}
            <Pressable
                style={styles.fab}
                onPress={() => {
                    Linking.openURL('https://wa.me/5491100000000?text=Hola,%20necesito%20ayuda%20con%20mi%20pedido');
                }}
            >
                <Text style={styles.fabIcon}>🤖</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    list: {
        paddingBottom: 20,
    },
    row: {
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    footer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    errorBanner: {
        backgroundColor: '#FFF3E0',
        marginHorizontal: 16,
        marginTop: 8,
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#E65100',
    },
    errorText: {
        color: '#E65100',
        fontSize: 13,
    },
    // ─── Register Banner ───
    registerBanner: {
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
        backgroundColor: '#1B5E20',
        borderRadius: 14,
        padding: 14,
        position: 'relative',
        shadowColor: '#1B5E20',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 5,
    },
    registerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    registerEmoji: {
        fontSize: 28,
    },
    registerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    registerSubtitle: {
        color: '#C8E6C9',
        fontSize: 12,
        marginTop: 2,
    },
    registerArrow: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '300',
    },
    dismissBtn: {
        position: 'absolute',
        top: 4,
        right: 8,
        padding: 4,
    },
    dismissText: {
        color: '#A5D6A7',
        fontSize: 18,
        fontWeight: '600',
    },
    // ─── Kiosk Banner ───
    kioskBanner: {
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 4,
        backgroundColor: '#121212',
        borderRadius: 14,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 5,
    },
    kioskContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    kioskEmoji: {
        fontSize: 28,
    },
    kioskTitle: {
        color: '#FF9100',
        fontSize: 16,
        fontWeight: '700',
    },
    kioskSubtitle: {
        color: '#888',
        fontSize: 12,
        marginTop: 2,
    },
    kioskArrow: {
        color: '#FF9100',
        fontSize: 28,
        fontWeight: '300',
    },
    // ─── Hero Banner Premium ───
    headerWrapper: {
        backgroundColor: '#FAFAFA',
        paddingTop: 8,
    },
    // ─── Loyalty Row ───
    loyaltyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 4,
        gap: 10,
    },
    pointsBadge: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF8E1',
        borderRadius: 14,
        padding: 12,
        gap: 10,
        borderWidth: 1,
        borderColor: '#FFD54F',
    },
    pointsIcon: {
        fontSize: 28,
    },
    pointsValue: {
        fontSize: 16,
        fontWeight: '800',
        color: '#F57F17',
    },
    pointsHint: {
        fontSize: 11,
        color: '#795548',
        marginTop: 1,
    },
    ordersBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 14,
        gap: 6,
        borderWidth: 1,
        borderColor: '#A5D6A7',
    },
    ordersBtnIcon: {
        fontSize: 20,
    },
    ordersBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1B5E20',
    },
    heroBanner: {
        marginHorizontal: 16,
        marginBottom: 8,
        height: 140,
        backgroundColor: '#FF6F00',
        borderRadius: 20,
        flexDirection: 'row',
        overflow: 'hidden',
        shadowColor: '#FF6F00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    heroContent: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    heroTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '900',
    },
    heroSubtitle: {
        color: '#FFE0B2',
        fontSize: 13,
        marginTop: 4,
        marginBottom: 12,
    },
    heroBtn: {
        backgroundColor: '#FFF',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    heroBtnText: {
        color: '#FF6F00',
        fontWeight: 'bold',
        fontSize: 12,
    },
    heroGraphic: {
        width: 100,
        backgroundColor: '#FF8F00',
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroEmoji: {
        fontSize: 48,
        transform: [{ rotate: '-15deg' }],
    },
    // ─── FAB Bot ───
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#25D366', // WhatsApp color
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
    fabIcon: {
        fontSize: 30,
    },
});
