/**
 * Pantalla de reservas de barbería.
 *
 * Flujo:
 *   1. Seleccionar servicio
 *   2. Seleccionar barbero
 *   3. Seleccionar fecha
 *   4. Seleccionar horario (slots disponibles)
 *   5. Confirmar
 *
 * Tab "Mis turnos" muestra reservas del cliente.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    ActivityIndicator, Alert, StyleSheet,
    ScrollView, RefreshControl, Platform,
} from 'react-native';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

// ── Types ─────────────────────────────────────────────────────────────────

interface BarberService {
    id: number;
    name: string;
    duration_minutes: number;
    price: string;
}

interface Barber {
    id: number;
    name: string;
    bio: string;
}

interface Slot {
    time: string;
    datetime: string;
    available: boolean;
}

interface Appointment {
    id: number;
    barber_id: number;
    barber_name: string;
    service_name: string;
    service_price: string;
    duration_minutes: number;
    scheduled_at: string;
    end_at: string | null;
    status: string;
    status_display: string;
}

type Step = 'service' | 'barber' | 'date' | 'slots' | 'confirm';

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', {
        weekday: 'long', day: 'numeric', month: 'long',
    });
}

function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function statusColor(status: string) {
    switch (status) {
        case 'CONFIRMED': return '#1B5E20';
        case 'IN_SERVICE': return '#1565C0';
        case 'COMPLETED': return '#555';
        case 'CANCELLED': return '#B71C1C';
        case 'NO_SHOW': return '#E65100';
        default: return '#888';
    }
}

/** Genera los 7 próximos días (a partir de mañana) */
function nextDays(n = 14): { label: string; value: string }[] {
    const days = [];
    const now = new Date();
    for (let i = 1; i <= n; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        const value = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('es-AR', {
            weekday: 'short', day: 'numeric', month: 'short',
        });
        days.push({ label, value });
    }
    return days;
}

// ── Main Screen ───────────────────────────────────────────────────────────

