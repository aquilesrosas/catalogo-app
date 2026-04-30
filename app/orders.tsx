import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { getUserOrders } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    NUEVO: { color: '#1565C0', bg: '#E3F2FD', label: '🆕 Nuevo' },
    PENDIENTE: { color: '#E65100', bg: '#FFF3E0', label: '⏳ Pendiente' },
    ACEPTADO: { color: '#2E7D32', bg: '#E8F5E9', label: '✅ Aceptado' },
    RECHAZADO: { color: '#C62828', bg: '#FFEBEE', label: '❌ Rechazado' },
    CANCELADO: { color: '#757575', bg: '#F5F5F5', label: '🚫 Cancelado' },
    EN_PREPARACION: { color: '#FF8F00', bg: '#FFF8E1', label: '🔥 Preparando' },
    LISTO: { color: '#6A1B9A', bg: '#F3E5F5', label: '📦 Listo' },
    EN_CAMINO: { color: '#0277BD', bg: '#E1F5FE', label: '🚗 En camino' },
    ENTREGADO: { color: '#1B5E20', bg: '#E8F5E9', label: '🎉 Entregado' },
};

export default function OrdersScreen() {
    const { clientPhone } = useAuthStore();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchOrders = async () => {
        if (!clientPhone) return;
        try {
            const data = await getUserOrders(clientPhone);
            setOrders(data);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchOrders();
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusConfig = (status: string) => {
        return STATUS_CONFIG[status] || { color: '#757575', bg: '#F5F5F5', label: status };
    };

    const renderOrderItem = ({ item }: { item: any }) => {
        const cfg = getStatusConfig(item.status);
        const itemCount = item.items?.length || 0;
        const itemsSummary = item.items
            ?.slice(0, 3)
            .map((i: any) => `${i.quantity}x ${i.name_snapshot}`)
            .join(', ') || '';
        const hasMore = itemCount > 3;

        return (
            <View style={styles.orderCard}>
                {/* HEADER */}
                <View style={styles.orderHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.orderNumber}>
                            Pedido #{item.order_number || item.id}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[styles.statusText, { color: cfg.color }]}>
                            {cfg.label}
                        </Text>
                    </View>
                </View>

                {/* BODY */}
                <View style={styles.orderBody}>
                    <Text style={styles.dateText}>📅 {formatDate(item.created_at)}</Text>
                    <Text style={styles.itemsDetail} numberOfLines={2}>
                        {itemsSummary}{hasMore ? ` +${itemCount - 3} más` : ''}
                    </Text>
                </View>

                {/* FOOTER */}
                <View style={styles.orderFooter}>
                    <View style={styles.footerLeft}>
                        <Text style={styles.itemCountText}>
                            🛒 {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
                        </Text>
                    </View>
                    <View style={styles.totalContainer}>
                        {Number(item.points_discount || 0) > 0 && (
                            <>
                                <Text style={styles.subtotalStrike}>
                                    ${(parseFloat(item.total) + parseFloat(item.points_discount)).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                </Text>
                                <View style={styles.discountBadge}>
                                    <Text style={styles.discountText}>
                                        ⭐ -{item.points_redeemed} pts (-${parseFloat(item.points_discount).toLocaleString('es-AR', { minimumFractionDigits: 0 })})
                                    </Text>
                                </View>
                            </>
                        )}
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>
                            ${parseFloat(item.total).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Mis Pedidos' }} />

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#1B5E20" />
                    <Text style={styles.loadingText}>Cargando pedidos...</Text>
                </View>
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={(item) => (item.id || item.order_number).toString()}
                    renderItem={renderOrderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B5E20']} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>📦</Text>
                            <Text style={styles.emptyTitle}>Aún no tenés pedidos</Text>
                            <Text style={styles.emptySubtitle}>
                                Cuando realices una compra, aparecerá acá.
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: '#666',
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    orderCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    orderNumber: {
        fontSize: 16,
        fontWeight: '800',
        color: '#212121',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    orderBody: {
        marginBottom: 12,
        gap: 4,
    },
    dateText: {
        fontSize: 13,
        color: '#888',
    },
    itemsDetail: {
        fontSize: 13,
        color: '#555',
        marginTop: 4,
        lineHeight: 18,
    },
    orderFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    footerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemCountText: {
        fontSize: 13,
        color: '#888',
    },
    totalContainer: {
        alignItems: 'flex-end',
    },
    totalLabel: {
        fontSize: 11,
        color: '#999',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1B5E20',
    },
    subtotalStrike: {
        fontSize: 13,
        color: '#999',
        textDecorationLine: 'line-through',
        textAlign: 'right',
    },
    discountBadge: {
        backgroundColor: '#FFF8E1',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        marginBottom: 4,
    },
    discountText: {
        fontSize: 11,
        color: '#F59E0B',
        fontWeight: '700',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        paddingHorizontal: 32,
    },
});
