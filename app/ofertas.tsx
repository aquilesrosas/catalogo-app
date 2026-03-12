import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Pressable,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getActiveOffers, Oferta } from '@/services/api';

const TIPO_LABELS: Record<string, string> = {
    PCT_OFF: '% Descuento',
    FIXED_PRICE: 'Precio Fijo',
    NXM: 'Llevá N, Pagá M',
    COMBO: 'Combo',
    MIN_AMOUNT: 'Descuento por monto',
};

const getOfertaEmoji = (tipo: string) => {
    switch (tipo) {
        case 'PCT_OFF': return '💸';
        case 'FIXED_PRICE': return '🏷️';
        case 'NXM': return '🎁';
        case 'COMBO': return '🍱';
        case 'MIN_AMOUNT': return '🛍️';
        default: return '🔥';
    }
};

const getOfertaDescription = (oferta: Oferta) => {
    switch (oferta.tipo) {
        case 'PCT_OFF':
            return `${parseFloat(oferta.valor)}% OFF`;
        case 'FIXED_PRICE':
            return `Precio especial: $${parseFloat(oferta.valor)}`;
        case 'NXM':
            return `Llevá ${oferta.cantidad_requerida}, Pagá ${oferta.cantidad_bonificada}`;
        case 'COMBO':
            const items = oferta.combo_items?.map(i => i.producto_nombre).join(', ');
            return `Combo: ${items || 'Productos seleccionados'}`;
        case 'MIN_AMOUNT':
            return `${parseFloat(oferta.valor)}% OFF comprando +$${parseFloat(oferta.monto_minimo)}`;
        default:
            return oferta.descripcion || 'Promoción especial';
    }
};

export default function OfertasScreen() {
    const [ofertas, setOfertas] = useState<Oferta[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        loadOfertas();
    }, []);

    const loadOfertas = async () => {
        setLoading(true);
        try {
            const data = await getActiveOffers();
            setOfertas(data);
        } catch (e) {
            console.error('Error loading ofertas', e);
        } finally {
            setLoading(false);
        }
    };

    const renderOferta = ({ item }: { item: Oferta }) => (
        <View style={[styles.card, { borderLeftColor: item.color_badge || '#FF6F00' }]}>
            {item.imagen_banner ? (
                <Image source={{ uri: item.imagen_banner }} style={styles.bannerImage} resizeMode="cover" />
            ) : (
                <View style={[styles.emojiHeader, { backgroundColor: item.color_badge || '#FF6F00' }]}>
                    <Text style={styles.emojiIcon}>{getOfertaEmoji(item.tipo)}</Text>
                </View>
            )}
            <View style={styles.cardContent}>
                <View style={styles.cardTopRow}>
                    <View style={[styles.tipoBadge, { backgroundColor: item.color_badge || '#FF6F00' }]}>
                        <Text style={styles.tipoBadgeText}>{TIPO_LABELS[item.tipo] || item.tipo}</Text>
                    </View>
                </View>
                <Text style={styles.cardTitle}>{item.nombre}</Text>
                <Text style={styles.cardDesc}>{getOfertaDescription(item)}</Text>
                {item.descripcion ? (
                    <Text style={styles.cardSubDesc}>{item.descripcion}</Text>
                ) : null}
                <Text style={styles.cardExpiry}>
                    Válido hasta {new Date(item.fecha_fin).toLocaleDateString('es-AR')}
                </Text>
            </View>
        </View>
    );

    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>🏷️</Text>
                <Text style={styles.emptyTitle}>No hay ofertas activas</Text>
                <Text style={styles.emptySubtitle}>¡Volvé pronto, siempre tenemos sorpresas!</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </Pressable>
                <Text style={styles.headerTitle}>🔥 Ofertas y Promos</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF6F00" />
                    <Text style={styles.loadingText}>Cargando ofertas...</Text>
                </View>
            ) : (
                <FlatList
                    data={ofertas}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderOferta}
                    ListEmptyComponent={renderEmpty}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FF6F00',
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backText: {
        color: '#FFF',
        fontSize: 28,
        fontWeight: '300',
        marginTop: -2,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '800',
    },
    list: {
        padding: 16,
        paddingBottom: 40,
    },
    // ─── Card ───
    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    bannerImage: {
        width: '100%',
        height: 140,
    },
    emojiHeader: {
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emojiIcon: {
        fontSize: 40,
    },
    cardContent: {
        padding: 16,
    },
    cardTopRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    tipoBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    tipoBadgeText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    cardDesc: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FF6F00',
        marginBottom: 4,
    },
    cardSubDesc: {
        fontSize: 13,
        color: '#666',
        marginBottom: 8,
    },
    cardExpiry: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
    },
    // ─── Empty ───
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#888',
    },
    // ─── Loading ───
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#888',
    },
});
