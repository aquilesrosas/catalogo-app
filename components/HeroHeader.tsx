import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useConfigStore } from '@/stores/configStore';
import { getStoreConfig, StoreConfig } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HeroHeader() {
    const localConfig = useConfigStore((s: any) => s);
    const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        getStoreConfig()
            .then(setStoreConfig)
            .catch(() => {});
    }, []);

    const name = storeConfig?.name || localConfig.name || 'Catálogo';
    const primaryColor = storeConfig?.primary_color || localConfig.primary_color || '#D32F2F';
    const logoUrl = storeConfig?.logo_url || localConfig.logo_url;
    const isClosed = storeConfig?.catalog_config?.is_closed === true;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Background Cover */}
            <View style={[styles.backgroundCover, { backgroundColor: primaryColor }]}>
                {/* Fallback pattern or actual cover image could go here */}
                <View style={styles.darkOverlay} />
            </View>

            <View style={styles.content}>
                {/* Logo */}
                <View style={styles.logoContainer}>
                    {logoUrl ? (
                        <Image source={{ uri: logoUrl }} style={styles.logo} />
                    ) : (
                        <View style={[styles.logoPlaceholder, { backgroundColor: primaryColor }]}>
                            <Text style={styles.logoText}>{name?.charAt(0) || 'C'}</Text>
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={styles.infoContainer}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={1}>{name}</Text>
                        {isClosed ? (
                            <View style={[styles.badge, { backgroundColor: 'rgba(211, 47, 47, 0.9)' }]}>
                                <Text style={styles.badgeText}>CERRADO</Text>
                            </View>
                        ) : (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>DISPONIBLE</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        paddingBottom: 20,
        backgroundColor: '#FAFAFA',
    },
    backgroundCover: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '100%',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        overflow: 'hidden',
    },
    darkOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)', 
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 20,
        alignItems: 'center',
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fff',
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
        marginBottom: 12,
    },
    logo: {
        width: '100%',
        height: '100%',
        borderRadius: 36,
    },
    logoPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
    },
    infoContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    badge: {
        backgroundColor: 'rgba(76, 175, 80, 0.9)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    filtersBar: {
        flexDirection: 'row',
        gap: 12,
        backgroundColor: 'rgba(255,255,255,0.15)',
        padding: 6,
        borderRadius: 20,
        // Glassmorphism effect fallback
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        gap: 6,
    },
    filterText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
});
