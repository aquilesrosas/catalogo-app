import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Pressable,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useConfigStore } from '@/stores/configStore';
import { getStoreConfig } from '@/services/api';

function ConfigSetupScreen() {
    const [slug, setSlug] = useState('');
    const [loading, setLoading] = useState(false);
    const setTenantSlug = useConfigStore((s) => s.setTenantSlug);
    const router = useRouter();

    const handleConfirm = async () => {
        const cleanSlug = slug.trim();
        if (!cleanSlug) {
            Alert.alert('Error', 'Ingresá el código de tu local');
            return;
        }

        setLoading(true);
        try {
            // Guardamos temporalmente para probar si existe
            setTenantSlug(cleanSlug);

            // Intentamos cargar la config de la tienda para validar que el slug existe
            await getStoreConfig();

            Alert.alert('✅ ¡Listo!', 'Configuración guardada correctamente');
            router.replace('/');
        } catch (err: any) {
            // Si falla, revertimos y avisamos
            setTenantSlug('');
            Alert.alert('Error', 'No se encontró un local con ese código. Verificá y probá de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <Stack.Screen options={{ title: 'Configuración Inicial', headerShown: false }} />
            <View style={styles.card}>
                <Text style={styles.emoji}>🏘️</Text>
                <Text style={styles.title}>Bienvenido al Catálogo</Text>
                <Text style={styles.subtitle}>
                    Por favor, ingresá el código de local que te proporcionó el administrador.
                </Text>

                <TextInput
                    style={styles.input}
                    placeholder="Ej: mini_super1-"
                    value={slug}
                    onChangeText={setSlug}
                    autoCapitalize="none"
                    autoCorrect={false}
                />

                <Pressable
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleConfirm}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Confirmar Local</Text>
                    )}
                </Pressable>

                <Text style={styles.footerText}>
                    Necesitás el código para ver los productos y precios de tu tienda habitual.
                </Text>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1B5E20',
        padding: 24,
        justifyContent: 'center',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    emoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1a1a1a',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    input: {
        width: '100%',
        height: 54,
        borderWidth: 1.5,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        backgroundColor: '#F9F9F9',
        marginBottom: 20,
        color: '#1a1a1a',
    },
    button: {
        width: '100%',
        height: 54,
        backgroundColor: '#1B5E20',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    footerText: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
        paddingHorizontal: 12,
    },
});

export default ConfigSetupScreen;
