import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

export default function CatalogDanceClassesScreen() {
    const { isLoggedIn } = useAuthStore();
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [enrolling, setEnrolling] = useState<number | null>(null);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            setLoading(true);
            const res = await api.get('/dance/sessions/calendar/');
            // Filter out old or cancelled sessions if needed
            const validSessions = res.data.filter((s: any) => s.status === 'SCHEDULED' || s.is_enrolled);
            setSessions(validSessions);
        } catch (error) {
            console.error("Error loading sessions", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEnroll = async (session: any) => {
        if (!isLoggedIn()) {
            Alert.alert("Atención", "Debes iniciar sesión para inscribirte en una clase.");
            return;
        }

        Alert.alert(
            "Confirmar Inscripción",
            `¿Deseas inscribirte a la clase de ${session.dance_class_data?.name}?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Inscribirme",
                    onPress: async () => {
                        try {
                            setEnrolling(session.id);
                            // We use class_session_id specifically for the DRF fix implemented
                            const payload = { class_session_id: session.id };
                            await api.post('/dance/enrollments/', payload);
                            Alert.alert("¡Éxito!", "Te has inscripto correctamente.");
                            loadSessions();
                        } catch (error: any) {
                            Alert.alert("Error", error.response?.data?.detail || "No se pudo completar la inscripción.");
                        } finally {
                            setEnrolling(null);
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: any }) => {
        const startDate = new Date(item.start_datetime);
        const dayName = startDate.toLocaleDateString('es-ES', { weekday: 'long' });
        const dayNum = startDate.getDate().toString();
        const time = startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        return (
            <View style={styles.card}>
                <View style={styles.dateBadge}>
                    <Text style={styles.dayName}>{dayName.slice(0, 3)}</Text>
                    <Text style={styles.dayNum}>{dayNum}</Text>
                </View>

                <View style={styles.infoContainer}>
                    <Text style={styles.className}>{item.dance_class_data?.name || "Clase de Danza"}</Text>
                    <Text style={styles.instructorText}>{time} hs • Profe: {item.instructor_name}</Text>
                    <Text style={styles.capacityText}>Cupos: {item.dance_class_data?.max_capacity - item.enrollments_count} disponibles</Text>
                </View>

                <View style={styles.actionContainer}>
                    <Text style={styles.priceText}>${item.dance_class_data?.price || 0}</Text>
                    {item.is_enrolled ? (
                        <View style={styles.enrolledBadge}>
                            <Text style={styles.enrolledText}>INSCRIPTO</Text>
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

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Clases Disponibles 🩰</Text>
            {loading ? (
                <ActivityIndicator size="large" color="#E91E63" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={sessions}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    ListEmptyComponent={<Text style={styles.emptyText}>No hay clases programadas por el momento.</Text>}
                    refreshing={loading}
                    onRefresh={loadSessions}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    dateBadge: { backgroundColor: '#fce7f3', borderRadius: 8, padding: 8, alignItems: 'center', width: 60, marginRight: 16 },
    dayName: { color: '#db2777', fontWeight: 'bold', textTransform: 'capitalize', fontSize: 12 },
    dayNum: { color: '#1f2937', fontSize: 20, fontWeight: 'bold' },
    infoContainer: { flex: 1 },
    className: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
    instructorText: { color: '#6b7280', fontSize: 12, marginTop: 4 },
    capacityText: { color: '#059669', fontSize: 10, fontWeight: 'bold', marginTop: 4 },
    actionContainer: { alignItems: 'flex-end', justifyContent: 'space-between', height: 60 },
    priceText: { fontWeight: 'bold', color: '#374151', fontSize: 16, marginBottom: 8 },
    enrollButton: { backgroundColor: '#db2777', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    enrollButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    enrolledBadge: { backgroundColor: '#d1fae5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    enrolledText: { color: '#059669', fontWeight: 'bold', fontSize: 10 },
    emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 40 }
});
