import React, { useEffect, useState } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Text,
    Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
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
    const kioskTitle = useConfigStore((s) => s.kioskTitle);
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const showBanner = !isLoggedIn() && !bannerDismissed;

    useEffect(() => {
        fetchCategories();
        fetchProducts(true);
    }, []);

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
        <View>
            {showBanner && (
                <Pressable
                    style={styles.registerBanner}
                    onPress={() => router.push('/login')}
                >
                    <View style={styles.registerContent}>
                        <Text style={styles.registerEmoji}>👋</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.registerTitle}>Creá tu cuenta gratis</Text>
                            <Text style={styles.registerSubtitle}>
                                Guardá tus datos y pedí más rápido
                            </Text>
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

            {/* Kiosk Mode Button */}
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

            <SearchBar value={searchQuery} onSearch={setSearch} />
            <CategoryChips
                categories={categories}
                selectedId={selectedCategory}
                onSelect={setCategory}
            />
            {error && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>⚠️ {error}</Text>
                </View>
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
                    colors={['#2E7D32']}
                    tintColor="#2E7D32"
                />
            }
            // ─── Performance optimizations ───
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews={true}
            style={styles.container}
        />
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
});
