import React, { useRef, useEffect } from 'react';
import { ScrollView, Pressable, Text, StyleSheet, View } from 'react-native';
import { Category } from '@/services/api';
import { useConfigStore } from '@/stores/configStore';

interface StickyCategoryTabsProps {
    categories: Category[];
    selectedId: number | null;
    onSelect: (id: number | null) => void;
}

export default function StickyCategoryTabs({ categories, selectedId, onSelect }: StickyCategoryTabsProps) {
    const primaryColor = useConfigStore((s: any) => s.primary_color) || '#D32F2F';
    const scrollViewRef = useRef<ScrollView>(null);

    // Effect to scroll to the active tab (very basic snap-like behavior)
    useEffect(() => {
        // Advanced calculation would require onLayout for each tab, 
        // but for now we just let the user scroll or we could estimate.
    }, [selectedId]);

    return (
        <View style={styles.wrapper}>
            <ScrollView
                ref={scrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.container}
            >
                <Pressable
                    style={[styles.tabContainer, !selectedId && { backgroundColor: primaryColor }]}
                    onPress={() => onSelect(null)}
                >
                    <Text style={[styles.tabText, !selectedId && { color: '#FFF', fontWeight: '800' }]}>
                        Todos
                    </Text>
                </Pressable>

                {categories.map((cat) => {
                    const isActive = selectedId === cat.id_categoria;
                    return (
                        <Pressable
                            key={cat.id_categoria}
                            style={[styles.tabContainer, isActive && { backgroundColor: primaryColor }]}
                            onPress={() => onSelect(cat.id_categoria)}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    isActive && { color: '#FFF', fontWeight: '800' },
                                ]}
                            >
                                {cat.nombre_categoria}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        backgroundColor: '#FAFAFA',
        paddingVertical: 10,
        zIndex: 10,
    },
    container: {
        paddingHorizontal: 16,
        alignItems: 'center',
        gap: 10,
    },
    tabContainer: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 25,
        backgroundColor: '#EEEEEE',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#555',
        textTransform: 'capitalize',
    },
});
