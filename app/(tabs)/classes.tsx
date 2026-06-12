import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    ActivityIndicator, Alert, StyleSheet, RefreshControl,
} from 'react-native';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

interface DanceClassData {
    id: number;
    name: string;
    level: string;
    duration_minutes: number;
    max_capacity: number;
    price: string;
}

interface Session {
    id: number;
    dance_class_data: DanceClassData;
    instructor_name: string;
    start_datetime: string;
    end_datetime: string;
    status: string;
    enrollments_count: number;
    cupos_disponibles: number;
    can_enroll: boolean;
    is_enrolled: boolean;
    enrollment_id: number | null;
    enrollment_status: string | null;
}

export default function CatalogDanceClassesScreen() {
    const { isLoggedIn } = useAuthStore();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [enrolling, setEnrolling] = useState<number | null>(null);
    const [tab, setTab] = useState<'upcoming' | 'mine'>('upcoming');

    const loadSessions = useCallback(async () => {
        try {
            const res = await api.get('/dance/sessions/');
            setSessions(res.data);
        } catch (error) {
            console.error('Error loading dance sessions', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const [myEnrollments, setMyEnrollments] = useState<any[]>([]);

    const loadMyEnrollments = useCallback(async () => {
        if (!isLoggedIn()) return;
        try {
            const res = await api.get('/dance/my-enrollments/');
            setMyEnrollments(res.data);
        } catch (error) {
            console.error('Error loading my enrollments', error);
        }
    }, [isLoggedIn]);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    useEffect(() => {
        if (tab === 'mine') loadMyEnrollments();
    }, [tab, loadMyEnrollments]);

    const handleEnroll = async (session: Session) => {
        if (!isLoggedIn()) {
            Alert.alert('Atención', 'Tenés que iniciar sesión para inscribirte en una clase.');
            return;
        }

        Alert.alert(
            'Confirmar inscripción',
            `¿Querés anotarte a ${session.dance_class_data?.name}?\n\nEl pago se confirma en el local.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Anotarme',
                    onPress: async () => {
                        try {
                            setEnrolling(session.id);
                            await api.post('/dance/enroll/', { session_id: session.id });
                            Alert.alert('¡Listo!', 'Te inscribiste correctamente. ¡Nos vemos en la clase!');
                            loadSessions();
                            loadMyEnrollments();
                        } catch (error: any) {
                            const msg =
                                error.response?.data?.error ||
                                error.response?.data?.detail ||
                                'No se pudo completar la inscripción.';
                            Alert.alert('Error', msg);
                        } finally {
                            setEnrolling(null);
                        }
                    },
                },
            ]
        );
    };

    const handleCancel = async (enrollmentId: number) => {
        Alert.alert(
            'Cancelar inscripción',
            '¿Seguro que querés cancelar esta inscripción?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Sí, cancelar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`/dance/enroll/${enrollmentId}/`);
                            Alert.alert('Listo', 'Inscripción cancelada.');
                            loadSessions();
                            loadMyEnrollments();
                        } catch (error: any) {
                            const msg = error.response?.data?.error || 'No se pudo cancelar.';
                            Alert.alert('Error', msg);
                        }
                    },
                },
            ]
        );
    };

    const renderSession = ({ item }: { item: Session }) => {
        const startDate = new Date(item.start_datetime);
        const dayName = startDate.toLocaleDateString('es-ES', { weekday: 'long' });
        const dayNum = startDate.getDate().toString();
        const monthName = startDate.toLocaleDateString('es-ES', { month: 'short' });
        const time = startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        const isFull = item.cupos_disponibles === 0 && !item.is_enrolled;

        return (
            <View style={[styles.card, isFull && styles.cardFull]}>
                <View style={[styles.dateBadge, isFull && styles.dateBadgeFull]}>
                    <Text style={[styles.dayName, isFull && styles.textMuted]}>
                        {dayName.slice(0, 3).toUpperCase()}
                    </Text>
                    <Text style={[styles.dayNum, isFull && styles.textMuted]}>{dayNum}</Text>
                    <Text style={[styles.monthName, isFull && styles.textMuted]}>{monthName}</Text>
                </View>

                <View style={styles.infoContainer}>
                    <Text style={styles.className}>{item.dance_class_data?.name || 'Clase de Danza'}</Text>
                    <Text style={styles.instructorText}>
                        {time} hs • {item.dance_class_data?.duration_minutes} min
                        {item.instructor_name ? ` • ${item.instructor_name}` : ''}
                    </Text>
                    <View style={styles.row}>
                        {item.dance_class_data?.level ? (
                            <Text style={styles.levelBadge}>{item.dance_class_data.level}</Text>
                        ) : null}
                        {isFull ? (
                            <Text style={styles.fullText}>Sin cupos</Text>
                        ) : (
                            <Text style={styles.capacityText}>
                                {item.cupos_disponibles} cupo{item.cupos_disponibles !== 1 ? 's' : ''} libre{item.cupos_disponibles !== 1 ? 's' : ''}
                            </Text>
                        )}
                    </View>
                </View>

                <View style={styles.actionContainer}>
                    <Text style={styles.priceText}>${item.dance_class_data?.price || 0}</Text>
                    {item.is_enrolled ? (
                        <View style={styles.enrolledBadge}>
                            <Text style={styles.enrolledText}>✓ ANOTADO</Text>
                        </View>
                    ) : isFull ? (
                        <View style={styles.fullBadge}>
                            <Text style={styles.fullBadgeText}>LLENA</Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.enrollButton}
                            disabled={enrolling === item.id}
                            onPress={() => handleEnroll(item)}
                        >
                            {enrolling === item.id ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.enrollButtonText}>Anotarme</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const renderEnrollment = ({ item }: { item: any }) => {
        const s = item.session;
        const startDate = new Date(s.start_datetime);
        const dateStr = startDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
        const time = startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        const statusLabels: Record<string, { label: string; color: string }> = {
            PENDING: { label: 'Pendiente de pago', color: '#f59e0b' },
            PENDING_VERIFICATION: { label: 'En verificación', color: '#3b82f6' },
            PARTIAL: { label: 'Pago parcial', color: '#f97316' },
            PAID: { label: 'Confirmado ✓', color: '#10b981' },
            CANCELLED: { label: 'Cancelado', color: '#6b7280' },
        };
        const st = statusLabels[item.status] || { label: item.status, color: '#6b7280' };

        return (
            <View style={styles.enrollmentCard}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.className}>{s.dance_class_data?.name}</Text>
                    <Text style={styles.instructorText}>{dateStr} • {time} hs</Text>
                    <Text style={styles.instructorText}>
                        Profe: {s.instructor_name || '—'}
                    </Text>
                    <Text style={[styles.enrollmentStatus, { color: st.color }]}>{st.label}</Text>
                </View>
                <View style={styles.enrollmentActions}>
                    <Text style={styles.priceText}>${s.dance_class_data?.price || 0}</Text>
                    {item.status === 'PENDING' && (
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => handleCancel(item.enrollment_id)}
                        >
                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Clases de Danza 🩰</Text>

            {/* Tabs */}
            <View style={styles.tabRow}>
                <TouchableOpacity
                    style={[styles.tab, tab === 'upcoming' && styles.tabActive]}
                    onPress={() => setTab('upcoming')}
                >
                    <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]}>
                        Próximas clases
                    </Text>
                </TouchableOpacity>
                {isLoggedIn() && (
                    <TouchableOpacity
                        style={[styles.tab, tab === 'mine' && styles.tabActive]}
                        onPress={() => setTab('mine')}
                    >
                        <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>
                            Mis clases
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {tab === 'upcoming' ? (
                loading ? (
                    <ActivityIndicator size="large" color="#db2777" style={{ marginTop: 40 }} />
                ) : (
                    <FlatList
                        data={sessions}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderSession}
                        contentContainerStyle={{ paddingBottom: 24 }}
                        ListEmptyComponent={
                            <Text style={styles.emptyText}>No hay clases programadas por el momento.</Text>
                        }
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => { setRefreshing(true); loadSessions(); }}
                                colors={['#db2777']}
                            />
                        }
                    />
                )
            ) : (
                <FlatList
                    data={myEnrollments}
                    keyExtractor={(item) => item.enrollment_id.toString()}
                    renderItem={renderEnrollment}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>Todavía no te inscribiste a ninguna clase.</Text>
                    }
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); loadMyEnrollments(); }}
                            colors={['#db2777']}
                        />
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
    title: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginBottom: 12 },

    tabRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#e5e7eb', alignItems: 'center' },
    tabActive: { backgroundColor: '#db2777' },
    tabText: { color: '#6b7280', fontWeight: '600', fontSize: 13 },
    tabTextActive: { color: '#fff' },

    card: {
        backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
        flexDirection: 'row', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
    },
    cardFull: { opacity: 0.65 },

    dateBadge: {
        backgroundColor: '#fce7f3', borderRadius: 8, padding: 8,
        alignItems: 'center', width: 52, marginRight: 14,
    },
    dateBadgeFull: { backgroundColor: '#f3f4f6' },
    dayName: { color: '#db2777', fontWeight: 'bold', textTransform: 'uppercase', fontSize: 11 },
    dayNum: { color: '#1f2937', fontSize: 20, fontWeight: 'bold', lineHeight: 24 },
    monthName: { color: '#db2777', fontSize: 11, textTransform: 'capitalize' },
    textMuted: { color: '#9ca3af' },

    infoContainer: { flex: 1 },
    className: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
    instructorText: { color: '#6b7280', fontSize: 12, marginTop: 3 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    levelBadge: {
        backgroundColor: '#ede9fe', color: '#7c3aed',
        fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    },
    capacityText: { color: '#059669', fontSize: 11, fontWeight: '600' },
    fullText: { color: '#ef4444', fontSize: 11, fontWeight: '600' },

    actionContainer: { alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 56 },
    priceText: { fontWeight: 'bold', color: '#374151', fontSize: 15 },
    enrollButton: { backgroundColor: '#db2777', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginTop: 4 },
    enrollButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    enrolledBadge: { backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, marginTop: 4 },
    enrolledText: { color: '#059669', fontWeight: 'bold', fontSize: 11 },
    fullBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, marginTop: 4 },
    fullBadgeText: { color: '#ef4444', fontWeight: 'bold', fontSize: 10 },

    enrollmentCard: {
        backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
        flexDirection: 'row', alignItems: 'flex-start',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
    },
    enrollmentStatus: { fontSize: 12, fontWeight: '700', marginTop: 4 },
    enrollmentActions: { alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
    cancelButton: { borderWidth: 1, borderColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    cancelButtonText: { color: '#ef4444', fontSize: 11, fontWeight: '600' },

    emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 48, fontSize: 14 },
});