export default function BarberScreen() {
    const { isLoggedIn } = useAuthStore();
    const [mainTab, setMainTab] = useState<'book' | 'mine'>('book');

    // ── Booking state ──
    const [step, setStep] = useState<Step>('service');
    const [services, setServices] = useState<BarberService[]>([]);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [slots, setSlots] = useState<Slot[]>([]);

    const [selectedService, setSelectedService] = useState<BarberService | null>(null);
    const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

    const [loadingServices, setLoadingServices] = useState(true);
    const [loadingBarbers, setLoadingBarbers] = useState(false);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [booking, setBooking] = useState(false);

    // ── My appointments ──
    const [myAppts, setMyAppts] = useState<Appointment[]>([]);
    const [loadingMine, setLoadingMine] = useState(false);
    const [refreshingMine, setRefreshingMine] = useState(false);
    const [cancelling, setCancelling] = useState<number | null>(null);

    const days = nextDays(14);

    // ── Load services on mount ──
    useEffect(() => {
        api.get('/barber/services/')
            .then(r => setServices(Array.isArray(r.data) ? r.data : []))
            .catch(() => setServices([]))
            .finally(() => setLoadingServices(false));
    }, []);

    // ── Load barbers after service selected ──
    useEffect(() => {
        if (step !== 'barber') return;
        setLoadingBarbers(true);
        api.get('/barber/barbers/')
            .then(r => setBarbers(Array.isArray(r.data) ? r.data : []))
            .catch(() => setBarbers([]))
            .finally(() => setLoadingBarbers(false));
    }, [step]);

    // ── Load slots after date selected ──
    useEffect(() => {
        if (step !== 'slots' || !selectedBarber || !selectedService || !selectedDate) return;
        setLoadingSlots(true);
        setSlots([]);
        api.get('/barber/slots/', {
            params: {
                barber_id: selectedBarber.id,
                service_id: selectedService.id,
                date: selectedDate,
            },
        })
            .then(r => setSlots(r.data.slots || []))
            .catch(() => Alert.alert('Error', 'No se pudieron cargar los horarios.'))
            .finally(() => setLoadingSlots(false));
    }, [step, selectedBarber, selectedService, selectedDate]);

    // ── Load my appointments ──
    const loadMyAppts = useCallback(async (silent = false) => {
        if (!isLoggedIn()) return;
        if (!silent) setLoadingMine(true);
        try {
            const r = await api.get('/barber/my-appointments/');
            setMyAppts(r.data);
        } catch { }
        setLoadingMine(false);
        setRefreshingMine(false);
    }, [isLoggedIn]);

    useEffect(() => {
        if (mainTab === 'mine') loadMyAppts();
    }, [mainTab]);

    // ── Confirm booking ──
    const confirmBooking = async () => {
        if (!selectedService || !selectedBarber || !selectedSlot) return;
        if (!isLoggedIn()) {
            Alert.alert('Iniciá sesión', 'Necesitás estar logueado para reservar un turno.');
            return;
        }
        setBooking(true);
        try {
            await api.post('/barber/book/', {
                barber_id: selectedBarber.id,
                service_id: selectedService.id,
                scheduled_at: selectedSlot.datetime,
            });
            Alert.alert('✅ Turno reservado', `Tu turno de ${selectedService.name} fue confirmado para ${formatDate(selectedSlot.datetime)} a las ${selectedSlot.time}.`);
            // Reset
            setStep('service');
            setSelectedService(null);
            setSelectedBarber(null);
            setSelectedDate('');
            setSelectedSlot(null);
            setMainTab('mine');
            loadMyAppts();
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Ocurrió un error. Intentá de nuevo.';
            Alert.alert('Error', msg);
        } finally {
            setBooking(false);
        }
    };

    // ── Cancel appointment ──
    const cancelAppt = (apptId: number) => {
        Alert.alert('Cancelar turno', '¿Estás seguro que querés cancelar este turno?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Sí, cancelar', style: 'destructive', onPress: async () => {
                    setCancelling(apptId);
                    try {
                        await api.delete(`/barber/appointment/${apptId}/`);
                        setMyAppts(prev => prev.map(a =>
                            a.id === apptId ? { ...a, status: 'CANCELLED', status_display: 'Cancelado' } : a
                        ));
                    } catch (err: any) {
                        Alert.alert('Error', err?.response?.data?.error || 'No se pudo cancelar.');
                    } finally {
                        setCancelling(null);
                    }
                },
            },
        ]);
    };

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <View style={s.container}>
            {/* Tab selector */}
            <View style={s.tabs}>
                <TouchableOpacity
                    style={[s.tab, mainTab === 'book' && s.tabActive]}
                    onPress={() => setMainTab('book')}
                >
                    <Text style={[s.tabText, mainTab === 'book' && s.tabTextActive]}>✂️ Reservar turno</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[s.tab, mainTab === 'mine' && s.tabActive]}
                    onPress={() => setMainTab('mine')}
                >
                    <Text style={[s.tabText, mainTab === 'mine' && s.tabTextActive]}>📋 Mis turnos</Text>
                </TouchableOpacity>
            </View>

            {mainTab === 'book' ? (
                <BookingFlow
                    step={step} setStep={setStep}
                    services={services} loadingServices={loadingServices}
                    barbers={barbers} loadingBarbers={loadingBarbers}
                    days={days}
                    slots={slots} loadingSlots={loadingSlots}
                    selectedService={selectedService} setSelectedService={setSelectedService}
                    selectedBarber={selectedBarber} setSelectedBarber={setSelectedBarber}
                    selectedDate={selectedDate} setSelectedDate={setSelectedDate}
                    selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot}
                    booking={booking} confirmBooking={confirmBooking}
                />
            ) : (
                <MyAppointments
                    appts={myAppts}
                    loading={loadingMine}
                    refreshing={refreshingMine}
                    onRefresh={() => { setRefreshingMine(true); loadMyAppts(true); }}
                    cancelling={cancelling}
                    onCancel={cancelAppt}
                    isLoggedIn={isLoggedIn()}
                />
            )}
        </View>
    );
}

// ── BookingFlow ───────────────────────────────────────────────────────────

