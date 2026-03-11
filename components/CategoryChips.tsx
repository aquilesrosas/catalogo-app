import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet, View } from 'react-native';
import { Category } from '@/services/api';

interface CategoryChipsProps {
    categories: Category[];
    selectedId: number | null;
    onSelect: (id: number | null) => void;
}

const getEmojiForCategory = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('bebida') || lower.includes('gaseosa') || lower.includes('jugo')) return '🥤';
    if (lower.includes('cerveza') || lower.includes('alcohol') || lower.includes('vino')) return '🍺';
    if (lower.includes('snack') || lower.includes('papas') || lower.includes('galleta')) return '🍪';
    if (lower.includes('comida') || lower.includes('alimento') || lower.includes('pan')) return '🥐';
    if (lower.includes('limpieza') || lower.includes('hogar')) return '🧼';
    if (lower.includes('oferta') || lower.includes('promo')) return '🔥';
    return '🛒';
};

export default function CategoryChips({ categories, selectedId, onSelect }: CategoryChipsProps) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            <Pressable
                style={styles.chipContainer}
                onPress={() => onSelect(null)}
            >
                <View style={[styles.circle, !selectedId && styles.circleActive]}>
                    <Text style={styles.emoji}>🏠</Text>
                </View>
                <Text style={[styles.chipText, !selectedId && styles.chipTextActive]} numberOfLines={1}>
                    Todos
                </Text>
            </Pressable>

            {categories.map((cat) => (
                <Pressable
                    key={cat.id_categoria}
                    style={styles.chipContainer}
                    onPress={() =>
                        onSelect(selectedId === cat.id_categoria ? null : cat.id_categoria)
                    }
                >
                    <View style={[styles.circle, selectedId === cat.id_categoria && styles.circleActive]}>
                        <Text style={styles.emoji}>{getEmojiForCategory(cat.nombre_categoria)}</Text>
                    </View>
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
        paddingVertical: 12,
        gap: 16,
        alignItems: 'flex-start',
    },
    chipContainer: {
        alignItems: 'center',
        width: 72,
    },
    circle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    circleActive: {
        backgroundColor: '#FFF8E1',
        borderWidth: 2,
        borderColor: '#FFC107',
    },
    emoji: {
        fontSize: 28,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#666',
        textAlign: 'center',
        textTransform: 'capitalize',
    },
    chipTextActive: {
        color: '#333',
        fontWeight: '700',
    },
});
