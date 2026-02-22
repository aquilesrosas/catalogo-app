import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Product } from '@/services/api';

interface StockBadgeProps {
    stockLevel: Product['stock_level'];
}

const BADGE_CONFIG = {
    available: { label: 'Disponible', bg: '#E8F5E9', color: '#2E7D32' },
    low: { label: 'Poco stock', bg: '#FFF8E1', color: '#F57F17' },
    out_of_stock: { label: 'Sin stock', bg: '#FFEBEE', color: '#C62828' },
};

export default function StockBadge({ stockLevel }: StockBadgeProps) {
    const config = BADGE_CONFIG[stockLevel];
    return (
        <View style={[styles.badge, { backgroundColor: config.bg }]}>
            <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    text: {
        fontSize: 11,
        fontWeight: '600',
    },
});
