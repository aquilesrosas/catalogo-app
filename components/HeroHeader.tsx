import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useConfigStore } from '@/stores/configStore';
import { getStoreConfig, StoreConfig } from '@/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Infinite scrolling marquee strip
function MarqueeStrip({ text, primaryColor }: { text: string; primaryColor: string }) {
    const anim = useRef(new Animated.Value(0)).current;
    const [contentWidth, setContentWidth] = useState(0);
    const animRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        if (!contentWidth) return;
        anim.setValue(0);
        animRef.current = Animated.loop(
            Animated.timing(anim, {
                toValue: -(contentWidth / 2),
                duration: (contentWidth / 2) * 22,
                easing: Easing.linear,
                useNativeDriver: Platform.OS !== 'web',
            })
        );
        animRef.current.start();
        return () => animRef.current?.stop();
    }, [contentWidth]);

    const segment = `${text.toUpperCase()}  ·  `;
    const full = segment.repeat(8);

    return (
        <View style={{ overflow: 'hidden', backgroundColor: primaryColor, paddingVertical: 7 }}>
            <Animated.View
                style={{ flexDirection: 'row', transform: [{ translateX: anim }] }}
                onLayout={(e) => {
                    const w = e.nativeEvent.layout.width;
                    if (w > 0 && w !== contentWidth) setContentWidth(w);
                }}
            >
                <Text
                    style={[
                        styles.marqueeText,
                        Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : {},
                    ]}
                >
                    {full}
                </Text>
            </Animated.View>
        </View>
    );
}

export default function HeroHeader({ showTagline = true }: { showTagline?: boolean }) {
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
    const tagline = (storeConfig?.catalog_config as any)?.tagline || '';
    const coverUrl = (storeConfig?.catalog_config as any)?.cover_url || '';

    // Marquee text: store name + tagline if available
    const marqueeContent = tagline ? `${name}  —  ${tagline}` : name;

    return (
        <View style={{ backgroundColor: '#FAFAFA' }}>
            {/* Hero block */}
            <View style={[styles.hero, { paddingTop: insets.top + 16, backgroundColor: primaryColor }]}>
                {/* Cover image overlay */}
                {coverUrl ? (
                    <View style={StyleSheet.absoluteFillObject}>
                        <Image source={{ uri: coverUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
                    </View>
                ) : (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.28)' }]} />
                )}

                <View style={styles.heroContent}>
                    {/* Logo */}
                    <View style={[styles.logoRing, { borderColor: 'rgba(255,255,255,0.4)' }]}>
                        {logoUrl ? (
                            <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" />
                        ) : (
                            <View style={[styles.logoPlaceholder, { backgroundColor: primaryColor }]}>
                                <Text style={styles.logoLetter}>{name?.charAt(0) || 'C'}</Text>
                            </View>
                        )}
                    </View>

                    {/* Store name */}
                    <Text style={styles.storeName} numberOfLines={1}>{name}</Text>

                    {/* Tagline */}
                    {showTagline && tagline ? (
                        <Text style={styles.tagline} numberOfLines={2}>{tagline}</Text>
                    ) : null}

                    {/* Status badge */}
                    <View style={[styles.statusBadge, { backgroundColor: isClosed ? 'rgba(211,47,47,0.85)' : 'rgba(56,142,60,0.85)' }]}>
                        <View style={[styles.statusDot, { backgroundColor: isClosed ? '#ff8a80' : '#b9f6ca' }]} />
                        <Text style={styles.statusText}>{isClosed ? 'Cerrado' : 'Abierto ahora'}</Text>
                    </View>
                </View>
            </View>

            {/* Animated marquee strip */}
            <MarqueeStrip text={marqueeContent} primaryColor={primaryColor} />
        </View>
    );
}

const styles = StyleSheet.create({
    hero: {
        paddingBottom: 32,
        position: 'relative',
        overflow: 'hidden',
    },
    heroContent: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    logoRing: {
        width: 88,
        height: 88,
        borderRadius: 44,
        borderWidth: 3,
        backgroundColor: '#fff',
        padding: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
        marginBottom: 14,
    },
    logo: {
        width: '100%',
        height: '100%',
        borderRadius: 40,
    },
    logoPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoLetter: {
        fontSize: 36,
        fontWeight: '900',
        color: '#fff',
    },
    storeName: {
        fontSize: 26,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: -0.5,
        textShadowColor: 'rgba(0,0,0,0.4)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
        marginBottom: 6,
    },
    tagline: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.85)',
        textAlign: 'center',
        fontWeight: '500',
        letterSpacing: 0.2,
        lineHeight: 20,
        marginBottom: 12,
        paddingHorizontal: 20,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 6,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    marqueeText: {
        fontSize: 11,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.9)',
        letterSpacing: 2.5,
    },
});
