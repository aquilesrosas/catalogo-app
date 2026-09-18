import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Platform,
    Linking,
    Modal,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useLastOrderStore } from '@/stores/lastOrderStore';
import { useAuthStore } from '@/stores/authStore';
import { formatPrice } from '@/utils/format';
import { getStoreConfig } from '@/services/api';

const DELIVERY_LABELS: Record<string, string> = {
    LOCAL: '🏪 Retiro en local',
    DELIVERY: '🚚 Delivery a domicilio',
    MESA: '⚽ A la cancha / mesa',
};

const PAYMENT_LABELS: Record<string, { icon: string; label: string; instructions: string }> = {
    EFECTIVO: {
        icon: '💵',
        label: 'Efectivo',
        instructions: 'Abonás en efectivo cuando recibas tu pedido.',
    },
    TRANSFERENCIA: {
        icon: '🏦',
        label: 'Transferencia bancaria',
        instructions: 'Realizá la transferencia y enviá el comprobante al WhatsApp del local.',
    },
    MIXTO: {
        icon: '💳',
        label: 'Pago mixto',
        instructions: 'Una parte en efectivo y el resto por transferencia.',
    },
    MERCADOPAGO: {
        icon: '💙',
        label: 'Mercado Pago',
        instructions: 'Completá el pago siguiendo el link de Mercado Pago.',
    },
};

