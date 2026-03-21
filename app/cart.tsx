import React from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    Pressable,
    Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, Stack } from 'expo-router';
import { useCartStore, CartItem } from '@/stores/cartStore';
import { formatPrice } from '@/utils/format';
import EmptyState from '@/components/EmptyState';

function CartItemCard({ item }: { item: CartItem }) {
    const { updateQuantity, removeItem } = useCartStore();
    const price = parseFloat(item.product.price) || 0;
    const subtotal = price * item.quantity;
    const isByWeight = item.product.sells_by_weight;
    const step = isByWeight ? 0.5 : 1;
    const unit = item.product.unit || 'Unid';

    // Format quantity display
    const qtyDisplay = isByWeight
        ? `${item.quantity} ${unit}`
        : `${item.quantity}`;

    const extrasDescription = item.description || '';

    return (
        <View style={styles.itemCard}>
            <View style={styles.itemImage}>
                {item.product.image_url ? (
                    <Image
                        source={{ uri: item.product.image_url }}
                        style={styles.image}
                        contentFit="cover"
                    />
                ) : (
                    <Text style={styles.placeholderIcon}>📦</Text>
                )}
            </View>

            <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>
                    {item.product.nombre_producto}
                </Text>
                <Text style={styles.itemPrice}>
                    {formatPrice(price)}{isByWeight ? ` /${unit}` : ' c/u'}
                </Text>
                {extrasDescription ? (
                    <Text style={styles.itemExtras}>{extrasDescription}</Text>
                ) : null}

                <View style={styles.quantityRow}>
                    <Pressable
                        style={styles.qtyBtn}
                        onPress={() => updateQuantity(item.cartItemId, item.quantity - step)}
                    >
                        <Text style={styles.qtyBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.qtyText}>{qtyDisplay}</Text>
                    <Pressable
                        style={styles.qtyBtn}
                        onPress={() => updateQuantity(item.cartItemId, item.quantity + step)}
                    >
                        <Text style={styles.qtyBtnText}>+</Text>
                    </Pressable>

                    <Pressable
                        style={styles.removeBtn}
                        onPress={() => removeItem(item.cartItemId)}
                    >
                        <Text style={styles.removeBtnText}>🗑</Text>
                    </Pressable>
                </View>
            </View>

            <Text style={styles.subtotal}>{formatPrice(subtotal)}</Text>
        </View>
    );
}

export default function CartScreen() {
    const { items, getTotal, getItemCount, clearCart } = useCartStore();
    const router = useRouter();

    const handleCheckout = () => {
        router.push('/checkout');
    };

    const handleClear = () => {
        Alert.alert(
            'Vaciar carrito',
            '¿Estás seguro de que querés vaciar el carrito?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Vaciar', style: 'destructive', onPress: clearCart },
            ]
        );
    };

    // Count distinct items, not quantities
    const distinctCount = items.length;

    return (
        <>
            <Stack.Screen
                options={{
                    title: `🛒 Carrito (${distinctCount})`,
                    headerRight: () =>
                        items.length > 0 ? (
                            <Pressable onPress={handleClear} style={{ paddingRight: 8 }}>
                                <Text style={{ color: '#fff', fontSize: 14 }}>Vaciar</Text>
                            </Pressable>
                        ) : null,
                }}
            />

            {items.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <EmptyState message="Tu carrito está vacío" />
                    <Pressable style={styles.shopBtn} onPress={() => router.back()}>
                        <Text style={styles.shopBtnText}>Ver productos</Text>
                    </Pressable>
                </View>
            ) : (
                <View style={styles.container}>
                    <FlatList
                        data={items}
                        keyExtractor={(item) => item.cartItemId}
                        renderItem={({ item }) => <CartItemCard item={item} />}
                        contentContainerStyle={styles.list}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                    />

                    {/* Footer with total */}
                    <View style={styles.footer}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Total</Text>
                            <Text style={styles.totalValue}>{formatPrice(getTotal())}</Text>
                        </View>
                        <Text style={styles.itemCountText}>
                            {distinctCount} {distinctCount === 1 ? 'producto' : 'productos'}
                        </Text>
                        <Pressable style={styles.checkoutBtn} onPress={handleCheckout}>
                            <Text style={styles.checkoutBtnText}>Enviar pedido</Text>
                        </Pressable>
                    </View>
                </View>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    emptyContainer: {
        flex: 1,
        backgroundColor: '#FAFAFA',
        alignItems: 'center',
        justifyContent: 'center',
    },
    list: {
        padding: 16,
        paddingBottom: 200,
    },
    itemCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    itemImage: {
        width: 70,
        height: 70,
        borderRadius: 8,
        backgroundColor: '#F0F4F0',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholderIcon: {
        fontSize: 28,
    },
    itemInfo: {
        flex: 1,
        marginLeft: 12,
        gap: 4,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        lineHeight: 18,
    },
    itemPrice: {
        fontSize: 12,
        color: '#888',
    },
    itemExtras: {
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
        marginTop: 2,
    },
    quantityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    qtyBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#F0F0F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyBtnText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        lineHeight: 20,
    },
    qtyText: {
        fontSize: 15,
        fontWeight: '700',
        minWidth: 50,
        textAlign: 'center',
    },
    removeBtn: {
        marginLeft: 'auto',
    },
    removeBtnText: {
        fontSize: 18,
    },
    subtotal: {
        fontSize: 15,
        fontWeight: '700',
        color: '#2E7D32',
        alignSelf: 'flex-start',
        marginLeft: 8,
    },
    separator: {
        height: 10,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 10,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    totalValue: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B5E20',
    },
    itemCountText: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    checkoutBtn: {
        backgroundColor: '#1B5E20',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 12,
    },
    checkoutBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    shopBtn: {
        backgroundColor: '#1B5E20',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 8,
    },
    shopBtnText: {
        color: '#fff',
        fontWeight: '600',
    },
});
