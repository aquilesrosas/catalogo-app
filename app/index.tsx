import React, { useEffect, useState } from 'react';
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
    const { isLoggedIn } = useAuthStore();
    const router = useRouter();
    const params = useLocalSearchParams();
    const kioskTitle = useConfigStore((s) => s.kioskTitle);
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const showBanner = !isLoggedIn() && !bannerDismissed;

    useEffect(() => {
        // Table Ordering QR redirect
        if (params.kiosk) {
            router.replace(`/kiosk?kiosk=${params.kiosk}`);
        } else {
            fetchCategories();
            fetchProducts(true);
        }
    }, [params.kiosk]);

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
                        onRefresh={refresh}
                        colors={['#FFC107']}
                        tintColor="#FFC107"
                    />
                }
                initialNumToRender={6}
                maxToRenderPerBatch={8}
                windowSize={5}
                removeClippedSubviews={true}
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
