import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    Pressable,
    Alert,
    ActivityIndicator,
    Keyboard,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { formatPrice } from '@/utils/format';
import { createOrder } from '@/services/api';
import * as Location from 'expo-location';
import LocationPickerMap from '@/components/LocationPickerMap';

type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'MIXTO';

export default function CheckoutScreen() {
    const { items, getTotal, clearCart } = useCartStore();
    const { isLoggedIn, clientName, clientPhone } = useAuthStore();
    const router = useRouter();
    const logged = isLoggedIn();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');
    const [cashAmount, setCashAmount] = useState('');
    const [tipoEntrega, setTipoEntrega] = useState<'LOCAL' | 'DELIVERY'>('LOCAL');
    const [direccion, setDireccion] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);

    // Get current location for the map
    useEffect(() => {
        (async () => {
            if (tipoEntrega === 'DELIVERY' && !mapLocation) {
                setLocationLoading(true);
                try {
                    let { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== 'granted') {
                        // Fallback to default (Salta)
                        setMapLocation({ lat: -24.7821, lng: -65.4232 });
                        setLocationLoading(false);
                        return;
                    }

                    let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    setMapLocation({
                        lat: location.coords.latitude,
                        lng: location.coords.longitude,
                    });
                } catch (error) {
                    setMapLocation({ lat: -24.7821, lng: -65.4232 });
                } finally {
                    setLocationLoading(false);
                }
            }
        })();
    }, [tipoEntrega]);

    // Auto-fill from auth store
    useEffect(() => {
        if (logged && clientName) setName(clientName);
        if (logged && clientPhone) setPhone(clientPhone);
    }, [logged, clientName, clientPhone]);

    const total = getTotal();

    const handleSubmit = async () => {
        // Validation
        const trimmedName = name.trim();
        const trimmedPhone = phone.trim();

        if (!trimmedName) {
            Alert.alert('Error', 'Ingresá tu nombre');
            return;
        }
        if (!trimmedPhone || trimmedPhone.length < 8) {
            Alert.alert('Error', 'Ingresá un teléfono válido');
            return;
        }
        if (items.length === 0) {
            Alert.alert('Error', 'Tu carrito está vacío');
            return;
        }
        if (tipoEntrega === 'DELIVERY') {
            if (!mapLocation) {
                Alert.alert('Error', 'Seleccioná tu ubicación en el mapa');
                return;
            }
            if (!direccion.trim()) {
                Alert.alert('Error', 'Ingresá el detalle de tu domicilio (Piso, depto, etc)');
                return;
            }
        }

        Keyboard.dismiss();
        setSubmitting(true);

        try {
            const orderItems = items.map((i) => ({
                product_id: i.product.id_producto,
                quantity: i.quantity,
            }));

            let payload: any = {
                source: 'CATALOG',
                tipo_entrega: tipoEntrega,
                direccion_envio: tipoEntrega === 'DELIVERY' ? direccion.trim() : undefined,
                latitud: tipoEntrega === 'DELIVERY' ? mapLocation?.lat : undefined,
                longitud: tipoEntrega === 'DELIVERY' ? mapLocation?.lng : undefined,
                client_name: trimmedName,
                client_phone: trimmedPhone,
                items: orderItems,
                payment_method: paymentMethod,
                notes: notes.trim(),
            };

            if (paymentMethod === 'MIXTO') {
                const cash = parseFloat(cashAmount);
                if (isNaN(cash) || cash < 0 || cash > total) {
                    Alert.alert('Error', 'Ingresá un monto en efectivo válido');
                    setSubmitting(false);
                    return;
                }
                payload.payment_amount_cash = cash;
                payload.payment_amount_transfer = total - cash;
            }

            const result = await createOrder(payload);

            clearCart();

            Alert.alert(
                '✅ ¡Pedido enviado!',
                `Pedido #${result.order.id}\n${result.message}\n\nTotal: ${formatPrice(result.order.total)}`,
                [
                    {
                        text: 'Volver al catálogo',
                        onPress: () => router.replace('/'),
                    },
                ]
            );
        } catch (err: any) {
            const msg =
                err?.response?.data?.items?.join('\n') ||
                err?.response?.data?.detail ||
                err?.message ||
                'Error al enviar el pedido';
            Alert.alert('Error', msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Stack.Screen options={{ title: 'Confirmar pedido' }} />
            <ScrollView
                style={styles.container}
                bounces={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Order Summary */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📦 Resumen</Text>
                    {items.map((item) => {
                        const price = parseFloat(item.product.price) || 0;
                        const isByWeight = item.product.sells_by_weight;
                        const unit = item.product.unit || 'Unid';
                        const qtyLabel = isByWeight
                            ? `${item.quantity} ${unit}`
                            : `${item.quantity}`;
                        return (
                            <View key={item.product.id_producto} style={styles.summaryItem}>
                                <View style={styles.summaryLeft}>
                                    <Text style={styles.summaryName} numberOfLines={1}>
                                        {item.product.nombre_producto}
                                    </Text>
                                    <Text style={styles.summaryQty}>
                                        {qtyLabel} × {formatPrice(price)}
                                    </Text>
                                </View>
                                <Text style={styles.summarySubtotal}>
                                    {formatPrice(price * item.quantity)}
                                </Text>
                            </View>
                        );
                    })}
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>{formatPrice(total)}</Text>
                    </View>
                </View>

                {/* Client Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>👤 Tus datos</Text>
                    {logged ? (
                        <View style={styles.loggedBanner}>
                            <Text style={styles.loggedBannerText}>
                                ✅ {clientName} · {clientPhone}
                            </Text>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.inputLabel}>Nombre *</Text>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="Tu nombre"
                                placeholderTextColor="#aaa"
                                autoCapitalize="words"
                            />
                            <Text style={styles.inputLabel}>Teléfono *</Text>
                            <TextInput
                                style={styles.input}
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="Ej: 1123456789"
                                placeholderTextColor="#aaa"
                                keyboardType="phone-pad"
                            />
                            <Pressable
                                style={styles.loginLink}
                                onPress={() => router.push('/login')}
                            >
                                <Text style={styles.loginLinkText}>
                                    ¿Ya tenés cuenta? Iniciá sesión →
                                </Text>
                            </Pressable>
                        </>
                    )}
                </View>

                {/* Tipo de Entrega */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🛵 Tipo de entrega</Text>
                    <View style={styles.paymentRow}>
                        <Pressable
                            style={[
                                styles.paymentOption,
                                tipoEntrega === 'LOCAL' && styles.paymentActive,
                            ]}
                            onPress={() => setTipoEntrega('LOCAL')}
                        >
                            <Text style={styles.paymentIcon}>🏪</Text>
                            <Text style={[styles.paymentText, tipoEntrega === 'LOCAL' && styles.paymentTextActive]}>
                                Retiro
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.paymentOption,
                                tipoEntrega === 'DELIVERY' && styles.paymentActive,
                            ]}
                            onPress={() => setTipoEntrega('DELIVERY')}
                        >
                            <Text style={styles.paymentIcon}>🛵</Text>
                            <Text style={[styles.paymentText, tipoEntrega === 'DELIVERY' && styles.paymentTextActive]}>
                                Envío
                            </Text>
                        </Pressable>
                    </View>

                    {tipoEntrega === 'DELIVERY' && (
                        <View style={styles.mixtoArea}>
                            <Text style={styles.inputLabel}>Ubicación de entrega *</Text>
                            <Text style={styles.mapHelpText}>Moví el mapa y centrá el puntero en tu casa real.</Text>

                            <View style={styles.mapContainer}>
                                {locationLoading && !mapLocation ? (
                                    <View style={styles.mapLoading}>
                                        <ActivityIndicator color="#1B5E20" size="large" />
                                        <Text style={{ marginTop: 8 }}>Buscando tu ubicación...</Text>
                                    </View>
                                ) : (
                                    <LocationPickerMap
                                        initialLocation={mapLocation || undefined}
                                        onLocationSelect={(lat, lng) => setMapLocation({ lat, lng })}
                                    />
                                )}
                            </View>

                            <Text style={styles.inputLabel}>Detalles de entrega (Piso, Depto) *</Text>
                            <TextInput
                                style={styles.input}
                                value={direccion}
                                onChangeText={setDireccion}
                                placeholder="Ej: Portón verde, depto 4B"
                                placeholderTextColor="#aaa"
                            />
                        </View>
                    )}
                </View>

                {/* Payment Method */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💳 Forma de pago</Text>
                    <View style={styles.paymentRow}>
                        <Pressable
                            style={[
                                styles.paymentOption,
                                paymentMethod === 'EFECTIVO' && styles.paymentActive,
                            ]}
                            onPress={() => setPaymentMethod('EFECTIVO')}
                        >
                            <Text style={styles.paymentIcon}>💵</Text>
                            <Text
                                style={[
                                    styles.paymentText,
                                    paymentMethod === 'EFECTIVO' && styles.paymentTextActive,
                                ]}
                            >
                                Efectivo
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.paymentOption,
                                paymentMethod === 'MIXTO' && styles.paymentActive,
                            ]}
                            onPress={() => setPaymentMethod('MIXTO')}
                        >
                            <Text style={styles.paymentIcon}>⚖️</Text>
                            <Text
                                style={[
                                    styles.paymentText,
                                    paymentMethod === 'MIXTO' && styles.paymentTextActive,
                                ]}
                            >
                                Mixto
                            </Text>
                        </Pressable>
                    </View>

                    {paymentMethod === 'MIXTO' && (
                        <View style={styles.mixtoArea}>
                            <Text style={styles.inputLabel}>Monto en efectivo (💵)</Text>
                            <TextInput
                                style={styles.input}
                                value={cashAmount}
                                onChangeText={setCashAmount}
                                placeholder="Ej: 500"
                                keyboardType="numeric"
                            />
                            {cashAmount !== '' && !isNaN(parseFloat(cashAmount)) && (
                                <Text style={styles.mixtoDetail}>
                                    📱 Restante por transferencia: {formatPrice(total - parseFloat(cashAmount))}
                                </Text>
                            )}
                        </View>
                    )}
                </View>

                {/* Notes */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📝 Notas (opcional)</Text>
                    <TextInput
                        style={[styles.input, styles.notesInput]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Ej: Sin cebolla, entregar después de las 5pm"
                        placeholderTextColor="#aaa"
                        multiline
                        numberOfLines={3}
                    />
                </View>

                {/* Submit */}
                <Pressable
                    style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitBtnText}>
                            🛒 Enviar pedido · {formatPrice(total)}
                        </Text>
                    )}
                </Pressable>

                <View style={{ height: 40 }} />
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    section: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
        marginBottom: 12,
    },
    // ─── Summary ───
    summaryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    summaryLeft: {
        flex: 1,
        marginRight: 12,
    },
    summaryName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    summaryQty: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    summarySubtotal: {
        fontSize: 14,
        fontWeight: '700',
        color: '#333',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1.5,
        borderTopColor: '#E0E0E0',
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    totalValue: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1B5E20',
    },
    // ─── Inputs ───
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#555',
        marginBottom: 6,
        marginTop: 8,
    },
    input: {
        borderWidth: 1.5,
        borderColor: '#D0D0D0',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        color: '#1a1a1a',
        backgroundColor: '#FAFAFA',
    },
    loggedBanner: {
        backgroundColor: '#E8F5E9',
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: '#A5D6A7',
    },
    loggedBannerText: {
        color: '#1B5E20',
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },
    loginLink: {
        alignItems: 'center',
        paddingVertical: 8,
        marginTop: 4,
    },
    loginLinkText: {
        color: '#1B5E20',
        fontSize: 13,
        fontWeight: '600',
    },
    notesInput: {
        height: 80,
        textAlignVertical: 'top',
    },
    // ─── Payment ───
    paymentRow: {
        flexDirection: 'row',
        gap: 12,
    },
    paymentOption: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#E0E0E0',
        backgroundColor: '#FAFAFA',
    },
    paymentActive: {
        borderColor: '#2E7D32',
        backgroundColor: '#E8F5E9',
    },
    paymentIcon: {
        fontSize: 28,
        marginBottom: 6,
    },
    paymentText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#555',
    },
    paymentTextActive: {
        color: '#2E7D32',
    },
    mixtoArea: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    mixtoDetail: {
        fontSize: 13,
        color: '#666',
        marginTop: 8,
        fontStyle: 'italic',
    },
    // ─── Submit ───
    submitBtn: {
        backgroundColor: '#1B5E20',
        marginHorizontal: 16,
        marginTop: 20,
        paddingVertical: 18,
        borderRadius: 14,
        alignItems: 'center',
        shadowColor: '#1B5E20',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    submitBtnDisabled: {
        opacity: 0.7,
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    mapContainer: {
        height: 250,
        marginVertical: 12,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#D0D0D0',
    },
    mapHelpText: {
        fontSize: 12,
        color: '#666',
        marginTop: -4,
        marginBottom: 4,
    },
    mapLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5'
    }
});
