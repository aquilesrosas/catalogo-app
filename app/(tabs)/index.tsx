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
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCatalogStore } from '@/stores/catalogStore';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { getProfile, getStoreConfig, getProductsByIds, Product } from '@/services/api';
import { getSorteoActivo, SorteoActivo } from '@/services/sorteo';
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
    const showPedirComida = useConfigStore((s) => s.showPedirComida);
    const primaryColor = useConfigStore((s) => s.primaryColor);
    const destacadosIds = useConfigStore((s) => s.destacadosIds);
    const { items: cartItems, getItemCount, getTotal } = useCartStore();
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const [hookTagline, setHookTagline] = useState('');
    const [pointsModalVisible, setPointsModalVisible] = useState(false);
    const [sorteoModalVisible, setSorteoModalVisible] = useState(false);
    const [sorteoInfo, setSorteoInfo] = useState<SorteoActivo | null>(null);
    const showBanner = !isLoggedIn() && !bannerDismissed;
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();

    const numCols = width >= 1024 ? 4 : width >= 768 ? 3 : 2;

    // Sort products: in-stock first, out-of-stock last
    const sortedProducts = useMemo(() => {
        return [...products].sort((a, b) => {
            const aStock = (a as any).stock_actual > 0 ? 0 : 1;
            const bStock = (b as any).stock_actual > 0 ? 0 : 1;
            return aStock - bStock;
        });
    }, [products]);

    // Featured products fetched independently (not from paginated list)
    const [destacadosProducts, setDestacadosProducts] = useState<Product[]>([]);
    useEffect(() => {
        if (!destacadosIds.length) { setDestacadosProducts([]); return; }
        getProductsByIds(destacadosIds).then(fetched => {
            // Keep the order defined by destacadosIds
            const map = new Map(fetched.map(p => [p.id_producto, p]));
            setDestacadosProducts(destacadosIds.map(id => map.get(id)).filter(Boolean) as Product[]);
        }).catch(() => {});
    }, [destacadosIds]);

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
        getStoreConfig().then(config => {
            const cc = (config.catalog_config || {}) as any;
            setHookTagline(cc.tagline || '');
        }).catch(() => {});
    }, [slug]);

    useEffect(() => {
        getSorteoActivo().then(s => {
            if (s) {
                setSorteoInfo(s);
                setSorteoModalVisible(true);
            }
        }).catch(() => {});
    }, [slug]);

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
            {/* Hero + cart pill overlay */}
            <View style={{ position: 'relative' }}>
                <HeroHeader showTagline={false} />
                {cartItems.length > 0 && (
                    <Pressable
                        style={[styles.heroCartPill, { top: insets.top + 10 }]}
                        onPress={() => router.push('/cart')}
                    >
                        <View style={[styles.heroCartBadge, { backgroundColor: primaryColor }]}>
                            <Text style={styles.heroCartBadgeText}>{getItemCount()}</Text>
                        </View>
                        <Text style={styles.heroCartAmount}>{formatPrice(getTotal())}</Text>
                    </Pressable>
                )}
            </View>

            <ClosedBanner />

            {/* Hook section — aparece solo si el negocio tiene tagline configurado */}
            {hookTagline ? (
                <View style={styles.hookSection}>
                    <Text style={styles.hookTitle}>Todo lo que buscás</Text>
                    <Text style={styles.hookSubtitle}>{hookTagline}</Text>
                </View>
            ) : null}

            {/* FRANJA HORIZONTAL DE PRODUCTOS DESTACADOS */}
            {destacadosProducts.length > 0 && (
                <View style={styles.featuredSection}>
                    <View style={styles.featuredTitleRow}>
                        <Text style={[styles.featuredTitle, { color: primaryColor }]}>⭐ Destacados</Text>
                        <View style={[styles.featuredTitleBar, { backgroundColor: primaryColor }]} />
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.featuredScroll}
                    >
                        {destacadosProducts.map((product) => {
                            const isOutOfStock = !(product as any).in_stock;
                            return (
                                <Pressable
                                    key={product.id_producto}
                                    style={styles.featuredCard}
                                    onPress={() => router.push(`/product/${product.id_producto}`)}
                                >
                                    {isOutOfStock && (
                                        <View style={styles.featuredOutOfStock}>
                                            <Text style={styles.featuredAgotadoText}>Agotado</Text>
                                        </View>
                                    )}
                                    <View style={styles.featuredImageWrap}>
                                        {(product as any).image_url ? (
                                            <Image
                                                source={{ uri: (product as any).image_url }}
                                                style={{ width: '100%', height: '100%' }}
                                                contentFit="cover"
                                            />
                                        ) : (
                                            <View style={[styles.featuredImagePlaceholder, { backgroundColor: primaryColor + '18' }]}>
                                                <Text style={{ fontSize: 34, fontWeight: '900', color: primaryColor }}>
                                                    {product.nombre_producto.charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.featuredInfo}>
                                        <Text style={styles.featuredName} numberOfLines={2}>
                                            {product.nombre_producto}
                                        </Text>
                                        <Text style={[styles.featuredPrice, { color: primaryColor }]}>
                                            {formatPrice(product.price)}
                                        </Text>
                                    </View>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            {/* CHIPS DE NAVEGACION */}
            <StickyCategoryTabs
                categories={categories}
                selectedId={selectedCategory}
                onSelect={setCategory}
            />

            {/* SEARCH BAR — below categories */}
            <SearchBar value={searchQuery} onSearch={setSearch} />

            {/* MODULO PEDIR COMIDA (Kiosk) — debajo de los filtros para no bloquear los productos */}
            {showPedirComida && (
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
            )}

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
                        <Text style={styles.registerArrow}>›</Text>
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

            {/* SECTION HEADER — products list label */}
            {!loading && products.length > 0 && (
                <View style={styles.productsHeader}>
                    <Text style={styles.productsHeaderText}>
                        {searchQuery
                            ? `"${searchQuery}"`
                            : selectedCategory
                                ? categories.find(c => c.id_categoria === selectedCategory)?.nombre_categoria || 'Productos'
                                : 'Todo el catálogo'}
                    </Text>
                    <Text style={styles.productsHeaderCount}>{sortedProducts.length}</Text>
                </View>
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

    // Only show full-page skeleton on initial cold load (no search/filter active).
    if (loading && products.length === 0 && !searchQuery && !selectedCategory) {
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

            {/* ─── Floating Cart Pill ─────── */}
            {cartItems.length > 0 && (
                <Pressable
                    style={[styles.cartPill, { bottom: insets.bottom + 74, backgroundColor: primaryColor }]}
                    onPress={() => router.push('/cart')}
                >
                    <View style={styles.cartPillBadge}>
                        <Text style={[styles.cartPillBadgeText, { color: primaryColor }]}>{getItemCount()}</Text>
                    </View>
                    <Text style={styles.cartPillTotal}>{formatPrice(getTotal())}</Text>
                    <Text style={styles.cartPillArrow}>→</Text>
                </Pressable>
            )}

            {/* Modal Sorteo Vigente */}
            {sorteoInfo && (
                <Modal
                    visible={sorteoModalVisible}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setSorteoModalVisible(false)}
                >
                    <Pressable style={styles.modalOverlay} onPress={() => setSorteoModalVisible(false)}>
                        <Pressable style={styles.sorteoModalContent} onPress={() => {}}>
                            <Text style={styles.sorteoEmoji}>🎟️</Text>
                            <Text style={styles.sorteoModalTitle}>¡Sorteo vigente!</Text>
                            <Text style={styles.sorteoModalNombre}>{sorteoInfo.nombre}</Text>

                            <View style={styles.sorteoPremioBox}>
                                <Text style={styles.sorteoPremioLabel}>Premio</Text>
                                <Text style={styles.sorteoPremioValue}>{sorteoInfo.premio}</Text>
                            </View>

                            <Text style={styles.sorteoModalDesc}>
                                Realizá una compra de{' '}
                                <Text style={styles.sorteoBold}>${parseFloat(sorteoInfo.compra_minima).toLocaleString('es-AR')}</Text>
                                {' '}o más y participás automáticamente.
                            </Text>

                            {isLoggedIn() && (
                                <View style={styles.sorteoLoginInfo}>
                                    <Text style={styles.sorteoLoginText}>
                                        ✅ Con tu cuenta, participás sin ingresar datos.
                                    </Text>
                                </View>
                            )}

                            <Text style={styles.sorteoFechaFin}>
                                Válido hasta el {new Date(sorteoInfo.fecha_fin).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </Text>

                            <Pressable style={[styles.sorteoBtn, { backgroundColor: primaryColor }]} onPress={() => setSorteoModalVisible(false)}>
                                <Text style={styles.sorteoBtnText}>¡Quiero participar!</Text>
                            </Pressable>
                            <Pressable onPress={() => setSorteoModalVisible(false)}>
                                <Text style={styles.sorteoCerrar}>Cerrar</Text>
                            </Pressable>
                        </Pressable>
                    </Pressable>
                </Modal>
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
    // ─── Hero Cart Pill (overlay sobre el hero) ───
    heroCartPill: {
        position: 'absolute',
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 24,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    heroCartBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroCartBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '900',
    },
    heroCartAmount: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    // ─── Hook Section ───
    hookSection: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: '#E8E8E8',
    },
    hookTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#111',
        marginBottom: 3,
    },
    hookSubtitle: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
    },
    // ─── Floating Cart Pill ───
    cartPill: {
        position: 'absolute',
        alignSelf: 'center',
        left: 24,
        right: 24,
        borderRadius: 30,
        paddingVertical: 11,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
        elevation: 8,
    },
    cartPillBadge: {
        backgroundColor: '#fff',
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartPillBadgeText: {
        fontSize: 12,
        fontWeight: '900',
    },
    cartPillTotal: {
        flex: 1,
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
        marginLeft: 10,
    },
    cartPillArrow: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 18,
        fontWeight: '600',
    },
    // ─── Modal Sorteo ───
    sorteoModalContent: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
    },
    sorteoEmoji: {
        fontSize: 52,
        marginBottom: 8,
    },
    sorteoModalTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    sorteoModalNombre: {
        fontSize: 15,
        color: '#555',
        marginBottom: 16,
        textAlign: 'center',
    },
    sorteoPremioBox: {
        backgroundColor: '#FFF8E1',
        borderRadius: 12,
        padding: 14,
        width: '100%',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FFD54F',
    },
    sorteoPremioLabel: {
        fontSize: 12,
        color: '#F57F17',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    sorteoPremioValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#E65100',
    },
    sorteoModalDesc: {
        fontSize: 15,
        color: '#333',
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 22,
    },
    sorteoBold: {
        fontWeight: '800',
        color: '#2E7D32',
    },
    sorteoLoginInfo: {
        backgroundColor: '#E8F5E9',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 14,
        marginBottom: 12,
        width: '100%',
    },
    sorteoLoginText: {
        fontSize: 13,
        color: '#2E7D32',
        fontWeight: '600',
        textAlign: 'center',
    },
    sorteoFechaFin: {
        fontSize: 12,
        color: '#888',
        marginBottom: 20,
    },
    sorteoBtn: {
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 28,
        width: '100%',
        alignItems: 'center',
        marginBottom: 12,
    },
    sorteoBtnText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 16,
    },
    sorteoCerrar: {
        fontSize: 14,
        color: '#999',
        paddingVertical: 4,
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
    // ─── Products section header ───
    productsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 6,
    },
    productsHeaderText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111',
        textTransform: 'capitalize',
    },
    productsHeaderCount: {
        fontSize: 12,
        fontWeight: '700',
        color: '#777',
        backgroundColor: '#EEEEEE',
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 10,
    },
    // ─── Featured Products shelf ───
    featuredSection: {
        paddingTop: 16,
        paddingBottom: 4,
    },
    featuredTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12,
        gap: 10,
    },
    featuredTitle: {
        fontSize: 18,
        fontWeight: '900',
    },
    featuredTitleBar: {
        flex: 1,
        height: 2,
        borderRadius: 1,
        opacity: 0.2,
    },
    featuredScroll: {
        paddingHorizontal: 16,
        gap: 12,
    },
    featuredCard: {
        width: 148,
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
    },
    featuredImageWrap: {
        width: 148,
        height: 110,
        backgroundColor: '#F5F5F5',
    },
    featuredImagePlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F0F4F0',
    },
    featuredInfo: {
        padding: 10,
    },
    featuredName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1a1a1a',
        lineHeight: 17,
        marginBottom: 4,
    },
    featuredPrice: {
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    featuredOutOfStock: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.55)',
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    featuredAgotadoText: {
        backgroundColor: 'rgba(0,0,0,0.65)',
        color: '#fff',
        fontSize: 11,
        fontWeight: '900',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
