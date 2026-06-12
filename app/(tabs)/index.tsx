import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Text,
    Pressable,
    Linking,
    Modal,
    useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCatalogStore } from '@/stores/catalogStore';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { getProfile } from '@/services/api';
import ProductCard from '@/components/ProductCard';
import StickyCategoryTabs from '@/components/StickyCategoryTabs';
import SearchBar from '@/components/SearchBar';
import EmptyState from '@/components/EmptyState';
import HeroHeader from '@/components/HeroHeader';
import ClosedBanner from '@/components/ClosedBanner';
import { SkeletonGrid } from '@/components/ProductSkeleton';
import { useCartStore } from '@/stores/cartStore';
import { formatPrice } from '@/utils/format';

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
    const { 
        isLoggedIn, 
        clientPoints, 
        loyaltyConfig, 
        setPoints, 
        setLoyaltyConfig 
    } = useAuthStore();
    const router = useRouter();
    const params = useLocalSearchParams();
    const kioskTitle = useConfigStore((s) => s.kioskTitle);
    const slug = useConfigStore((s) => s.tenantSlug);
    const bookingMode = useConfigStore((s) => s.bookingMode);
    const { items: cartItems, getItemCount, getTotal } = useCartStore();
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const [pointsModalVisible, setPointsModalVisible] = useState(false);
    const showBanner = !isLoggedIn() && !bannerDismissed;
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();

    const numCols = width >= 1024 ? 4 : width >= 768 ? 3 : 1;

    // Sort products: in-stock first, out-of-stock last
    const sortedProducts = useMemo(() => {
        return [...products].sort((a, b) => {
            const aStock = (a as any).stock_actual > 0 ? 0 : 1;
            const bStock = (b as any).stock_actual > 0 ? 0 : 1;
            return aStock - bStock;
        });
    }, [products]);

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
            <HeroHeader />
            <ClosedBanner />

            {/* MODULO PEDIR COMIDA (Kiosk) */}
            <Pressable
                style={styles.kioskBanner}
                onPress={() => router.push('/kiosk')}
            >
                <View style={styles.kioskContent}>
                    <Text style={styles.kioskEmoji}>🍔</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.kioskTitle}>🍔 Pedir Comida</Text>
                        <Text style={styles.kioskSubtitle}>Tocá para hacer tu pedido local</Text>
                    </View>
                    <Text style={styles.kioskArrow}>›</Text>
                </View>
            </Pressable>

            {/* BUSCADOR PROMINENTE */}
            <View style={{ paddingHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
                <SearchBar value={searchQuery} onSearch={setSearch} />
            </View>

            {/* CHIPS DE NAVEGACION (Nuevos Sticky Tabs) */}
            <StickyCategoryTabs
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
                    onPress={() => router.push('/(tabs)/profile')}
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

    // ── Booking mode: show welcome splash instead of product catalog ──────────
    if (bookingMode === 'barber' || bookingMode === 'estetica' || bookingMode === 'dance') {
        const MODES: Record<string, { emoji: string; label: string; desc: string; color: string; tab: string }> = {
            barber:   { emoji: '💈', label: 'Barbería',           desc: 'Reservá tu turno online de forma rápida y sencilla.',  color: '#1B5E20', tab: '/barber' },
            estetica: { emoji: '💅', label: 'Centro de Estética', desc: 'Elegí tu tratamiento, especialista y horario ideal.',  color: '#C2185B', tab: '/estetica' },
            dance:    { emoji: '🩰', label: 'Academia de Baile',  desc: 'Mirá las clases disponibles e inscribite en segundos.',color: '#6A1B9A', tab: '/classes' },
        };
        const mode = MODES[bookingMode];
        // storeName from configStore (already loaded by _layout.tsx's getStoreConfig call)
        const storeName = useConfigStore.getState().name || '';

        return (
            <View style={[styles.container, { backgroundColor: '#F5F5F5' }]}>
                {/* Hero band — plain colored strip, no absolute positioning */}
                <View style={{
                    backgroundColor: mode.color,
                    paddingTop: insets.top + 20,
                    paddingBottom: 48,
                    alignItems: 'center',
                }}>
                    <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', marginBottom: 4 }}>
                        {storeName}
                    </Text>
                    <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>
                        {mode.label}
                    </Text>
                </View>

                {/* Card floating over the hero */}
                <View style={{ marginHorizontal: 24, marginTop: -32 }}>
                    <View style={{
                        backgroundColor: '#fff', borderRadius: 20,
                        padding: 28, alignItems: 'center',
                        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.10, shadowRadius: 16, elevation: 8,
                    }}>
                        {/* Big emoji */}
                        <View style={{
                            width: 88, height: 88, borderRadius: 44,
                            backgroundColor: mode.color + '15',
                            justifyContent: 'center', alignItems: 'center', marginBottom: 16,
                        }}>
                            <Text style={{ fontSize: 46 }}>{mode.emoji}</Text>
                        </View>

                        <Text style={{ fontSize: 20, fontWeight: '800', color: '#1A1A1A', marginBottom: 8, textAlign: 'center' }}>
                            {mode.label}
                        </Text>
                        <Text style={{ fontSize: 14, color: '#777', textAlign: 'center', lineHeight: 21, marginBottom: 28 }}>
                            {mode.desc}
                        </Text>

                        {/* CTA primario */}
                        <Pressable
                            style={{
                                backgroundColor: mode.color, borderRadius: 14,
                                paddingVertical: 16, width: '100%', alignItems: 'center',
                                shadowColor: mode.color, shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.30, shadowRadius: 8, elevation: 6,
                            }}
                            onPress={() => router.push(mode.tab as any)}
                        >
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
                                {mode.emoji} Reservar turno
                            </Text>
                        </Pressable>

                        {/* CTA secundario */}
                        <Pressable
                            style={{
                                marginTop: 12, paddingVertical: 14, width: '100%', alignItems: 'center',
                                borderRadius: 14, borderWidth: 1.5, borderColor: mode.color + '55',
                            }}
                            onPress={() => router.push(mode.tab as any)}
                        >
                            <Text style={{ color: mode.color, fontSize: 15, fontWeight: '700' }}>
                                📋 Ver mis turnos
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        );
    }

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
                key={`grid-${numCols}`}
                data={sortedProducts}
                keyExtractor={(item) => item.id_producto.toString()}
                renderItem={({ item }) => (
                    <View style={numCols > 1 ? styles.gridItem : styles.listItem}>
                        <ProductCard product={item} />
                    </View>
                )}
                numColumns={numCols}
                columnWrapperStyle={numCols > 1 ? styles.row : undefined}
                contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
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

            {/* ─── Floating Cart Bar ─────── */}
            {cartItems.length > 0 && (
                <View style={[styles.cartBar, { bottom: insets.bottom + 70 }]}>
                    <View style={styles.cartBarLeft}>
                        <View style={styles.cartBadge}>
                            <Text style={styles.cartBadgeText}>{getItemCount()}</Text>
                        </View>
                        <View>
                            <Text style={styles.cartBarTitle}>Tu Carrito</Text>
                            <Text style={styles.cartBarTotal}>{formatPrice(getTotal())}</Text>
                        </View>
                    </View>
                    <Pressable
                        style={styles.payBtn}
                        onPress={() => router.push('/cart')}
                    >
                        <Text style={styles.payBtnText}>Ver Carrito</Text>
                    </Pressable>
                </View>
            )}

            {/* Modal Info Puntos */}
            <Modal
                visible={pointsModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setPointsModalVisible(false)}
            >
                <Pressable 
                    style={styles.modalOverlay} 
                    onPress={() => setPointsModalVisible(false)}
                >
                    <View style={styles.pointsModalContent}>
                        <Text style={styles.modalEmoji}>⭐</Text>
                        <Text style={styles.modalTitle}>Tus Puntos de Fidelidad</Text>
                        
                        <View style={styles.pointsDetailCard}>
                            <Text style={styles.pointsDetailLabel}>Saldo actual</Text>
                            <Text style={styles.pointsDetailValue}>{clientPoints} pts</Text>
                        </View>

                        <Text style={styles.modalText}>
                            {loyaltyConfig?.is_active ? (
                                <>
                                    Cada punto equivale a <Text style={styles.bold}>{formatPrice(loyaltyConfig.currency_per_point)}</Text> de descuento.
                                    {"\n\n"}
                                    Podés empezar a canjear cuando alcances los <Text style={styles.bold}>{loyaltyConfig.min_points_to_redeem} puntos</Text>.
                                </>
                            ) : (
                                "El programa de puntos está activo. ¡Sumá puntos con cada compra!"
                            )}
                        </Text>

                        <Pressable 
                            style={styles.modalCloseBtn}
                            onPress={() => setPointsModalVisible(false)}
                        >
                            <Text style={styles.modalCloseBtnText}>Entendido</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F6F8',
    },
    headerWrapper: {
        backgroundColor: '#F5F6F8',
    },
    list: {
        paddingBottom: 20,
        paddingTop: 8,
    },
    row: {
        justifyContent: 'flex-start',
        paddingHorizontal: 16,
        gap: 16, // using gap instead of space-between for better alignment in grid
    },
    gridItem: {
        flex: 1,
        maxWidth: '33.33%', // fallback, controlled by gap
    },
    listItem: {
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
    // ─── Floating Cart Bar ───
    cartBar: {
        position: 'absolute',
        left: 16,
        right: 16,
        backgroundColor: '#1B5E20',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#1B5E20',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 10,
    },
    cartBarLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cartBadge: {
        backgroundColor: '#fff',
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartBadgeText: {
        color: '#1B5E20',
        fontSize: 12,
        fontWeight: '900',
    },
    cartBarTitle: {
        color: '#A5D6A7',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    cartBarTotal: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    payBtn: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    payBtnText: {
        color: '#1B5E20',
        fontWeight: '800',
        fontSize: 14,
    },
    // ─── Modal Puntos ───
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    pointsModalContent: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
    },
    modalEmoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1a1a1a',
        marginBottom: 20,
    },
    pointsDetailCard: {
        backgroundColor: '#F1F8E9',
        borderRadius: 16,
        padding: 16,
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    pointsDetailLabel: {
        fontSize: 14,
        color: '#558B2F',
        fontWeight: '600',
    },
    pointsDetailValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#2E7D32',
    },
    modalText: {
        fontSize: 15,
        color: '#444',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    bold: {
        fontWeight: '800',
        color: '#1a1a1a',
    },
    modalCloseBtn: {
        backgroundColor: '#1B5E20',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 14,
        width: '100%',
        alignItems: 'center',
    },
    modalCloseBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    infoIcon: {
        fontSize: 18,
        color: '#aaa',
        marginLeft: 8,
    },
});