function BookingFlow({
    step, setStep,
    services, loadingServices,
    barbers, loadingBarbers,
    days,
    slots, loadingSlots,
    selectedService, setSelectedService,
    selectedBarber, setSelectedBarber,
    selectedDate, setSelectedDate,
    selectedSlot, setSelectedSlot,
    booking, confirmBooking,
}: any) {

    // Breadcrumb
    const stepLabel: Record<Step, string> = {
        service: '1. Servicio',
        barber: '2. Barbero',
        date: '3. Fecha',
        slots: '4. Horario',
        confirm: '5. Confirmar',
    };

    return (
        <View style={{ flex: 1 }}>
            {/* Breadcrumb */}
            <View style={s.breadcrumb}>
                {(['service', 'barber', 'date', 'slots', 'confirm'] as Step[]).map((st, i) => (
                    <View key={st} style={s.breadcrumbItem}>
                        <View style={[s.dot, step === st && s.dotActive, steps_before(step, st) && s.dotDone]} />
                        <Text style={[s.dotLabel, step === st && s.dotLabelActive]}>{stepLabel[st].split(' ')[0]}</Text>
                    </View>
                ))}
            </View>

            {/* Step content */}
            {step === 'service' && (
                <ServiceStep
                    services={services} loading={loadingServices}
                    onSelect={(s: BarberService) => { setSelectedService(s); setStep('barber'); }}
                />
            )}
            {step === 'barber' && (
                <BarberStep
                    barbers={barbers} loading={loadingBarbers}
                    onBack={() => setStep('service')}
                    onSelect={(b: Barber) => { setSelectedBarber(b); setStep('date'); }}
                />
            )}
            {step === 'date' && (
                <DateStep
                    days={days}
                    selected={selectedDate}
                    onBack={() => setStep('barber')}
                    onSelect={(d: string) => { setSelectedDate(d); setStep('slots'); }}
                />
            )}
            {step === 'slots' && (
                <SlotsStep
                    slots={slots} loading={loadingSlots}
                    onBack={() => setStep('date')}
                    onSelect={(sl: Slot) => { setSelectedSlot(sl); setStep('confirm'); }}
                />
            )}
            {step === 'confirm' && selectedService && selectedBarber && selectedSlot && (
                <ConfirmStep
                    service={selectedService} barber={selectedBarber} slot={selectedSlot}
                    onBack={() => setStep('slots')}
                    onConfirm={confirmBooking} loading={booking}
                />
            )}
        </View>
    );
}

function steps_before(current: Step, target: Step): boolean {
    const order: Step[] = ['service', 'barber', 'date', 'slots', 'confirm'];
    return order.indexOf(current) > order.indexOf(target);
}

// ── Step components ───────────────────────────────────────────────────────

