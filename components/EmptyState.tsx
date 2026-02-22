import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface EmptyStateProps {
    message?: string;
}

export default function EmptyState({ message }: EmptyStateProps) {
    return (
        <View style={styles.container}>
            <Text style={styles.icon}>🛒</Text>
            <Text style={styles.text}>{message || 'No se encontraron productos'}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 12,
    },
    icon: {
        fontSize: 48,
    },
    text: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
    },
});
