import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { getStoreConfig, StoreConfig } from '@/services/api';

export default function ClosedBanner() {
    const [config, setConfig] = useState<StoreConfig | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getStoreConfig()
            .then(setConfig)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading || !config) return null;

    const cc = config.catalog_config || {};
    const isClosed = cc.is_closed === true;
    const timeRanges = (cc.time_ranges as Array<{ start: string; end: string }>) || [];
    const storeAddress = config.store_address || '';
    const deliveryTime = cc.delivery_time_minutes as number | undefined;

    if (isClosed) {
        return (
            <View style={styles.closedContainer}>
                <Text style={styles.closedEmoji}>🛑</Text>
                <Text style={styles.closedTitle}>Local Cerrado</Text>
                <Text style={styles.closedSubtitle}>En este momento no estamos recibiendo pedidos.</Text>

                {timeRanges.length > 0 && (
                    <View style={styles.infoBox}>
                        <Text style={styles.infoTitle}>🕐 Nuestros horarios de atención:</Text>
                        {timeRanges.map((range, idx) => (
                            <Text key={idx} style={styles.infoText}>
                                • {range.start} a {range.end} hs
                            </Text>
                        ))}
                    </View>
                )}

                {storeAddress ? (
                    <View style={styles.infoBox}>
                        <Text style={styles.infoTitle}>📍 Encontranos en:</Text>
                        <Text style={styles.infoText}>{storeAddress}</Text>
                    </View>
                ) : null}
            </View>
        );
    }

    // Open — show a compact info strip with address + hours + delivery time
    const hasInfo = storeAddress || timeRanges.length > 0 || deliveryTime;
    if (!hasInfo) return null;

    const parts: string[] = [];
    if (storeAddress) parts.push(`📍 ${storeAddress}`);
    if (timeRanges.length > 0) parts.push(`🕐 ${timeRanges.map(r => `${r.start} – ${r.end} hs`).join(' | ')}`);
    if (deliveryTime) parts.push(`🛵 ~${deliveryTime} min`);

    return (
        <View style={styles.openContainer}>
            <Text style={styles.openText} numberOfLines={2}>{parts.join('  ·  ')}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    // ── Closed ──────────────────────────────────────────────
    closedContainer: {
        backgroundColor: '#FFF3E0',
        padding: 20,
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FFCC80',
        alignItems: 'center',
        shadowColor: '#E65100',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    closedEmoji: {
        fontSize: 32,
        marginBottom: 8,
    },
    closedTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#E65100',
        marginBottom: 4,
    },
    closedSubtitle: {
        fontSize: 14,
        color: '#F57C00',
        textAlign: 'center',
        marginBottom: 16,
    },
    infoBox: {
        width: '100%',
        backgroundColor: '#FFE0B2',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    infoTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#E65100',
        marginBottom: 6,
    },
    infoText: {
        fontSize: 14,
        color: '#EF6C00',
        fontWeight: '600',
    },
    // ── Open ────────────────────────────────────────────────
    openContainer: {
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 4,
        backgroundColor: '#F1F8E9',
        borderRadius: 10,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#C5E1A5',
    },
    openText: {
        fontSize: 12,
        color: '#33691E',
        fontWeight: '500',
        lineHeight: 18,
    },
});
