/**
 * Pantalla de reservas de estética.
 *
 * Flujo:
 *   1. Seleccionar servicio (agrupados por categoría)
 *   2. Seleccionar especialista
 *   3. Seleccionar fecha
 *   4. Seleccionar horario disponible
 *   5. Confirmar reserva
 *
 * Tab "Mis turnos" muestra reservas del cliente.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, ActivityIndicator,
    Alert, StyleSheet, ScrollView, RefreshControl, SectionList,
} from 'react-native';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

// ── Types ─────────────────────────────────────────────────────────────────

interface EsteticaService {
    id: number;
    name: string;
    category: string;
    category_display: string;
    description: string;
    duration_minutes: number;
    price: string;
}

interface Specialist {
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
    specialist_id: number | null;
    specialist_name: string;
    service_name: string;
    service_category: string;
    service_price: string;
    duration_minutes: number;
    scheduled_at: string;
    end_at: string | null;
    status: string;
    status_display: string;
}

type Step = 'service' | 'specialist' | 'date' | 'slots' | 'confirm';

// ── Helpers ───────────────────────────────────────────────────────────────

const PINK = '#C2185B';
const PINK_LIGHT = '#FCE4EC';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', {
        weekday: 'long', day: 'numeric', month: 'long',
    });
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function statusColor(status: string) {
    switch (status) {
        case 'CONFIRMED': return PINK;
        case 'IN_SERVICE': return '#1565C0';
        case 'COMPLETED': return '#555';
        case 'CANCELLED': return '#B71C1C';
        default: return '#888';
    }
}

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

/** Agrupa servicios por categoría para SectionList */
function groupByCategory(services: EsteticaService[]) {
    const map: Record<string, EsteticaService[]> = {};
    for (const s of services) {
        const key = s.category_display;
        if (!map[key]) map[key] = [];
        map[key].push(s);
    }
    return Object.entries(map).map(([title, data]) => ({ title, data }));
}

// ── Main Screen ───────────────────────────────────────────────────────────

