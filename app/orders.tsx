import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Pressable,
    RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { getUserOrders } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'INGRESADO': return '#2196F3';
            case 'PREPARANDO': return '#FF9800';
            case 'EN_CAMINO': return '#9C27B0';
            case 'ENTREGADO': return '#4CAF50';
            case 'CANCELADO': return '#F44336';
            default: return '#757575';
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderOrderItem = ({ item }: { item: any }) => (
        <View style={styles.orderCard}>
            <View style={styles.orderHeader}>
                <Text style={styles.orderId}>Pedido #{item.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={styles.statusText}>{item.status_display}</Text>
                </View>
            </View>

            <View style={styles.orderBody}>
                <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
                <Text style={styles.itemsSummary}>
                    {item.items.length} {item.items.length === 1 ? 'producto' : 'productos'}
                </Text>
            </View>

            <View style={styles.orderFooter}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${parseFloat(item.total).toLocaleString('es-AR')}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Mis Pedidos' }} />

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#1B5E20" />
                </View>
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderOrderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B5E20']} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>📦</Text>
                            <Text style={styles.emptyTitle}>Aún no tenés pedidos</Text>
                            <Text style={styles.emptySubtitle}>Cuando realices una compra, aparecerá acá.</Text>
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
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    orderCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        paddingBottom: 8,
    },
    orderId: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    orderBody: {
        marginBottom: 12,
    },
    dateText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    itemsSummary: {
        fontSize: 14,
        color: '#333',
    },
    orderFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    totalLabel: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1B5E20',
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
