import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    ActivityIndicator,
    Linking,
    Image,
    Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { getStoreConfig, StoreConfig, getActiveOffers, Oferta } from '@/services/api';
import { useConfigStore } from '@/stores/configStore';

export default function StoreScreen() {
    const router = useRouter();
    const tenantSlug = useConfigStore((s) => s.tenantSlug);
    const [config, setConfig] = useState<StoreConfig | null>(null);
    const [promos, setPromos] = useState<Oferta[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [tenantSlug]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [storeData, offersData] = await Promise.all([
                getStoreConfig(),
                getActiveOffers(),
            ]);
            setConfig(storeData);
            setPromos(offersData.slice(0, 3)); // Top 3 promos
        } catch (e) {
            console.error('Error loading store data:', e);
        } finally {
            setLoading(false);
        }
    };

    const cc = config?.catalog_config || {};
    const whatsappPhone = (cc.whatsapp_phone as string) || '';
    const storePhone = whatsappPhone;
    const storeLat = config?.store_lat || null;
    const storeLng = config?.store_lng || null;
    const storeAddress = config?.store_address || '';
    const horarios = (cc.horarios as string) || '';
    const logoUrl = config?.logo_url || null;

    const openWhatsApp = () => {
        if (whatsappPhone) {
            Linking.openURL(`https://wa.me/${whatsappPhone}?text=Hola!%20Quiero%20consultar%20algo`);
        }
    };

    const openCall = () => {
        if (storePhone) {
            Linking.openURL(`tel:${storePhone}`);
        }
    };

    const openMaps = () => {
        if (storeLat && storeLng) {
            const url = Platform.select({
                ios: `maps://app?daddr=${storeLat},${storeLng}`,
                android: `google.navigation:q=${storeLat},${storeLng}`,
                default: `https://www.google.com/maps/dir/?api=1&destination=${storeLat},${storeLng}`,
            });
            if (url) Linking.openURL(url);
        } else if (storeAddress) {
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeAddress)}`);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1B5E20" />
                <Text style={styles.loadingText}>Cargando información...</Text>
            </View>
        );
    }

    return (
        <>
            <Stack.Screen options={{ title: config?.name || 'Nuestro Local' }} />
            <ScrollView style={styles.container} bounces={false} showsVerticalScrollIndicator={false}>

                {/* ── Hero Header ── */}
                <View style={styles.heroSection}>
                    <View style={styles.heroGradient}>
                        <View style={styles.logoContainer}>
                            {logoUrl ? (
                                <Image source={{ uri: logoUrl }} style={styles.logo} />
                            ) : (
                                <View style={styles.logoPlaceholder}>
                                    <Text style={styles.logoInitial}>
                                        {(config?.name || '?')[0].toUpperCase()}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.storeName}>{config?.name}</Text>
                        <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>{config?.tenant_type}</Text>
                        </View>
                    </View>
                </View>

                {/* ── Quick Action Buttons ── */}
                <View style={styles.actionsRow}>
                    {storePhone ? (
                        <Pressable style={styles.actionBtn} onPress={openCall}>
                            <View style={[styles.actionCircle, { backgroundColor: '#E3F2FD' }]}>
                                <Text style={styles.actionEmoji}>📞</Text>
                            </View>
                            <Text style={styles.actionLabel}>Llamar</Text>
                        </Pressable>
                    ) : null}
                    {whatsappPhone ? (
                        <Pressable style={styles.actionBtn} onPress={openWhatsApp}>
                            <View style={[styles.actionCircle, { backgroundColor: '#E8F5E9' }]}>
                                <Text style={styles.actionEmoji}>💬</Text>
                            </View>
                            <Text style={styles.actionLabel}>WhatsApp</Text>
                        </Pressable>
                    ) : null}
                    {(storeLat || storeAddress) ? (
                        <Pressable style={styles.actionBtn} onPress={openMaps}>
                            <View style={[styles.actionCircle, { backgroundColor: '#FFF3E0' }]}>
                                <Text style={styles.actionEmoji}>📍</Text>
                            </View>
                            <Text style={styles.actionLabel}>Ubicación</Text>
                        </Pressable>
                    ) : null}
                    <Pressable style={styles.actionBtn} onPress={() => router.push('/(tabs)/ofertas')}>
                        <View style={[styles.actionCircle, { backgroundColor: '#FCE4EC' }]}>
                            <Text style={styles.actionEmoji}>🏷️</Text>
                        </View>
                        <Text style={styles.actionLabel}>Promos</Text>
                    </Pressable>
                </View>

                {/* ── Address & Hours ── */}
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoIcon}>📍</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.infoLabel}>Dirección</Text>
                            <Text style={styles.infoValue}>{storeAddress || 'Dirección no especificada'}</Text>
                        </View>
                    </View>
                    {horarios ? (
                        <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 12 }]}>
                            <Text style={styles.infoIcon}>🕐</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.infoLabel}>Horarios</Text>
                                <Text style={styles.infoValue}>{horarios}</Text>
                            </View>
                        </View>
                    ) : null}
                </View>

                {/* ── Map Preview (Static) ── */}
                <Pressable style={styles.mapCard} onPress={openMaps}>
                    <View style={styles.mapPreview}>
                        <Text style={styles.mapPinEmoji}>📍</Text>
                        <Text style={styles.mapText}>Ver ubicación en Google Maps</Text>
                    </View>
                    <View style={styles.mapBtn}>
                        <Text style={styles.mapBtnText}>Abrir Mapa →</Text>
                    </View>
                </Pressable>

                {/* ── Promos Destacadas ── */}
                {promos.length > 0 && (
                    <View style={styles.promosSection}>
                        <Text style={styles.sectionTitle}>🔥 Promos Destacadas</Text>
                        {promos.map((promo) => (
                            <Pressable
                                key={promo.id}
                                style={styles.promoCard}
                                onPress={() => router.push('/(tabs)/ofertas')}
                            >
                                <View style={[styles.promoBadge, { backgroundColor: promo.color_badge || '#FF6F00' }]}>
                                    <Text style={styles.promoEmoji}>
                                        {promo.tipo === 'PCT_OFF' ? '💸' :
                                         promo.tipo === 'NXM' ? '🎁' :
                                         promo.tipo === 'COMBO' ? '🍱' : '🔥'}
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.promoName}>{promo.nombre}</Text>
                                    <Text style={styles.promoDesc} numberOfLines={1}>
                                        {promo.descripcion || `${parseFloat(promo.valor)}% OFF`}
                                    </Text>
                                </View>
                                <Text style={styles.promoArrow}>›</Text>
                            </Pressable>
                        ))}
                    </View>
                )}

                {/* ── CTA Principal ── */}
                <View style={styles.ctaSection}>
                    <Pressable
                        style={styles.ctaButton}
                        onPress={() => router.replace('/(tabs)')}
                    >
                        <Text style={styles.ctaIcon}>🛒</Text>
                        <Text style={styles.ctaText}>Ver Catálogo Completo</Text>
                    </Pressable>
                </View>

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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#FAFAFA',
    },
    loadingText: {
        color: '#888',
        fontSize: 14,
    },
    // ── Hero ──
    heroSection: {
        marginBottom: 0,
    },
    heroGradient: {
        backgroundColor: '#1B5E20',
        paddingTop: 30,
        paddingBottom: 40,
        alignItems: 'center',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    logoContainer: {
        marginBottom: 16,
    },
    logo: {
        width: 90,
        height: 90,
        borderRadius: 45,
        borderWidth: 4,
        borderColor: '#fff',
    },
    logoPlaceholder: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    logoInitial: {
        fontSize: 40,
        fontWeight: '900',
        color: '#fff',
    },
    storeName: {
        fontSize: 26,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    typeBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 20,
    },
    typeBadgeText: {
        color: '#C8E6C9',
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    // ── Actions ──
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: -20,
        marginHorizontal: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingVertical: 18,
        paddingHorizontal: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
        gap: 4,
    },
    actionBtn: {
        flex: 1,
        alignItems: 'center',
        gap: 6,
    },
    actionCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionEmoji: {
        fontSize: 24,
    },
    actionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#555',
        textTransform: 'uppercase',
    },
    // ── Info Card ──
    infoCard: {
        marginHorizontal: 16,
        marginTop: 20,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
        gap: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    infoIcon: {
        fontSize: 20,
        marginTop: 2,
    },
    infoLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#999',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 15,
        color: '#333',
        fontWeight: '500',
        lineHeight: 22,
    },
    // ── Map ──
    mapCard: {
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: '#E8F5E9',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#C8E6C9',
    },
    mapPreview: {
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    mapPinEmoji: {
        fontSize: 36,
    },
    mapText: {
        fontSize: 14,
        color: '#2E7D32',
        fontWeight: '600',
    },
    mapBtn: {
        backgroundColor: '#1B5E20',
        paddingVertical: 12,
        alignItems: 'center',
    },
    mapBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    // ── Promos ──
    promosSection: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1a1a1a',
        marginBottom: 12,
    },
    promoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    promoBadge: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    promoEmoji: {
        fontSize: 22,
    },
    promoName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    promoDesc: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    promoArrow: {
        fontSize: 28,
        color: '#ccc',
        fontWeight: '300',
    },
    // ── CTA ──
    ctaSection: {
        marginTop: 28,
        paddingHorizontal: 16,
    },
    ctaButton: {
        backgroundColor: '#1B5E20',
        paddingVertical: 18,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        shadowColor: '#1B5E20',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    ctaIcon: {
        fontSize: 22,
    },
    ctaText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
    },
});
