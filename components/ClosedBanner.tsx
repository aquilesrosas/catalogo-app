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

    if (!isClosed) return null;

    const timeRanges = (cc.time_ranges as Array<{ start: string; end: string }>) || [];
    const storeAddress = config.store_address || '';

    return (
        <View style={styles.container}>
            <Text style={styles.emoji}>🛑</Text>
            <Text style={styles.title}>Local Cerrado</Text>
            <Text style={styles.subtitle}>En este momento no estamos recibiendo pedidos.</Text>
            
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
                <View style={styles.addressBox}>
                    <Text style={styles.addressTitle}>📍 Encontranos en:</Text>
                    <Text style={styles.addressText}>{storeAddress}</Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
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
    emoji: {
        fontSize: 32,
        marginBottom: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#E65100',
        marginBottom: 4,
    },
    subtitle: {
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
        marginBottom: 12,
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
    addressBox: {
        width: '100%',
        backgroundColor: '#FFE0B2',
        padding: 12,
        borderRadius: 12,
    },
    addressTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#E65100',
        marginBottom: 4,
    },
    addressText: {
        fontSize: 14,
        color: '#EF6C00',
        fontWeight: '500',
    },
});