function ServiceStep({ services, loading, onSelect }: any) {
    if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#1B5E20" />;
    if (!Array.isArray(services) || !services.length) return <EmptyState text="No hay servicios disponibles." />;
    return (
        <ScrollView contentContainerStyle={s.listPad}>
            <Text style={s.stepTitle}>¿Qué servicio querés?</Text>
            {services.map((sv: BarberService) => (
                <TouchableOpacity key={sv.id} style={s.card} onPress={() => onSelect(sv)}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.cardTitle}>✂️ {sv.name}</Text>
                        <Text style={s.cardSub}>{sv.duration_minutes} min</Text>
                    </View>
                    <Text style={s.price}>${sv.price}</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}

function BarberStep({ barbers, loading, onBack, onSelect }: any) {
    if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#1B5E20" />;
    return (
        <ScrollView contentContainerStyle={s.listPad}>
            <BackButton onPress={onBack} />
            <Text style={s.stepTitle}>Elegí tu barbero</Text>
            {!barbers.length && <EmptyState text="No hay barberos disponibles." />}
            {barbers.map((b: Barber) => (
                <TouchableOpacity key={b.id} style={s.card} onPress={() => onSelect(b)}>
                    <View style={s.avatar}>
                        <Text style={s.avatarText}>{b.name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.cardTitle}>💈 {b.name}</Text>
                        {!!b.bio && <Text style={s.cardSub}>{b.bio}</Text>}
                    </View>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}

function DateStep({ days, selected, onBack, onSelect }: any) {
    return (
        <ScrollView contentContainerStyle={s.listPad}>
            <BackButton onPress={onBack} />
            <Text style={s.stepTitle}>Elegí una fecha</Text>
            <View style={s.daysGrid}>
                {days.map((d: any) => (
                    <TouchableOpacity
                        key={d.value}
                        style={[s.dayChip, selected === d.value && s.dayChipActive]}
                        onPress={() => onSelect(d.value)}
                    >
                        <Text style={[s.dayChipText, selected === d.value && s.dayChipTextActive]}>
                            {d.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );
}

function SlotsStep({ slots, loading, onBack, onSelect }: any) {
    if (loading) return (
        <View style={{ flex: 1 }}>
            <BackButton onPress={onBack} />
            <ActivityIndicator style={{ marginTop: 40 }} color="#1B5E20" />
        </View>
    );
    const available = slots.filter((sl: Slot) => sl.available);
    return (
        <ScrollView contentContainerStyle={s.listPad}>
            <BackButton onPress={onBack} />
            <Text style={s.stepTitle}>Elegí un horario</Text>
            {!available.length && <EmptyState text="No hay horarios disponibles para este día. Probá otra fecha." />}
            <View style={s.slotsGrid}>
                {slots.map((sl: Slot) => (
                    <TouchableOpacity
                        key={sl.datetime}
                        style={[s.slot, !sl.available && s.slotTaken]}
                        onPress={() => sl.available && onSelect(sl)}
                        disabled={!sl.available}
                    >
                        <Text style={[s.slotText, !sl.available && s.slotTextTaken]}>{sl.time}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );
}

function ConfirmStep({ service, barber, slot, onBack, onConfirm, loading }: any) {
    return (
        <ScrollView contentContainerStyle={s.listPad}>
            <BackButton onPress={onBack} />
            <Text style={s.stepTitle}>Confirmar turno</Text>
            <View style={s.summary}>
                <SummaryRow icon="✂️" label="Servicio" value={service.name} />
                <SummaryRow icon="⏱" label="Duración" value={`${service.duration_minutes} min`} />
                <SummaryRow icon="💰" label="Precio" value={`$${service.price}`} />
                <SummaryRow icon="💈" label="Barbero" value={barber.name} />
                <SummaryRow icon="📅" label="Fecha" value={formatDate(slot.datetime)} />
                <SummaryRow icon="🕐" label="Hora" value={slot.time} />
            </View>
            <TouchableOpacity
                style={[s.confirmBtn, loading && { opacity: 0.6 }]}
                onPress={onConfirm}
                disabled={loading}
            >
                {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.confirmBtnText}>✅ Confirmar reserva</Text>}
            </TouchableOpacity>
        </ScrollView>
    );
}

function SummaryRow({ icon, label, value }: any) {
    return (
        <View style={s.summaryRow}>
            <Text style={s.summaryIcon}>{icon}</Text>
            <Text style={s.summaryLabel}>{label}</Text>
            <Text style={s.summaryValue}>{value}</Text>
        </View>
    );
}

// ── MyAppointments ────────────────────────────────────────────────────────

function MyAppointments({ appts, loading, refreshing, onRefresh, cancelling, onCancel, isLoggedIn }: any) {
    if (!isLoggedIn) {
        return (
            <View style={s.center}>
                <Text style={s.emptyText}>👤 Iniciá sesión para ver tus turnos.</Text>
            </View>
        );
    }
    if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#1B5E20" />;

    return (
        <FlatList
            data={appts}
            keyExtractor={a => String(a.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B5E20" />}
            contentContainerStyle={appts.length === 0 ? s.center : { padding: 16 }}
            ListEmptyComponent={<EmptyState text="Todavía no tenés turnos agendados." />}
            renderItem={({ item: a }) => (
                <View style={s.apptCard}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.apptService}>{a.service_name}</Text>
                        <Text style={s.apptBarber}>💈 {a.barber_name}</Text>
                        <Text style={s.apptDate}>
                            📅 {new Date(a.scheduled_at).toLocaleDateString('es-AR', {
                                weekday: 'short', day: 'numeric', month: 'short',
                            })} — {formatTime(a.scheduled_at)}
                        </Text>
                        <Text style={s.apptPrice}>💰 ${a.service_price}</Text>
                    </View>
                    <View style={s.apptRight}>
                        <View style={[s.statusBadge, { backgroundColor: statusColor(a.status) }]}>
                            <Text style={s.statusText}>{a.status_display}</Text>
                        </View>
                        {a.status === 'CONFIRMED' && (
                            <TouchableOpacity
                                style={s.cancelBtn}
                                onPress={() => onCancel(a.id)}
                                disabled={cancelling === a.id}
                            >
                                {cancelling === a.id
                                    ? <ActivityIndicator color="#B71C1C" size="small" />
                                    : <Text style={s.cancelBtnText}>Cancelar</Text>}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}
        />
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function BackButton({ onPress }: { onPress: () => void }) {
    return (
        <TouchableOpacity style={s.backBtn} onPress={onPress}>
            <Text style={s.backBtnText}>← Volver</Text>
        </TouchableOpacity>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <View style={s.center}>
            <Text style={s.emptyText}>{text}</Text>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────

const GREEN = '#1B5E20';
const GREEN_LIGHT = '#E8F5E9';

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },

    // Tabs
    tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
    tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
    tabActive: { borderBottomWidth: 3, borderBottomColor: GREEN },
    tabText: { fontSize: 14, color: '#888', fontWeight: '600' },
    tabTextActive: { color: GREEN },

    // Breadcrumb
    breadcrumb: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, backgroundColor: '#fff', gap: 8 },
    breadcrumbItem: { alignItems: 'center', gap: 2 },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#DDD' },
    dotActive: { backgroundColor: GREEN, width: 12, height: 12, borderRadius: 6 },
    dotDone: { backgroundColor: '#81C784' },
    dotLabel: { fontSize: 9, color: '#999' },
    dotLabelActive: { color: GREEN, fontWeight: '700' },

    // List
    listPad: { padding: 16, paddingBottom: 40 },
    stepTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 },

    // Cards
    card: {
        backgroundColor: '#fff', borderRadius: 12, padding: 16,
        marginBottom: 10, flexDirection: 'row', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
    cardSub: { fontSize: 13, color: '#888', marginTop: 2 },
    price: { fontSize: 17, fontWeight: '800', color: GREEN },

    // Avatar
    avatar: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: GREEN_LIGHT, justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { fontSize: 20, fontWeight: '800', color: GREEN },

    // Days grid
    daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    dayChip: {
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#DDD',
    },
    dayChipActive: { backgroundColor: GREEN, borderColor: GREEN },
    dayChipText: { fontSize: 13, color: '#444', fontWeight: '600' },
    dayChipTextActive: { color: '#fff' },

    // Slots grid
    slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    slot: {
        width: '28%', paddingVertical: 12, borderRadius: 10,
        backgroundColor: GREEN_LIGHT, alignItems: 'center',
        borderWidth: 1, borderColor: GREEN,
    },
    slotTaken: { backgroundColor: '#F0F0F0', borderColor: '#DDD' },
    slotText: { fontSize: 15, fontWeight: '700', color: GREEN },
    slotTextTaken: { color: '#BBB' },

    // Summary
    summary: {
        backgroundColor: '#fff', borderRadius: 12, padding: 16,
        marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    summaryIcon: { fontSize: 16, width: 28 },
    summaryLabel: { flex: 1, fontSize: 14, color: '#666', fontWeight: '600' },
    summaryValue: { fontSize: 14, color: '#1A1A1A', fontWeight: '700' },

    // Confirm button
    confirmBtn: {
        backgroundColor: GREEN, borderRadius: 12,
        paddingVertical: 16, alignItems: 'center',
    },
    confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

    // Back button
    backBtn: { marginBottom: 12 },
    backBtnText: { color: GREEN, fontSize: 14, fontWeight: '600' },

    // My appointments
    apptCard: {
        backgroundColor: '#fff', borderRadius: 12, padding: 14,
        marginBottom: 10, flexDirection: 'row',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    apptService: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
    apptBarber: { fontSize: 13, color: '#555', marginTop: 2 },
    apptDate: { fontSize: 13, color: '#888', marginTop: 2 },
    apptPrice: { fontSize: 13, color: GREEN, fontWeight: '700', marginTop: 2 },
    apptRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
    statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    cancelBtn: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#B71C1C' },
    cancelBtnText: { color: '#B71C1C', fontSize: 12, fontWeight: '700' },

    // Misc
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyText: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 22 },
});
