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
        backgroundColor: '#fff',
        paddingVertical: 10,
        zIndex: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
    },
    container: {
        paddingHorizontal: 16,
        alignItems: 'center',
        gap: 8,
    },
    tabContainer: {
        paddingVertical: 7,
        paddingHorizontal: 18,
        borderRadius: 25,
        backgroundColor: '#F2F2F2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#555',
        textTransform: 'capitalize',
    },
});
