import React, { useRef, useCallback, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Text } from 'react-native';

interface SearchBarProps {
    value: string;
    onSearch: (query: string) => void;
}

export default function SearchBar({ value, onSearch }: SearchBarProps) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<TextInput>(null);
    const [hasText, setHasText] = useState(!!value);

    const handleChange = useCallback(
        (text: string) => {
            setHasText(text.length > 0);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                onSearch(text);
            }, 400);
        },
        [onSearch],
    );

    const handleClear = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        inputRef.current?.clear();
        setHasText(false);
        onSearch('');
    }, [onSearch]);

    return (
        <View style={styles.container}>
            <Text style={styles.icon}>🔍</Text>
            <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="¿Qué tenés ganas de comer hoy?"
                placeholderTextColor="#A0A0A0"
                defaultValue={value}
                onChangeText={handleChange}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
            />
            {hasText && (
                <Pressable onPress={handleClear} style={styles.clearBtn} hitSlop={8}>
                    <Text style={styles.clearIcon}>✕</Text>
                </Pressable>
            )}
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
        marginTop: 12,
        marginBottom: 4,
        paddingHorizontal: 16,
        height: 48,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    icon: {
        fontSize: 16,
        marginRight: 10,
        color: '#757575',
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#1a1a1a',
        fontWeight: '500',
    },
    clearBtn: {
        paddingHorizontal: 4,
        paddingVertical: 4,
    },
    clearIcon: {
        fontSize: 14,
        color: '#999',
        fontWeight: '700',
    },
});