export default function OrderConfirmationScreen() {
    const router = useRouter();
    const order = useLastOrderStore((s) => s.order);
    const clearOrder = useLastOrderStore((s) => s.clearOrder);
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
    const clientName = useAuthStore((s) => s.clientName);

    const [whatsappPhone, setWhatsappPhone] = useState<string>('');
    const [storeName, setStoreName] = useState<string>('');
    const [showAccountModal, setShowAccountModal] = useState(false);

    // Si no hay datos de pedido (navegación directa), ir a inicio
    useEffect(() => {
        if (!order) {
            router.replace('/');
        }
    }, []);

    useEffect(() => {
        getStoreConfig().then((cfg) => {
            const cc = cfg?.catalog_config as Record<string, unknown> | undefined;
            setWhatsappPhone((cc?.whatsapp_phone as string) || '');
            setStoreName(cfg?.name || '');
        }).catch(() => {});
    }, []);

    if (!order) return null;

    const pm = PAYMENT_LABELS[order.payment_method] ?? {
        icon: '💰',
        label: order.payment_method,
        instructions: '',
    };

    const deliveryLabel = DELIVERY_LABELS[order.delivery_type] ?? order.delivery_type;

    const orderNum = order.order_number ?? order.id;

    const formatQty = (qty: string) => {
        const n = parseFloat(qty);
        return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
    };

    const handleGoHome = () => {
        clearOrder();
        router.replace('/');
    };

    const handleGoOrders = () => {
        clearOrder();
        router.replace('/(tabs)/orders');
    };

    const handleWhatsApp = () => {
        if (!isLoggedIn()) {
            setShowAccountModal(true);
            return;
        }
        openWhatsApp();
    };

    const openWhatsApp = () => {
        if (!whatsappPhone) return;
        const itemsText = order!.items
            .map(i => `  • ${formatQty(i.quantity)} ${i.unit_snapshot} ${i.name_snapshot} - ${formatPrice(parseFloat(i.subtotal_final))}`)
            .join('\n');
        const greeting = clientName ? `Hola, soy ${clientName}` : 'Hola';
        const msg = [
            `${greeting}! Acabo de realizar el pedido *#${orderNum}*${storeName ? ` en *${storeName}*` : ''}.`,
            '',
            `*Ítems:*`,
            itemsText,
            '',
            `*Total: ${formatPrice(parseFloat(order!.total))}*`,
            order!.direccion_envio ? `*Dirección:* ${order!.direccion_envio}` : '',
            '',
            `¿Pueden confirmarme el pedido? ¡Gracias!`,
        ].filter(l => l !== undefined).join('\n');

        const phone = whatsappPhone.replace(/\D/g, '');
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
        Linking.openURL(url).catch(() => {});
    };

    return (
        <>
            <Stack.Screen
                options={{
                    title: 'Pedido confirmado',
                    headerLeft: () => null, // Evitar volver al checkout
                    gestureEnabled: false,
                }}
            />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                bounces={false}
            >
                {/* ── Encabezado ── */}
                <View style={styles.header}>
                    <Text style={styles.checkmark}>✅</Text>
                    <Text style={styles.title}>¡Pedido recibido!</Text>
                    <View style={styles.orderNumberBadge}>
                        <Text style={styles.orderNumberLabel}>Número de pedido</Text>
                        <Text style={styles.orderNumber}>#{orderNum}</Text>
                    </View>
                    <Text style={styles.subtitle}>
                        El local recibió tu pedido y te avisará cuando esté listo.
                    </Text>
                </View>

                {/* ── Ítems ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>📦 Ítems del pedido</Text>
                    {order.items.map((item, idx) => (
                        <View key={idx} style={styles.itemRow}>
                            <Text style={styles.itemQty}>
                                {formatQty(item.quantity)}
                                <Text style={styles.itemUnit}> {item.unit_snapshot}</Text>
                            </Text>
                            <Text style={styles.itemName} numberOfLines={2}>
                                {item.name_snapshot}
                            </Text>
                            <Text style={styles.itemPrice}>
                                {formatPrice(parseFloat(item.subtotal_final))}
                            </Text>
                        </View>
                    ))}

                    {/* Descuento por puntos */}
                    {parseFloat(order.points_discount || '0') > 0 && (
                        <View style={[styles.itemRow, styles.discountRow]}>
                            <Text style={styles.discountLabel}>
                                🌟 Descuento puntos ({order.points_redeemed} pts)
                            </Text>
                            <Text style={styles.discountAmount}>
                                -{formatPrice(parseFloat(order.points_discount))}
                            </Text>
                        </View>
                    )}

                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalAmount}>{formatPrice(parseFloat(order.total))}</Text>
                    </View>
                </View>

                {/* ── Entrega ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>🚀 Entrega</Text>
                    <Text style={styles.infoText}>{deliveryLabel}</Text>
                    {order.direccion_envio ? (
                        <Text style={styles.infoSubtext}>{order.direccion_envio}</Text>
                    ) : null}
                    {order.is_scheduled && order.scheduled_at ? (
                        <Text style={styles.infoSubtext}>
                            📅 Programado para:{' '}
                            {new Date(order.scheduled_at).toLocaleString('es-AR', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                            })}
                        </Text>
                    ) : (
                        <Text style={styles.infoSubtext}>⏱️ Entrega inmediata</Text>
                    )}
                </View>

                {/* ── Pago ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                        {pm.icon} Pago: {pm.label}
                    </Text>
                    {pm.instructions ? (
                        <Text style={styles.infoText}>{pm.instructions}</Text>
                    ) : null}
                </View>

                {/* ── WhatsApp button ── */}
                {whatsappPhone ? (
                    <Pressable
                        style={styles.btnWhatsApp}
                        onPress={handleWhatsApp}
                        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                    >
                        <Text style={styles.btnWhatsAppText}>💬 Consultar por WhatsApp</Text>
                        <Text style={styles.btnWhatsAppSub}>
                            {isLoggedIn() ? 'Abre el chat con el detalle de tu pedido' : 'Iniciá sesión para vincular tu pedido'}
                        </Text>
                    </Pressable>
                ) : null}

                {/* ── Botones ── */}
                <View style={styles.buttons}>
                    <Pressable
                        style={styles.btnPrimary}
                        onPress={handleGoOrders}
                        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                    >
                        <Text style={styles.btnPrimaryText}>📋 Ver mis pedidos</Text>
                    </Pressable>

                    <Pressable
                        style={styles.btnSecondary}
                        onPress={handleGoHome}
                        android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
                    >
                        <Text style={styles.btnSecondaryText}>🛍️ Seguir comprando</Text>
                    </Pressable>
                </View>
            </ScrollView>

            {/* ── Modal: crear cuenta ── */}
            <Modal
                visible={showAccountModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowAccountModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalEmoji}>👤</Text>
                        <Text style={styles.modalTitle}>¿Tenés cuenta?</Text>
                        <Text style={styles.modalText}>
                            Para vincular el pedido con tu WhatsApp y hacer seguimiento, iniciá sesión o creá una cuenta gratis.
                        </Text>
                        <Pressable
                            style={styles.modalBtnPrimary}
                            onPress={() => {
                                setShowAccountModal(false);
                                router.push('/auth/login');
                            }}
                        >
                            <Text style={styles.modalBtnPrimaryText}>Iniciar sesión</Text>
                        </Pressable>
                        <Pressable
                            style={styles.modalBtnSecondary}
                            onPress={() => {
                                setShowAccountModal(false);
                                router.push('/auth/register');
                            }}
                        >
                            <Text style={styles.modalBtnSecondaryText}>Crear cuenta gratis</Text>
                        </Pressable>
                        <Pressable
                            style={styles.modalBtnSkip}
                            onPress={() => {
                                setShowAccountModal(false);
                                openWhatsApp();
                            }}
                        >
                            <Text style={styles.modalBtnSkipText}>Continuar sin cuenta</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const GREEN = '#1B5E20';
const LIGHT_GREEN = '#E8F5E9';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },

    // Header
    header: {
        alignItems: 'center',
        paddingVertical: 28,
        paddingHorizontal: 16,
    },
    checkmark: {
        fontSize: 64,
        marginBottom: 12,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: GREEN,
        marginBottom: 16,
    },
    orderNumberBadge: {
        backgroundColor: GREEN,
        borderRadius: 16,
        paddingHorizontal: 28,
        paddingVertical: 12,
        alignItems: 'center',
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
            },
            android: { elevation: 4 },
        }),
    },
    orderNumberLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    orderNumber: {
        color: '#fff',
        fontSize: 36,
        fontWeight: '800',
        letterSpacing: 2,
    },
    subtitle: {
        color: '#666',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },

    // Cards
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 3,
            },
            android: { elevation: 2 },
        }),
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#333',
        marginBottom: 12,
    },

    // Items
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        gap: 8,
    },
    itemQty: {
        fontSize: 14,
        fontWeight: '700',
        color: GREEN,
        minWidth: 36,
    },
    itemUnit: {
        fontSize: 11,
        fontWeight: '400',
        color: '#888',
    },
    itemName: {
        flex: 1,
        fontSize: 14,
        color: '#333',
    },
    itemPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    discountRow: {
        borderBottomWidth: 0,
        backgroundColor: LIGHT_GREEN,
        borderRadius: 6,
        marginTop: 4,
        paddingHorizontal: 8,
    },
    discountLabel: {
        flex: 1,
        fontSize: 13,
        color: GREEN,
    },
    discountAmount: {
        fontSize: 13,
        fontWeight: '700',
        color: GREEN,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 10,
        marginTop: 4,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
    },
    totalAmount: {
        fontSize: 18,
        fontWeight: '800',
        color: GREEN,
    },

    // Info
    infoText: {
        fontSize: 14,
        color: '#444',
        lineHeight: 20,
    },
    infoSubtext: {
        fontSize: 13,
        color: '#777',
        marginTop: 4,
    },

    // Hint
    hintBox: {
        backgroundColor: '#E3F2FD',
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        flexDirection: 'row',
    },
    hintText: {
        fontSize: 13,
        color: '#1565C0',
        lineHeight: 18,
    },

    // Buttons
    buttons: {
        gap: 10,
        marginTop: 4,
    },
    btnPrimary: {
        backgroundColor: GREEN,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    btnPrimaryText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    btnSecondary: {
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: GREEN,
    },
    btnSecondaryText: {
        color: GREEN,
        fontSize: 16,
        fontWeight: '600',
    },

    // WhatsApp button
    btnWhatsApp: {
        backgroundColor: '#25D366',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: 'center',
        marginBottom: 12,
        ...Platform.select({
            ios: { shadowColor: '#25D366', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6 },
            android: { elevation: 4 },
        }),
    },
    btnWhatsAppText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    btnWhatsAppSub: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 11,
        marginTop: 3,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 28,
        paddingBottom: 40,
        alignItems: 'center',
    },
    modalEmoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    modalText: {
        fontSize: 14,
        color: '#555',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    modalBtnPrimary: {
        backgroundColor: GREEN,
        borderRadius: 12,
        paddingVertical: 14,
        width: '100%',
        alignItems: 'center',
        marginBottom: 10,
    },
    modalBtnPrimaryText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    modalBtnSecondary: {
        backgroundColor: LIGHT_GREEN,
        borderRadius: 12,
        paddingVertical: 14,
        width: '100%',
        alignItems: 'center',
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: GREEN,
    },
    modalBtnSecondaryText: {
        color: GREEN,
        fontSize: 15,
        fontWeight: '600',
    },
    modalBtnSkip: {
        paddingVertical: 12,
    },
    modalBtnSkipText: {
        color: '#999',
        fontSize: 13,
    },
});
