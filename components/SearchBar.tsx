import React, { useRef, useCallback } from 'react';
import { View, TextInput, StyleSheet, Pressable, Text } from 'react-native';

interface SearchBarProps {
    value: string;
    onSearch: (query: string) => void;
}

export default function SearchBar({ value, onSearch }: SearchBarProps) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleChange = useCallback(
        (text: string) => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                onSearch(text);
            }, 500);
        },
        [onSearch]
    );

    return (
        <View style={styles.container}>
            <Text style={styles.icon}>🔍</Text>
            <TextInput
                style={styles.input}
                placeholder="Buscar productos..."
                placeholderTextColor="#999"
                defaultValue={value}
                onChangeText={handleChange}
                returnKeyType="search"
                autoCorrect={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        marginHorizontal: 16,
        marginTop: 8,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    icon: {
        fontSize: 16,
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#1a1a1a',
    },
});
