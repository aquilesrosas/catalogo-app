import React from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Animated } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Product } from '@/services/api';
import { formatPrice } from '@/utils/format';
import { useCartStore } from '@/stores/cartStore';
import StockBadge from './StockBadge';

const CARD_WIDTH = (Dimensions.get('window').width - 48) / 2;

interface ProductCardProps {
    product: Product;
}

function ProductCard({ product }: ProductCardProps) {
    const router = useRouter();
    const addItem = useCartStore((s) => s.addItem);
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();
    }, []);

    const handleAdd = (e: any) => {
        e.stopPropagation?.();
        if (product.in_stock) {
            // For weight products, add 0.5kg; for unit products, add 1
            const qty = product.sells_by_weight ? 0.5 : 1;
            addItem(product, qty);
        }
    };

    return (
        <Animated.View style={{ opacity: fadeAnim }}>
            <Pressable
                style={({ pressed }) => [
                    styles.card,
                    pressed && styles.pressed,
                ]}
                onPress={() => router.push(`/product/${product.id_producto}`)}
            >
                {!product.in_stock && <View style={styles.outOfStockOverlay} />}

                <View style={styles.imageContainer}>
                    {product.image_url ? (
                        <Image
                            source={{ uri: product.image_url }}
                            style={styles.image}
                            contentFit="cover"
                            transition={200}
                        />
                    ) : (
                        <View style={styles.placeholder}>
                            <Text style={styles.placeholderIcon}>📦</Text>
                        </View>
                    )}
                    {/* Unit badge on image */}
                    {product.sells_by_weight && (
                        <View style={styles.unitBadge}>
                            <Text style={styles.unitBadgeText}>x {product.unit}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.info}>
                    <Text style={styles.category}>{product.category}</Text>
                    <Text style={styles.name} numberOfLines={2}>
                        {product.nombre_producto}
                    </Text>
                    <Text style={[styles.price, !product.in_stock && styles.priceGray]}>
                        {formatPrice(product.price)}
                        {product.sells_by_weight && (
                            <Text style={styles.perUnit}> /{product.unit}</Text>
                        )}
                    </Text>

                    <View style={styles.bottomRow}>
                        <StockBadge stockLevel={product.stock_level} />
                        {product.in_stock && (
                            <Pressable style={styles.addBtn} onPress={handleAdd}>
                                <Text style={styles.addBtnText}>+</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </Pressable>
        </Animated.View>
    );
}

export default React.memo(ProductCard);

const styles = StyleSheet.create({
    card: {
        width: CARD_WIDTH,
        backgroundColor: '#fff',
        borderRadius: 14,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
        overflow: 'hidden',
        position: 'relative',
    },
    pressed: {
        transform: [{ scale: 0.97 }],
    },
    outOfStockOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.45)',
        zIndex: 10,
        borderRadius: 14,
    },
    imageContainer: {
        width: '100%',
        height: CARD_WIDTH * 0.8,
        backgroundColor: '#F5F5F5',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F0F4F0',
    },
    placeholderIcon: {
        fontSize: 36,
    },
    unitBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(27,94,32,0.85)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    unitBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    info: {
        padding: 12,
        gap: 4,
    },
    category: {
        fontSize: 10,
        color: '#999',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        fontWeight: '600',
    },
    name: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        lineHeight: 18,
        minHeight: 36,
    },
    price: {
        fontSize: 17,
        fontWeight: '800',
        color: '#2E7D32',
        marginTop: 2,
    },
    priceGray: {
        color: '#aaa',
    },
    perUnit: {
        fontSize: 12,
        fontWeight: '500',
        color: '#888',
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    addBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1B5E20',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#1B5E20',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    addBtnText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        lineHeight: 22,
    },
});
