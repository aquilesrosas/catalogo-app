import React from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';

const CARD_WIDTH = (Dimensions.get('window').width - 48) / 2;

function SkeletonPulse({ children, style }: { children?: React.ReactNode; style?: any }) {
    const pulse = React.useRef(new Animated.Value(0.3)).current;

    React.useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.ease, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0.3, duration: 800, easing: Easing.ease, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return <Animated.View style={[style, { opacity: pulse }]}>{children}</Animated.View>;
}

export default function ProductSkeleton() {
    return (
        <View style={styles.card}>
            <SkeletonPulse style={styles.image} />
            <View style={styles.info}>
                <SkeletonPulse style={[styles.line, { width: '45%' }]} />
                <SkeletonPulse style={[styles.line, { width: '85%', height: 14 }]} />
                <SkeletonPulse style={[styles.line, { width: '40%', height: 18 }]} />
                <SkeletonPulse style={[styles.badge]} />
            </View>
        </View>
    );
}

export function SkeletonGrid() {
    return (
        <View style={styles.grid}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <ProductSkeleton key={i} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    card: {
        width: CARD_WIDTH,
        backgroundColor: '#fff',
        borderRadius: 14,
        marginBottom: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    image: {
        width: '100%',
        height: CARD_WIDTH * 0.8,
        backgroundColor: '#E8E8E8',
    },
    info: {
        padding: 12,
        gap: 8,
    },
    line: {
        height: 10,
        backgroundColor: '#E8E8E8',
        borderRadius: 5,
    },
    badge: {
        width: 70,
        height: 20,
        backgroundColor: '#E8E8E8',
        borderRadius: 10,
    },
});
