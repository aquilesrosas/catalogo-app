import React, { useState, useEffect, useRef } from 'react';
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
    Platform,
    Linking,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { formatPrice } from '@/utils/format';
import { createOrder, getAvailableSlots, checkPaymentStatus, getStoreConfig, AttendanceSlot } from '@/services/api';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import LocationPickerMap from '@/components/LocationPickerMap';

type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'MIXTO' | 'MERCADOPAGO';

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

    // ─── Mercado Pago State ───
    const [mpWaiting, setMpWaiting] = useState(false);
    const [mpOrderId, setMpOrderId] = useState<number | null>(null);
    const [mpPaymentStatus, setMpPaymentStatus] = useState<string>('PENDING');
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ─── Scheduling State ───
    const [isScheduled, setIsScheduled] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1); // Default to tomorrow
        return d;
    });
    const [slots, setSlots] = useState<AttendanceSlot[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

    // ─── Transfer Details State ───
    const [transferAlias, setTransferAlias] = useState('');
    const [transferCbu, setTransferCbu] = useState('');
    const [transferHolder, setTransferHolder] = useState('');
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Fetch slots when date changes or isScheduled toggles
    useEffect(() => {
        if (!isScheduled) return;
        const fetchSlots = async () => {
            setLoadingSlots(true);
            try {
                const dateStr = selectedDate.toISOString().split('T')[0];
                const data = await getAvailableSlots(dateStr);
                setSlots(data);
                if (data.length > 0 && !data.find(s => s.time === selectedSlot)?.available) {
                    setSelectedSlot(null);
                }
            } catch (error) {
                console.error("Error fetching slots:", error);
                setSlots([]);
            } finally {
                setLoadingSlots(false);
            }
        };
        fetchSlots();
    }, [isScheduled, selectedDate]);

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

    // Fetch store config for transfer details
    useEffect(() => {
        (async () => {
            try {
                const config = await getStoreConfig();
                const cc = config.catalog_config || {};
                setTransferAlias((cc.transfer_alias as string) || '');
                setTransferCbu((cc.transfer_cbu as string) || '');
                setTransferHolder((cc.transfer_holder as string) || '');
            } catch { }
        })();
    }, []);

    // Auto-fill from auth store
    useEffect(() => {
        if (logged && clientName) setName(clientName);
        if (logged && clientPhone) setPhone(clientPhone);
    }, [logged, clientName, clientPhone]);

    const total = getTotal();

    // Cross-platform alert that works on web
    const showAlert = (title: string, message: string, onOk?: () => void) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}\n\n${message}`);
            if (onOk) onOk();
        } else {
            Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
        }
    };

    const handleSubmit = async () => {
        console.log('[Checkout] handleSubmit called');
        // Validation
        const trimmedName = name.trim();
        const trimmedPhone = phone.trim();

        if (!trimmedName) {
            showAlert('Error', 'Ingresá tu nombre');
            return;
        }
        if (!trimmedPhone || trimmedPhone.length < 8) {
            showAlert('Error', 'Ingresá un teléfono válido');
            return;
        }
        if (items.length === 0) {
            showAlert('Error', 'Tu carrito está vacío');
            return;
        }
        if (tipoEntrega === 'DELIVERY') {
            if (!mapLocation) {
                showAlert('Error', 'Seleccioná tu ubicación en el mapa');
                return;
            }
            if (!direccion.trim()) {
                showAlert('Error', 'Ingresá el detalle de tu domicilio (Piso, depto, etc)');
                return;
            }
        }

        if (isScheduled && !selectedSlot) {
            showAlert('Error', 'Seleccioná un horario para tu pedido');
            return;
        }

        Keyboard.dismiss();
        setSubmitting(true);
        console.log('[Checkout] Validation passed, submitting...');

        try {
            const orderItems = items.map((i) => ({
                product_id: i.product.id_producto,
                quantity: i.quantity,
                extras_ids: i.extras_ids,
                notes: i.description || undefined,
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

            if (isScheduled && selectedSlot) {
                const dateStr = selectedDate.toISOString().split('T')[0];
                payload.scheduled_at = `${dateStr}T${selectedSlot}:00`;
                payload.order_type = 'scheduled';
            } else {
                payload.order_type = 'instant';
            }

            if (paymentMethod === 'MIXTO') {
                const cash = parseFloat(cashAmount);
                if (isNaN(cash) || cash < 0 || cash > total) {
                    showAlert('Error', 'Ingresá un monto en efectivo válido');
                    setSubmitting(false);
                    return;
                }
                payload.payment_amount_cash = cash;
                payload.payment_amount_transfer = total - cash;
            }

            console.log('[Checkout] Sending payload:', JSON.stringify(payload));
            const result = await createOrder(payload);
            console.log('[Checkout] Order result:', JSON.stringify(result));

            // ── Mercado Pago: abrir checkout y esperar ──
            if (paymentMethod === 'MERCADOPAGO' && result.payment_url) {
                const orderId = result.order?.id;
                setMpOrderId(orderId);
                setMpWaiting(true);
                setMpPaymentStatus('PENDING');

                // Abrir link de pago en navegador
                try {
                    await Linking.openURL(result.payment_url);
                } catch (e) {
                    console.error('Error opening MP URL:', e);
                }

                // Iniciar polling cada 3 segundos
                pollingRef.current = setInterval(async () => {
                    try {
                        const status = await checkPaymentStatus(orderId);
                        setMpPaymentStatus(status.payment_status);

                        if (status.payment_status === 'VERIFIED') {
                            // Pago confirmado!
                            if (pollingRef.current) clearInterval(pollingRef.current);
                            clearCart();
                            showAlert(
                                '✅ ¡Pago confirmado!',
                                `Tu pedido #${orderId} fue pagado exitosamente con Mercado Pago.\nTotal: ${formatPrice(result.order?.total || total)}`,
                                () => router.replace('/')
                            );
                            setMpWaiting(false);
                        } else if (status.payment_status === 'FAILED' || status.payment_status === 'EXPIRED') {
                            if (pollingRef.current) clearInterval(pollingRef.current);
                            showAlert(
                                '❌ Pago no completado',
                                'El pago fue rechazado o expiró. Tu pedido fue creado, podés intentar pagarlo de nuevo.',
                            );
                            setMpWaiting(false);
                        }
                    } catch {
                        // silenciar errores de polling
                    }
                }, 3000);

                // Timeout: dejar de esperar después de 5 minutos
                setTimeout(() => {
                    if (pollingRef.current) {
                        clearInterval(pollingRef.current);
                        clearCart();
                        setMpWaiting(false);
                    }
                }, 5 * 60 * 1000);

                setSubmitting(false);
                return;
            }

            clearCart();

            // Handle different response formats from backend
            const order = result?.order || result;
            const orderId = order?.id || (order as any)?.id_pedido || '?';
            const orderTotal = order?.total || total;
            const orderMessage = result?.message || 'Pedido creado exitosamente';

            showAlert(
                '✅ ¡Pedido enviado!',
                `Pedido #${orderId}\n${orderMessage}\n\nTotal: ${formatPrice(orderTotal)}`,
                () => router.replace('/')
            );
        } catch (err: any) {
            console.error('[Checkout] Error sending order:', err);
            console.error('[Checkout] Response data:', JSON.stringify(err?.response?.data));
            const msg =
                err?.response?.data?.items?.join('\n') ||
                err?.response?.data?.detail ||
                err?.response?.data?.error ||
                err?.response?.data?.non_field_errors?.join('\n') ||
                err?.message ||
                'Error al enviar el pedido';
            showAlert('Error', msg);
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
                        const price = parseFloat(item.product.price || (item.product as any).precio_venta) || 0;
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
                                    {item.description ? (
                                        <Text style={styles.summaryExtras}>{item.description}</Text>
                                    ) : null}
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
                            <Text style={styles.mapHelpText}>Buscá tu dirección y ajustá con el mapa para mayor precisión.</Text>

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
                                        onAddressResolved={(address) => {
                                            // Always update with the latest resolved address
                                            setDireccion(address);
                                        }}
                                    />
                                )}
                            </View>

                            <Text style={styles.inputLabel}>Dirección de entrega *</Text>
                            <TextInput
                                style={styles.input}
                                value={direccion}
                                onChangeText={setDireccion}
                                placeholder="Ej: Av. San Martín 123, Piso 2B"
                                placeholderTextColor="#aaa"
                            />
                        </View>
                    )}
                </View>

                {/* Scheduling Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🕒 ¿Cuándo querés tu pedido?</Text>
                    <View style={styles.paymentRow}>
                        <Pressable
                            style={[
                                styles.paymentOption,
                                !isScheduled && styles.paymentActive,
                            ]}
                            onPress={() => setIsScheduled(false)}
                        >
                            <Text style={styles.paymentIcon}>⚡</Text>
                            <Text style={[styles.paymentText, !isScheduled && styles.paymentTextActive]}>
                                Lo antes posible
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.paymentOption,
                                isScheduled && styles.paymentActive,
                            ]}
                            onPress={() => setIsScheduled(true)}
                        >
                            <Text style={styles.paymentIcon}>📅</Text>
                            <Text style={[styles.paymentText, isScheduled && styles.paymentTextActive]}>
                                Programar
                            </Text>
                        </Pressable>
                    </View>

                    {isScheduled && (
                        <View style={styles.schedulingArea}>
                            <Text style={styles.innerSectionTitle}>Seleccioná el día</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
                                {[1, 2, 3, 4, 5, 6, 7].map((offset) => {
                                    const d = new Date();
                                    d.setDate(d.getDate() + offset);
                                    const isActive = d.toDateString() === selectedDate.toDateString();
                                    const dayName = d.toLocaleDateString('es-AR', { weekday: 'short' });
                                    const dayNum = d.getDate();
                                    return (
                                        <Pressable
                                            key={offset}
                                            style={[styles.dayCard, isActive && styles.dayCardActive]}
                                            onPress={() => setSelectedDate(d)}
                                        >
                                            <Text style={[styles.dayName, isActive && styles.dayCardTextActive]}>{dayName}</Text>
                                            <Text style={[styles.dayNum, isActive && styles.dayCardTextActive]}>{dayNum}</Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>

                            <Text style={styles.innerSectionTitle}>Horarios disponibles</Text>
                            {loadingSlots ? (
                                <ActivityIndicator color="#1B5E20" style={{ marginVertical: 20 }} />
                            ) : slots.length > 0 ? (
                                <View style={styles.slotsGrid}>
                                    {slots.map((slot) => (
                                        <Pressable
                                            key={slot.time}
                                            disabled={!slot.available}
                                            style={[
                                                styles.slotBtn,
                                                selectedSlot === slot.time && styles.slotBtnActive,
                                                !slot.available && styles.slotBtnDisabled,
                                            ]}
                                            onPress={() => setSelectedSlot(slot.time)}
                                        >
                                            <Text style={[
                                                styles.slotText,
                                                selectedSlot === slot.time && styles.slotTextActive,
                                                !slot.available && styles.slotTextDisabled
                                            ]}>
                                                {slot.time}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            ) : (
                                <Text style={styles.noSlotsText}>No hay horarios disponibles para este día.</Text>
                            )}

                            {selectedSlot && (
                                <View style={styles.selectionSummary}>
                                    <Text style={styles.selectionSummaryText}>
                                        Tu pedido será preparado el {selectedDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} a las {selectedSlot} hs
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>

                {/* Payment Method Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💳 Medio de pago</Text>
                    <View style={styles.paymentRow}>
                        <Pressable
                            style={[
                                styles.paymentOption,
                                paymentMethod === 'EFECTIVO' && styles.paymentActive,
                            ]}
                            onPress={() => setPaymentMethod('EFECTIVO')}
                        >
                            <Text style={styles.paymentIcon}>💵</Text>
                            <Text style={[styles.paymentText, paymentMethod === 'EFECTIVO' && styles.paymentTextActive]}>
                                Efectivo
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.paymentOption,
                                paymentMethod === 'TRANSFERENCIA' && styles.paymentActive,
                            ]}
                            onPress={() => setPaymentMethod('TRANSFERENCIA')}
                        >
                            <Text style={styles.paymentIcon}>📱</Text>
                            <Text style={[styles.paymentText, paymentMethod === 'TRANSFERENCIA' && styles.paymentTextActive]}>
                                Transferencia
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.paymentOption,
                                paymentMethod === 'MIXTO' && styles.paymentActive,
                            ]}
                            onPress={() => setPaymentMethod('MIXTO')}
                        >
                            <Text style={styles.paymentIcon}>🔄</Text>
                            <Text style={[styles.paymentText, paymentMethod === 'MIXTO' && styles.paymentTextActive]}>
                                Mixto
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.paymentOption,
                                paymentMethod === 'MERCADOPAGO' && styles.mpActive,
                            ]}
                            onPress={() => setPaymentMethod('MERCADOPAGO')}
                        >
                            <Text style={styles.paymentIcon}>💳</Text>
                            <Text style={[styles.paymentText, paymentMethod === 'MERCADOPAGO' && styles.mpTextActive]}>
                                Mercado Pago
                            </Text>
                        </Pressable>
                    </View>

                    {/* Transfer Bank Details */}
                    {(paymentMethod === 'TRANSFERENCIA' || paymentMethod === 'MIXTO') && transferAlias ? (
                        <View style={styles.transferCard}>
                            <View style={styles.transferHeader}>
                                <Text style={styles.transferHeaderText}>🏦 Datos para transferir</Text>
                            </View>
                            {transferHolder ? (
                                <View style={styles.transferRow}>
                                    <Text style={styles.transferLabel}>Titular</Text>
                                    <Text style={styles.transferValue}>{transferHolder}</Text>
                                </View>
                            ) : null}
                            <View style={styles.transferRow}>
                                <Text style={styles.transferLabel}>Alias</Text>
                                <View style={styles.transferCopyRow}>
                                    <Text style={styles.transferValueMono}>{transferAlias}</Text>
                                    <Pressable
                                        style={styles.copyBtn}
                                        onPress={async () => {
                                            try {
                                                await Clipboard.setStringAsync(transferAlias);
                                                setCopiedField('alias');
                                                setTimeout(() => setCopiedField(null), 2000);
                                            } catch { }
                                        }}
                                    >
                                        <Text style={styles.copyBtnText}>
                                            {copiedField === 'alias' ? '✅' : '📋'}
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                            {transferCbu ? (
                                <View style={styles.transferRow}>
                                    <Text style={styles.transferLabel}>CBU/CVU</Text>
                                    <View style={styles.transferCopyRow}>
                                        <Text style={styles.transferValueMono}>{transferCbu}</Text>
                                        <Pressable
                                            style={styles.copyBtn}
                                            onPress={async () => {
                                                try {
                                                    await Clipboard.setStringAsync(transferCbu);
                                                    setCopiedField('cbu');
                                                    setTimeout(() => setCopiedField(null), 2000);
                                                } catch { }
                                            }}
                                        >
                                            <Text style={styles.copyBtnText}>
                                                {copiedField === 'cbu' ? '✅' : '📋'}
                                            </Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ) : null}
                            <View style={styles.transferNote}>
                                <Text style={styles.transferNoteText}>
                                    💡 Enviá el comprobante por WhatsApp después de transferir
                                </Text>
                            </View>
                        </View>
                    ) : (paymentMethod === 'TRANSFERENCIA' || paymentMethod === 'MIXTO') && !transferAlias ? (
                        <View style={styles.transferCardEmpty}>
                            <Text style={styles.transferEmptyText}>
                                ⚠️ La tienda aún no configuró los datos de transferencia. Te contactaremos para darte los datos.
                            </Text>
                        </View>
                    ) : null}

                    {paymentMethod === 'MIXTO' && (
                        <View style={styles.mixtoArea}>
                            <Text style={styles.inputLabel}>Monto a pagar en Efectivo</Text>
                            <TextInput
                                style={styles.input}
                                value={cashAmount}
                                onChangeText={setCashAmount}
                                placeholder={`Ej: ${(total / 2).toFixed(2)}`}
                                placeholderTextColor="#aaa"
                                keyboardType="numeric"
                            />
                            {Boolean(cashAmount) && !isNaN(parseFloat(cashAmount)) && (
                                <Text style={styles.mixtoDetail}>
                                    Se cobrará {formatPrice(total - parseFloat(cashAmount))} por transferencia.
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

            {/* ── Mercado Pago: Pantalla de espera ── */}
            {mpWaiting && (
                <View style={styles.mpOverlay}>
                    <View style={styles.mpWaitingCard}>
                        {mpPaymentStatus === 'PENDING' || mpPaymentStatus === 'IN_PROCESS' ? (
                            <>
                                <ActivityIndicator size="large" color="#009ee3" />
                                <Text style={styles.mpWaitingTitle}>Verificando tu pago...</Text>
                                <Text style={styles.mpWaitingSubtitle}>
                                    Completá el pago en Mercado Pago y volvé a esta pantalla.
                                </Text>
                                <Pressable
                                    style={styles.mpCheckBtn}
                                    onPress={async () => {
                                        if (!mpOrderId) return;
                                        try {
                                            const s = await checkPaymentStatus(mpOrderId);
                                            setMpPaymentStatus(s.payment_status);
                                            if (s.payment_status === 'VERIFIED') {
                                                if (pollingRef.current) clearInterval(pollingRef.current);
                                                clearCart();
                                                showAlert('✅ ¡Pago confirmado!', 'Tu pedido fue pagado exitosamente.', () => router.replace('/'));
                                                setMpWaiting(false);
                                            } else {
                                                showAlert('⏳', `Estado actual: ${s.payment_status}. Seguimos esperando...`);
                                            }
                                        } catch {
                                            showAlert('Error', 'No se pudo verificar. Intentá de nuevo.');
                                        }
                                    }}
                                >
                                    <Text style={styles.mpCheckBtnText}>✅ Ya pagué</Text>
                                </Pressable>
                                <Pressable
                                    style={styles.mpCancelBtn}
                                    onPress={() => {
                                        if (pollingRef.current) clearInterval(pollingRef.current);
                                        clearCart();
                                        setMpWaiting(false);
                                        showAlert('Pedido creado', 'Tu pedido fue creado. Podés pagar más tarde desde tu historial.', () => router.replace('/'));
                                    }}
                                >
                                    <Text style={styles.mpCancelBtnText}>Cancelar espera</Text>
                                </Pressable>
                            </>
                        ) : null}
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
    summaryExtras: {
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
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
        height: 350,
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
    },
    // ─── Scheduling Styles ───
    schedulingArea: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    innerSectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 10,
    },
    daysScroll: {
        marginBottom: 20,
    },
    dayCard: {
        width: 60,
        height: 70,
        borderRadius: 12,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    dayCardActive: {
        backgroundColor: '#1B5E20',
        borderColor: '#1B5E20',
    },
    dayName: {
        fontSize: 12,
        color: '#666',
        textTransform: 'capitalize',
    },
    dayNum: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
        marginTop: 2,
    },
    dayCardTextActive: {
        color: '#fff',
    },
    slotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    slotBtn: {
        width: '23%',
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    slotBtnActive: {
        backgroundColor: '#E8F5E9',
        borderColor: '#2E7D32',
    },
    slotBtnDisabled: {
        opacity: 0.4,
        backgroundColor: '#eee',
    },
    slotText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#555',
    },
    slotTextActive: {
        color: '#2E7D32',
    },
    slotTextDisabled: {
        color: '#aaa',
    },
    noSlotsText: {
        textAlign: 'center',
        color: '#888',
        marginVertical: 20,
        fontStyle: 'italic',
    },
    selectionSummary: {
        marginTop: 20,
        backgroundColor: '#FFF9C4',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FFF176',
    },
    selectionSummaryText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#7F5F01',
        lineHeight: 18,
    },
    // ─── Mercado Pago Styles ───
    mpActive: {
        borderColor: '#009ee3',
        backgroundColor: '#e6f7ff',
    },
    mpTextActive: {
        color: '#009ee3',
        fontWeight: '700',
    },
    mpOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
    },
    mpWaitingCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 32,
        marginHorizontal: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        width: '85%',
    },
    mpWaitingTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a1a1a',
        marginTop: 20,
        textAlign: 'center',
    },
    mpWaitingSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },
    mpCheckBtn: {
        backgroundColor: '#009ee3',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        marginTop: 24,
        width: '100%',
        alignItems: 'center',
    },
    mpCheckBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    mpCancelBtn: {
        paddingVertical: 12,
        marginTop: 12,
    },
    mpCancelBtnText: {
        color: '#999',
        fontSize: 14,
    },
    // ─── Transfer Card Styles ───
    transferCard: {
        marginTop: 12,
        backgroundColor: '#f0f7ff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#b3d4fc',
        overflow: 'hidden',
    },
    transferHeader: {
        backgroundColor: '#1565C0',
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    transferHeaderText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    transferRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#d6e8f7',
    },
    transferLabel: {
        fontSize: 13,
        color: '#666',
        fontWeight: '600',
        minWidth: 70,
    },
    transferValue: {
        fontSize: 14,
        color: '#1a1a1a',
        fontWeight: '600',
        flex: 1,
        textAlign: 'right',
    },
    transferCopyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'flex-end',
        gap: 8,
    },
    transferValueMono: {
        fontSize: 14,
        color: '#1a1a1a',
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    copyBtn: {
        backgroundColor: '#1565C0',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    copyBtnText: {
        fontSize: 14,
    },
    transferNote: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: '#e8f4e8',
    },
    transferNoteText: {
        fontSize: 12,
        color: '#2E7D32',
        fontWeight: '500',
    },
    transferCardEmpty: {
        marginTop: 12,
        backgroundColor: '#FFF8E1',
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: '#FFE082',
    },
    transferEmptyText: {
        fontSize: 13,
        color: '#F57F17',
        lineHeight: 18,
    },
});