export default function EsteticaScreen() {
    const { isLoggedIn } = useAuthStore();
    const [mainTab, setMainTab] = useState<'book' | 'mine'>('book');

    const [step, setStep] = useState<Step>('service');
    const [services, setServices] = useState<EsteticaService[]>([]);
    const [specialists, setSpecialists] = useState<Specialist[]>([]);
    const [slots, setSlots] = useState<Slot[]>([]);

    const [selectedService, setSelectedService] = useState<EsteticaService | null>(null);
    const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

    const [loadingServices, setLoadingServices] = useState(true);
    const [loadingSpecialists, setLoadingSpecialists] = useState(false);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [booking, setBooking] = useState(false);

    const [myAppts, setMyAppts] = useState<Appointment[]>([]);
    const [loadingMine, setLoadingMine] = useState(false);
    const [refreshingMine, setRefreshingMine] = useState(false);
    const [cancelling, setCancelling] = useState<number | null>(null);

    const days = nextDays(14);

    useEffect(() => {
        api.get('/estetica/services/')
            .then(r => setServices(Array.isArray(r.data) ? r.data : []))
            .catch(() => setServices([]))
            .finally(() => setLoadingServices(false));
    }, []);

    useEffect(() => {
        if (step !== 'specialist') return;
        setLoadingSpecialists(true);
        api.get('/estetica/specialists/')
            .then(r => setSpecialists(Array.isArray(r.data) ? r.data : []))
            .catch(() => setSpecialists([]))
            .finally(() => setLoadingSpecialists(false));
    }, [step]);

    useEffect(() => {
        if (step !== 'slots' || !selectedSpecialist || !selectedService || !selectedDate) return;
        setLoadingSlots(true);
        setSlots([]);
        api.get('/estetica/slots/', {
            params: {
                specialist_id: selectedSpecialist.id,
                service_id: selectedService.id,
                date: selectedDate,
            },
        })
            .then(r => setSlots(r.data.slots || []))
            .catch(() => Alert.alert('Error', 'No se pudieron cargar los horarios.'))
            .finally(() => setLoadingSlots(false));
    }, [step, selectedSpecialist, selectedService, selectedDate]);

    const loadMyAppts = useCallback(async (silent = false) => {
        if (!isLoggedIn()) return;
        if (!silent) setLoadingMine(true);
        try {
            const r = await api.get('/estetica/my-appointments/');
            setMyAppts(r.data);
        } catch { }
        setLoadingMine(false);
        setRefreshingMine(false);
    }, [isLoggedIn]);

    useEffect(() => {
        if (mainTab === 'mine') loadMyAppts();
    }, [mainTab]);

    const confirmBooking = async () => {
        if (!selectedService || !selectedSlot) return;
        if (!isLoggedIn()) {
            Alert.alert('Iniciá sesión', 'Necesitás estar logueada para reservar un turno.');
            return;
        }
        setBooking(true);
        try {
            await api.post('/estetica/book/', {
                service_id: selectedService.id,
                specialist_id: selectedSpecialist?.id ?? null,
                scheduled_at: selectedSlot.datetime,
            });
            Alert.alert(
                '✅ Turno reservado',
                `Tu turno de ${selectedService.name} fue confirmado para ${formatDate(selectedSlot.datetime)} a las ${selectedSlot.time}.`
            );
            setStep('service');
            setSelectedService(null);
            setSelectedSpecialist(null);
            setSelectedDate('');
            setSelectedSlot(null);
            setMainTab('mine');
            loadMyAppts();
        } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'Ocurrió un error. Intentá de nuevo.');
        } finally {
            setBooking(false);
        }
    };

    const cancelAppt = (apptId: number) => {
        Alert.alert('Cancelar turno', '¿Querés cancelar este turno?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Sí, cancelar', style: 'destructive', onPress: async () => {
                    setCancelling(apptId);
                    try {
                        await api.delete(`/estetica/appointment/${apptId}/`);
                        setMyAppts(prev =>
                            prev.map(a => a.id === apptId
                                ? { ...a, status: 'CANCELLED', status_display: 'Cancelado' }
                                : a
                            )
                        );
                    } catch (err: any) {
                        Alert.alert('Error', err?.response?.data?.error || 'No se pudo cancelar.');
                    } finally {
                        setCancelling(null);
                    }
                },
            },
        ]);
    };

    return (
        <View style={s.container}>
            {/* Tabs */}
            <View style={s.tabs}>
                <TouchableOpacity
                    style={[s.tab, mainTab === 'book' && s.tabActive]}
                    onPress={() => setMainTab('book')}
                >
                    <Text style={[s.tabText, mainTab === 'book' && s.tabTextActive]}>💅 Reservar turno</Text>
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
                    specialists={specialists} loadingSpecialists={loadingSpecialists}
                    days={days}
                    slots={slots} loadingSlots={loadingSlots}
                    selectedService={selectedService} setSelectedService={setSelectedService}
                    selectedSpecialist={selectedSpecialist} setSelectedSpecialist={setSelectedSpecialist}
                    selectedDate={selectedDate} setSelectedDate={setSelectedDate}
                    selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot}
                    booking={booking} confirmBooking={confirmBooking}
                />
            ) : (
                <MyAppointments
                    appts={myAppts} loading={loadingMine}
                    refreshing={refreshingMine}
                    onRefresh={() => { setRefreshingMine(true); loadMyAppts(true); }}
                    cancelling={cancelling} onCancel={cancelAppt}
                    isLoggedIn={isLoggedIn()}
                />
            )}
        </View>
    );
}

// ── BookingFlow ───────────────────────────────────────────────────────────

