import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { Category } from '@/services/api';

interface CategoryChipsProps {
    categories: Category[];
    selectedId: number | null;
    onSelect: (id: number | null) => void;
}

export default function CategoryChips({ categories, selectedId, onSelect }: CategoryChipsProps) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            <Pressable
                style={[styles.chip, !selectedId && styles.chipActive]}
                onPress={() => onSelect(null)}
            >
                <Text style={[styles.chipText, !selectedId && styles.chipTextActive]}>Todos</Text>
            </Pressable>

            {categories.map((cat) => (
                <Pressable
                    key={cat.id_categoria}
                    style={[styles.chip, selectedId === cat.id_categoria && styles.chipActive]}
                    onPress={() =>
                        onSelect(selectedId === cat.id_categoria ? null : cat.id_categoria)
                    }
                >
                    <Text
                        style={[
                            styles.chipText,
                            selectedId === cat.id_categoria && styles.chipTextActive,
                        ]}
                        numberOfLines={1}
                    >
                        {cat.nombre_categoria}
                    </Text>
                </Pressable>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8,
        alignItems: 'center',
    },
    chip: {
        flexShrink: 0,
        paddingHorizontal: 18,
        paddingVertical: 9,
        borderRadius: 20,
        backgroundColor: '#F0F0F0',
        borderWidth: 1.5,
        borderColor: '#E0E0E0',
    },
    chipActive: {
        backgroundColor: '#1B5E20',
        borderColor: '#1B5E20',
    },
    chipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#555',
        textTransform: 'capitalize',
    },
    chipTextActive: {
        color: '#fff',
    },
});
