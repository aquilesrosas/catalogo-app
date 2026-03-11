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
                placeholder="¿Qué tenés ganas de comer hoy?"
                placeholderTextColor="#A0A0A0"
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
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        marginHorizontal: 16,
        marginVertical: 14,
        paddingHorizontal: 16,
        height: 52,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    icon: {
        fontSize: 18,
        marginRight: 10,
        color: '#757575',
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#1a1a1a',
        fontWeight: '500',
    },
});