function BookingFlow({ step, setStep, services, loadingServices, specialists, loadingSpecialists, days, slots, loadingSlots, selectedService, setSelectedService, selectedSpecialist, setSelectedSpecialist, selectedDate, setSelectedDate, selectedSlot, setSelectedSlot, booking, confirmBooking }: any) {
    const stepOrder: Step[] = ['service', 'specialist', 'date', 'slots', 'confirm'];
    const stepLabel: Record<Step, string> = {
        service: 'Servicio', specialist: 'Especialista', date: 'Fecha', slots: 'Horario', confirm: 'Confirmar',
    };

    return (
        <View style={{ flex: 1 }}>
            {/* Breadcrumb */}
            <View style={s.breadcrumb}>
                {stepOrder.map((st) => (
                    <View key={st} style={s.breadcrumbItem}>
                        <View style={[
                            s.dot,
                            step === st && s.dotActive,
                            stepOrder.indexOf(step) > stepOrder.indexOf(st) && s.dotDone,
                        ]} />
                        <Text style={[s.dotLabel, step === st && s.dotLabelActive]}>{stepLabel[st]}</Text>
                    </View>
                ))}
            </View>

            {step === 'service' && (
                <ServiceStep
                    services={services} loading={loadingServices}
                    onSelect={(sv: EsteticaService) => { setSelectedService(sv); setStep('specialist'); }}
                />
            )}
            {step === 'specialist' && (
                <SpecialistStep
                    specialists={specialists} loading={loadingSpecialists}
                    onBack={() => setStep('service')}
                    onSelect={(sp: Specialist) => { setSelectedSpecialist(sp); setStep('date'); }}
                    onSkip={() => { setSelectedSpecialist(null); setStep('date'); }}
                />
            )}
            {step === 'date' && (
                <DateStep
                    days={days} selected={selectedDate}
                    onBack={() => setStep('specialist')}
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
            {step === 'confirm' && selectedService && selectedSlot && (
                <ConfirmStep
                    service={selectedService} specialist={selectedSpecialist} slot={selectedSlot}
                    onBack={() => setStep('slots')}
                    onConfirm={confirmBooking} loading={booking}
                />
            )}
        </View>
    );
}

// ── Step components ───────────────────────────────────────────────────────

function ServiceStep({ services, loading, onSelect }: any) {
    if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={PINK} />;
    if (!Array.isArray(services) || !services.length) return <EmptyState text="No hay servicios disponibles." />;

    const sections = groupByCategory(services);

    return (
        <SectionList
            sections={sections}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={s.listPad}
            ListHeaderComponent={<Text style={s.stepTitle}>¿Qué tratamiento querés?</Text>}
            renderSectionHeader={({ section: { title } }) => (
                <Text style={s.sectionHeader}>{title}</Text>
            )}
            renderItem={({ item }) => (
                <TouchableOpacity style={s.card} onPress={() => onSelect(item)}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.cardTitle}>💅 {item.name}</Text>
                        {!!item.description && <Text style={s.cardSub}>{item.description}</Text>}
                        <Text style={s.cardSub}>{item.duration_minutes} min</Text>
                    </View>
                    <Text style={s.price}>${item.price}</Text>
                </TouchableOpacity>
            )}
        />
    );
}

function SpecialistStep({ specialists, loading, onBack, onSelect, onSkip }: any) {
    if (loading) return <View style={{ flex: 1 }}><BackButton onPress={onBack} /><ActivityIndicator style={{ marginTop: 20 }} color={PINK} /></View>;
    return (
        <ScrollView contentContainerStyle={s.listPad}>
            <BackButton onPress={onBack} />
            <Text style={s.stepTitle}>Elegí tu especialista</Text>
            <TouchableOpacity style={[s.card, { borderColor: '#DDD', borderStyle: 'dashed', borderWidth: 1.5 }]} onPress={onSkip}>
                <Text style={{ color: '#888', fontWeight: '600', flex: 1 }}>✨ Sin preferencia — cualquiera disponible</Text>
            </TouchableOpacity>
            {specialists.map((sp: Specialist) => (
                <TouchableOpacity key={sp.id} style={s.card} onPress={() => onSelect(sp)}>
                    <View style={s.avatar}>
                        <Text style={s.avatarText}>{sp.name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.cardTitle}>💅 {sp.name}</Text>
                        {!!sp.bio && <Text style={s.cardSub}>{sp.bio}</Text>}
                    </View>
                </TouchableOpacity>
            ))}
            {!specialists.length && <EmptyState text="No hay especialistas disponibles." />}
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
                        <Text style={[s.dayChipText, selected === d.value && s.dayChipTextActive]}>{d.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );
}

function SlotsStep({ slots, loading, onBack, onSelect }: any) {
    if (loading) return (
        <View style={{ flex: 1 }}>
            <View style={s.listPad}><BackButton onPress={onBack} /></View>
            <ActivityIndicator style={{ marginTop: 20 }} color={PINK} />
        </View>
    );
    const available = slots.filter((sl: Slot) => sl.available);
    return (
        <ScrollView contentContainerStyle={s.listPad}>
            <BackButton onPress={onBack} />
            <Text style={s.stepTitle}>Elegí un horario</Text>
            {!available.length && <EmptyState text="No hay horarios disponibles. Probá otra fecha o especialista." />}
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

function ConfirmStep({ service, specialist, slot, onBack, onConfirm, loading }: any) {
    return (
        <ScrollView contentContainerStyle={s.listPad}>
            <BackButton onPress={onBack} />
            <Text style={s.stepTitle}>Confirmar turno</Text>
            <View style={s.summary}>
                <SummaryRow icon="💅" label="Servicio" value={service.name} />
                <SummaryRow icon="⏱" label="Duración" value={`${service.duration_minutes} min`} />
                <SummaryRow icon="💰" label="Precio" value={`$${service.price}`} />
                <SummaryRow icon="👩" label="Especialista" value={specialist ? specialist.name : 'Sin preferencia'} />
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
        return <View style={s.center}><Text style={s.emptyText}>👤 Iniciá sesión para ver tus turnos.</Text></View>;
    }
    if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={PINK} />;

    return (
        <FlatList
            data={appts}
            keyExtractor={a => String(a.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PINK} />}
            contentContainerStyle={appts.length === 0 ? s.center : { padding: 16 }}
            ListEmptyComponent={<EmptyState text="Todavía no tenés turnos agendados. ✨" />}
            renderItem={({ item: a }) => (
                <View style={s.apptCard}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.apptService}>{a.service_name}</Text>
                        <Text style={s.apptSub}>💅 {a.specialist_name}</Text>
                        <Text style={s.apptSub}>
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

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9F4F7' },

    tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3E5F5' },
    tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
    tabActive: { borderBottomWidth: 3, borderBottomColor: PINK },
    tabText: { fontSize: 14, color: '#888', fontWeight: '600' },
    tabTextActive: { color: PINK },

    breadcrumb: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, backgroundColor: '#fff', gap: 12, flexWrap: 'wrap' },
    breadcrumbItem: { alignItems: 'center', gap: 2 },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#DDD' },
    dotActive: { backgroundColor: PINK, width: 12, height: 12, borderRadius: 6 },
    dotDone: { backgroundColor: '#F48FB1' },
    dotLabel: { fontSize: 9, color: '#999' },
    dotLabelActive: { color: PINK, fontWeight: '700' },

    listPad: { padding: 16, paddingBottom: 40 },
    stepTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
    sectionHeader: {
        fontSize: 13, fontWeight: '800', color: PINK,
        textTransform: 'uppercase', letterSpacing: 1,
        paddingVertical: 8, paddingHorizontal: 4,
    },

    card: {
        backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
        flexDirection: 'row', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
    cardSub: { fontSize: 13, color: '#888', marginTop: 2 },
    price: { fontSize: 17, fontWeight: '800', color: PINK },

    avatar: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: PINK_LIGHT, justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { fontSize: 20, fontWeight: '800', color: PINK },

    daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    dayChip: {
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#DDD',
    },
    dayChipActive: { backgroundColor: PINK, borderColor: PINK },
    dayChipText: { fontSize: 13, color: '#444', fontWeight: '600' },
    dayChipTextActive: { color: '#fff' },

    slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    slot: {
        width: '28%', paddingVertical: 12, borderRadius: 10,
        backgroundColor: PINK_LIGHT, alignItems: 'center',
        borderWidth: 1, borderColor: PINK,
    },
    slotTaken: { backgroundColor: '#F0F0F0', borderColor: '#DDD' },
    slotText: { fontSize: 15, fontWeight: '700', color: PINK },
    slotTextTaken: { color: '#BBB' },

    summary: {
        backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#FFF5F9' },
    summaryIcon: { fontSize: 16, width: 28 },
    summaryLabel: { flex: 1, fontSize: 14, color: '#666', fontWeight: '600' },
    summaryValue: { fontSize: 14, color: '#1A1A1A', fontWeight: '700' },

    confirmBtn: {
        backgroundColor: PINK, borderRadius: 12,
        paddingVertical: 16, alignItems: 'center',
    },
    confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

    backBtn: { marginBottom: 12 },
    backBtnText: { color: PINK, fontSize: 14, fontWeight: '600' },

    apptCard: {
        backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
        flexDirection: 'row',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    apptService: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
    apptSub: { fontSize: 13, color: '#666', marginTop: 2 },
    apptPrice: { fontSize: 13, color: PINK, fontWeight: '700', marginTop: 2 },
    apptRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
    statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    cancelBtn: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#B71C1C' },
    cancelBtnText: { color: '#B71C1C', fontSize: 12, fontWeight: '700' },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyText: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 22 },
});
