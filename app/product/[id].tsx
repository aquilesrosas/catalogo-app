import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Pressable,
    TextInput,
    Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, Stack } from 'expo-router';
import { getProduct, Product } from '@/services/api';
import { formatPrice } from '@/utils/format';
import { useCartStore } from '@/stores/cartStore';
import StockBadge from '@/components/StockBadge';

export default function ProductDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [added, setAdded] = useState(false);
    const [qtyText, setQtyText] = useState('1');

    const addItem = useCartStore((s) => s.addItem);
    const cartItem = useCartStore((s) => s.getItem(Number(id)));

    useEffect(() => {
        loadProduct();
    }, [id]);

    useEffect(() => {
        if (product?.sells_by_weight) {
            setQtyText('0.5'); // Default 500g
        }
    }, [product]);

    const loadProduct = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getProduct(Number(id));
            setProduct(data);
        } catch (err: any) {
            setError(err.message || 'No se pudo cargar el producto');
        } finally {
            setLoading(false);
        }
    };

    const parsedQty = parseFloat(qtyText.replace(',', '.')) || 0;

    // Sanitize quantity input based on product type
    const handleQtyChange = (text: string) => {
        if (!product) { setQtyText(text); return; }
        if (product.sells_by_weight) {
            // Allow decimals for kg/lt products
            const sanitized = text.replace(/[^0-9.,]/g, '').replace(',', '.');
            setQtyText(sanitized);
        } else {
            // Only allow integers for unit products
            const sanitized = text.replace(/[^0-9]/g, '');
            setQtyText(sanitized);
        }
    };

    const handleAddToCart = () => {
        if (!product || !product.in_stock || parsedQty <= 0) return;
        Keyboard.dismiss();
        addItem(product, parsedQty);
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#2E7D32" />
            </View>
        );
    }

    if (error || !product) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorIcon}>😕</Text>
                <Text style={styles.errorText}>{error || 'Producto no encontrado'}</Text>
                <Pressable style={styles.retryBtn} onPress={loadProduct}>
                    <Text style={styles.retryText}>Reintentar</Text>
                </Pressable>
            </View>
        );
    }

    const isByWeight = product.sells_by_weight;
    const unit = product.unit || 'Unid';
    const totalPrice = (parseFloat(product.price) || 0) * parsedQty;

    return (
        <>
            <Stack.Screen options={{ title: product.nombre_producto }} />
            <ScrollView style={styles.container} bounces={false} keyboardShouldPersistTaps="handled">
                {/* Image */}
                <View style={styles.imageContainer}>
                    {product.image_url ? (
                        <Image
                            source={{ uri: product.image_url }}
                            style={styles.image}
                            contentFit="cover"
                            transition={300}
                        />
                    ) : (
                        <View style={styles.placeholder}>
                            <Text style={styles.placeholderIcon}>📦</Text>
                            <Text style={styles.placeholderText}>Sin imagen</Text>
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={styles.info}>
                    <Text style={styles.category}>{product.category}</Text>
                    <Text style={styles.name}>{product.nombre_producto}</Text>

                    <View style={styles.priceRow}>
                        <View>
                            <Text style={styles.price}>{formatPrice(product.price)}</Text>
                            {isByWeight && (
                                <Text style={styles.perUnit}>por {unit}</Text>
                            )}
                        </View>
                        <StockBadge stockLevel={product.stock_level} />
                    </View>

                    {product.codigo_barra && (
                        <Text style={styles.barcode}>Código: {product.codigo_barra}</Text>
                    )}

                    {product.descripcion && (
                        <View style={styles.descSection}>
                            <Text style={styles.descTitle}>Descripción</Text>
                            <Text style={styles.descText}>{product.descripcion}</Text>
                        </View>
                    )}

                    {/* Quantity Input */}
                    {product.in_stock && (
                        <View style={styles.qtySection}>
                            <Text style={styles.qtyTitle}>
                                {isByWeight ? `Cantidad (${unit})` : 'Cantidad'}
                            </Text>

                            <View style={styles.qtyInputRow}>
                                <Pressable
                                    style={styles.qtyBtn}
                                    onPress={() => {
                                        const step = isByWeight ? 0.5 : 1;
                                        const newVal = Math.max(step, parsedQty - step);
                                        setQtyText(isByWeight ? newVal.toString() : Math.round(newVal).toString());
                                    }}
                                >
                                    <Text style={styles.qtyBtnText}>−</Text>
                                </Pressable>

                                <TextInput
                                    style={styles.qtyInput}
                                    value={qtyText}
                                    onChangeText={handleQtyChange}
                                    keyboardType={isByWeight ? 'decimal-pad' : 'number-pad'}
                                    selectTextOnFocus
                                    returnKeyType="done"
                                    onSubmitEditing={() => Keyboard.dismiss()}
                                />

                                <Text style={styles.qtyUnit}>{isByWeight ? unit : 'u'}</Text>

                                <Pressable
                                    style={styles.qtyBtn}
                                    onPress={() => {
                                        const step = isByWeight ? 0.5 : 1;
                                        const newVal = parsedQty + step;
                                        setQtyText(isByWeight ? newVal.toString() : Math.round(newVal).toString());
                                    }}
                                >
                                    <Text style={styles.qtyBtnText}>+</Text>
                                </Pressable>
                            </View>

                            {/* Subtotal preview */}
                            {parsedQty > 0 && (
                                <Text style={styles.subtotalPreview}>
                                    Subtotal: {formatPrice(totalPrice)}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Cart info */}
                    {cartItem && (
                        <View style={styles.inCartBanner}>
                            <Text style={styles.inCartText}>
                                🛒 Ya tenés {cartItem.quantity}{isByWeight ? ` ${unit}` : ''} en el carrito
                            </Text>
                        </View>
                    )}

                    {/* CTA */}
                    <Pressable
                        style={[
                            styles.cartBtn,
                            !product.in_stock && styles.cartBtnDisabled,
                            added && styles.cartBtnAdded,
                            parsedQty <= 0 && styles.cartBtnDisabled,
                        ]}
                        onPress={handleAddToCart}
                        disabled={!product.in_stock || parsedQty <= 0}
                    >
                        <Text style={styles.cartBtnText}>
                            {!product.in_stock
                                ? 'Sin stock'
                                : added
                                    ? '✅ Agregado!'
                                    : parsedQty <= 0
                                        ? 'Ingresá una cantidad'
                                        : `🛒 Agregar ${qtyText} ${isByWeight ? unit : (parsedQty === 1 ? 'unidad' : 'unidades')} al carrito`}
                        </Text>
                    </Pressable>
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        gap: 12,
    },
    imageContainer: {
        width: '100%',
        height: 320,
        backgroundColor: '#F5F5F5',
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
        gap: 8,
    },
    placeholderIcon: {
        fontSize: 64,
    },
    placeholderText: {
        fontSize: 14,
        color: '#999',
    },
    info: {
        padding: 20,
        gap: 8,
    },
    category: {
        fontSize: 13,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    name: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1a1a1a',
        lineHeight: 28,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    price: {
        fontSize: 28,
        fontWeight: '800',
        color: '#2E7D32',
    },
    perUnit: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    barcode: {
        fontSize: 12,
        color: '#aaa',
        marginTop: 4,
    },
    descSection: {
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    descTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    descText: {
        fontSize: 15,
        color: '#555',
        lineHeight: 22,
    },
    // ─── Quantity Input ───
    qtySection: {
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        gap: 12,
    },
    qtyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    qtyInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    qtyBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F0F0F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyBtnText: {
        fontSize: 22,
        fontWeight: '600',
        color: '#333',
    },
    qtyInput: {
        flex: 1,
        height: 48,
        borderWidth: 1.5,
        borderColor: '#D0D0D0',
        borderRadius: 12,
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        color: '#1a1a1a',
        backgroundColor: '#FAFAFA',
    },
    qtyUnit: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    subtotalPreview: {
        fontSize: 15,
        fontWeight: '600',
        color: '#666',
    },
    inCartBanner: {
        backgroundColor: '#E8F5E9',
        padding: 12,
        borderRadius: 8,
        marginTop: 12,
    },
    inCartText: {
        color: '#2E7D32',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    cartBtn: {
        backgroundColor: '#1B5E20',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 32,
    },
    cartBtnDisabled: {
        backgroundColor: '#ccc',
    },
    cartBtnAdded: {
        backgroundColor: '#2E7D32',
    },
    cartBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    errorIcon: {
        fontSize: 48,
    },
    errorText: {
        fontSize: 16,
        color: '#888',
    },
    retryBtn: {
        backgroundColor: '#1B5E20',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryText: {
        color: '#fff',
        fontWeight: '600',
    },
});
