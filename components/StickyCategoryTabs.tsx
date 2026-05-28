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
                    style={styles.tabContainer}
                    onPress={() => onSelect(null)}
                >
                    <Text style={[styles.tabText, !selectedId && { color: primaryColor, fontWeight: '800' }]}>
                        Todos
                    </Text>
                    {!selectedId && <View style={[styles.activeLine, { backgroundColor: primaryColor }]} />}
                </Pressable>

                {categories.map((cat) => {
                    const isActive = selectedId === cat.id_categoria;
                    return (
                        <Pressable
                            key={cat.id_categoria}
                            style={styles.tabContainer}
                            onPress={() => onSelect(cat.id_categoria)}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    isActive && { color: primaryColor, fontWeight: '800' },
                                ]}
                            >
                                {cat.nombre_categoria}
                            </Text>
                            {isActive && <View style={[styles.activeLine, { backgroundColor: primaryColor }]} />}
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
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
        zIndex: 10,
    },
    container: {
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    tabContainer: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#777',
        textTransform: 'capitalize',
    },
    activeLine: {
        position: 'absolute',
        bottom: 0,
        left: 16,
        right: 16,
        height: 3,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
    },
});
