import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, useWindowDimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Product } from '@/services/api';
import { formatPrice } from '@/utils/format';
import { useCartStore } from '@/stores/cartStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { useConfigStore } from '@/stores/configStore';
import StockBadge from './StockBadge';

interface ProductCardProps {
    product: Product;
}

function ProductCard({ product }: ProductCardProps) {
    const router = useRouter();
    const addItem = useCartStore((s) => s.addItem);
    const offers = useCatalogStore((s) => s.offers);
    const primaryColor = useConfigStore((s: any) => s.primary_color) || '#D32F2F';
    const { width } = useWindowDimensions();
    
    const isDesktop = width >= 768;

    const scaleAnim = useRef(new Animated.Value(1)).current;
    const elevationAnim = useRef(new Animated.Value(isDesktop ? 4 : 2)).current;

    const animateIn = () => {
        Animated.parallel([
            Animated.timing(scaleAnim, { toValue: 1.02, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(elevationAnim, { toValue: 12, duration: 200, useNativeDriver: false })
        ]).start();
    };

    const animateOut = () => {
        Animated.parallel([
            Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(elevationAnim, { toValue: isDesktop ? 4 : 2, duration: 200, useNativeDriver: false })
        ]).start();
    };

    const handleAdd = (e: any) => {
        e.stopPropagation?.();
        if (product.in_stock) {
            const qty = product.sells_by_weight ? 0.5 : 1;
            addItem(product, qty);
        }
    };

    const applicableOffer = offers.find(o =>
        o.aplica_a_todo || (o.productos && o.productos.includes(product.id_producto))
    );

    return (
        <Animated.View style={[
            styles.cardContainer, 
            isDesktop ? styles.cardDesktop : styles.cardMobile,
            { transform: [{ scale: scaleAnim }], elevation: elevationAnim }
        ]}>
            <Pressable
                style={[styles.pressable, isDesktop ? styles.pressableDesktop : styles.pressableMobile]}
                onPress={() => router.push(`/product/${product.id_producto}`)}
                //@ts-ignore
                onHoverIn={animateIn}
                onHoverOut={animateOut}
                onPressIn={animateIn}
                onPressOut={animateOut}
            >
                {!product.in_stock && (
                    <View style={styles.outOfStockOverlay}>
                        <View style={styles.agotadoBadge}>
                            <Text style={styles.agotadoText}>Agotado</Text>
                        </View>
                    </View>
                )}

                <View style={[styles.imageContainer, isDesktop ? styles.imageDesktop : styles.imageMobile]}>
                    {product.image_url ? (
                        <Image
                            source={{ uri: product.image_url }}
                            style={styles.image as any}
                            contentFit="cover"
                            transition={200}
                        />
                    ) : (
                        <View style={styles.placeholder}>
                            <Text style={styles.placeholderIcon}>🍽️</Text>
                        </View>
                    )}

                    {applicableOffer && (
                        <View style={styles.offerBadge}>
                            <Text style={styles.offerBadgeText}>
                                {applicableOffer.tipo === 'PCT_OFF'
                                    ? `${applicableOffer.valor}% OFF`
                                    : applicableOffer.tipo === 'FIXED_PRICE'
                                        ? `-$${applicableOffer.valor}`
                                        : applicableOffer.nombre}
                            </Text>
                        </View>
                    )}

                    {product.sells_by_weight && (
                        <View style={styles.unitBadge}>
                            <Text style={styles.unitBadgeText}>x {product.unit}</Text>
                        </View>
                    )}
                </View>

                <View style={[styles.info, isDesktop ? styles.infoDesktop : styles.infoMobile]}>
                    <View style={styles.textContainer}>
                        <Text style={[styles.name, { color: '#1a1a1a' }]} numberOfLines={isDesktop ? 2 : 1}>
                            {product.nombre_producto}
                        </Text>
                        
                        {!!product.descripcion && (
                            <Text style={styles.description} numberOfLines={2}>
                                {product.descripcion}
                            </Text>
                        )}
                    </View>

                    <View style={styles.bottomRow}>
                        <View>
                            <Text style={[styles.price, { color: primaryColor }, !product.in_stock && styles.priceGray]}>
                                {formatPrice(product.price)}
                                {product.sells_by_weight && (
                                    <Text style={styles.perUnit}> /{product.unit}</Text>
                                )}
                            </Text>
                            {!isDesktop && <StockBadge stockLevel={product.stock_level} />}
                        </View>

                        {product.in_stock && (
                            <Pressable 
                                style={[styles.addBtn, { backgroundColor: primaryColor }]} 
                                onPress={handleAdd}
                            >
                                <Text style={styles.addBtnText}>+</Text>
                            </Pressable>
                        )}
                    </View>
                    {isDesktop && <StockBadge stockLevel={product.stock_level} />}
                </View>
            </Pressable>
        </Animated.View>
    );
}

export default React.memo(ProductCard);

const styles = StyleSheet.create({
    cardContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
    },
    cardMobile: {
        width: '100%',
        height: 140,
    },
    cardDesktop: {
        width: '100%',
        height: '100%',
    },
    pressable: {
        flex: 1,
        overflow: 'hidden',
        borderRadius: 16,
    },
    pressableMobile: {
        flexDirection: 'row',
    },
    pressableDesktop: {
        flexDirection: 'column',
    },
    outOfStockOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.6)',
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    agotadoBadge: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        transform: [{ rotate: '-5deg' }],
    },
    agotadoText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    imageContainer: {
        backgroundColor: '#F5F5F5',
        position: 'relative',
        overflow: 'hidden',
    },
    imageMobile: {
        width: 140,
        height: '100%',
    },
    imageDesktop: {
        width: '100%',
        aspectRatio: 1.2,
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
        fontSize: 40,
        opacity: 0.5,
    },
    unitBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    unitBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    offerBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: '#E53935',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        zIndex: 5,
    },
    offerBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '900',
    },
    info: {
        flex: 1,
        padding: 14,
        justifyContent: 'space-between',
    },
    infoMobile: {
    },
    infoDesktop: {
        gap: 8,
    },
    textContainer: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 20,
        marginBottom: 4,
    },
    description: {
        fontSize: 13,
        color: '#757575',
        lineHeight: 18,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    price: {
        fontSize: 18,
        fontWeight: '900',
    },
    priceGray: {
        color: '#9E9E9E',
        textDecorationLine: 'line-through',
    },
    perUnit: {
        fontSize: 12,
        fontWeight: '500',
        color: '#9E9E9E',
    },
    addBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    addBtnText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '600',
        lineHeight: 24,
    },
});
