import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Pressable,
    Alert,
    ActivityIndicator,
    Keyboard,
    Animated,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { requestOTP, verifyOTP, logoutAPI } from '@/services/api';

type Step = 'phone' | 'code' | 'logged_in';

export default function LoginScreen() {
    const router = useRouter();
    const { isLoggedIn, clientName, clientPhone, login, logout } = useAuthStore();

    const [step, setStep] = useState<Step>(isLoggedIn() ? 'logged_in' : 'phone');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [devCode, setDevCode] = useState<string | null>(null);

    const fadeAnim = useRef(new Animated.Value(1)).current;

    const animateTransition = (nextStep: Step) => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
        }).start(() => {
            setStep(nextStep);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        });
    };

    const handleRequestOTP = async () => {
        const trimmedPhone = phone.trim();
        const trimmedEmail = email.trim();
        if (!trimmedPhone || trimmedPhone.length < 8) {
            Alert.alert('Error', 'Ingresá un teléfono válido (mínimo 8 dígitos)');
            return;
        }
        if (!trimmedEmail || !trimmedEmail.includes('@')) {
            Alert.alert('Error', 'Ingresá un email válido');
            return;
        }

        Keyboard.dismiss();
        setLoading(true);

        try {
            const result = await requestOTP(trimmedPhone, trimmedEmail);
            // En dev mode, mostrar el código
            if (result.dev_code) {
                setDevCode(result.dev_code);
            }
            animateTransition('code');
        } catch (err: any) {
            const msg =
                err?.response?.data?.error ||
                err?.message ||
                'Error al enviar código';
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        const trimmedCode = code.trim();
        if (!trimmedCode || trimmedCode.length !== 4) {
            Alert.alert('Error', 'Ingresá el código de 4 dígitos');
            return;
        }

        Keyboard.dismiss();
        setLoading(true);

        try {
            const result = await verifyOTP(phone.trim(), trimmedCode, name.trim() || undefined, email.trim() || undefined);
            login(result.token, result.client.name, result.client.phone, result.client.id);
            animateTransition('logged_in');
            Alert.alert('✅ ¡Listo!', `Bienvenido, ${result.client.name}`);
        } catch (err: any) {
            const msg =
                err?.response?.data?.error ||
                err?.message ||
                'Error al verificar código';
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await logoutAPI();
        } catch { }
        logout();
        setPhone('');
        setEmail('');
        setCode('');
        setName('');
        setDevCode(null);
        animateTransition('phone');
    };

    return (
        <>
            <Stack.Screen options={{ title: step === 'logged_in' ? 'Mi cuenta' : 'Iniciar sesión' }} />
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                    {/* ─── Logo / Brand ─── */}
                    <View style={styles.brandArea}>
                        <View style={styles.iconCircle}>
                            <Text style={styles.iconText}>
                                {step === 'logged_in' ? '👤' : '🔐'}
                            </Text>
                        </View>
                        <Text style={styles.brandTitle}>
                            {step === 'logged_in' ? 'Mi Cuenta' : 'Iniciar Sesión'}
                        </Text>
                        <Text style={styles.brandSubtitle}>
                            {step === 'phone' && 'Ingresá tus datos para continuar'}
                            {step === 'code' && `Te enviamos un código a ${email}`}
                            {step === 'logged_in' && `Sesión activa`}
                        </Text>
                    </View>

                    {/* ─── Step: Phone ─── */}
                    {step === 'phone' && (
                        <View style={styles.formArea}>
                            <Text style={styles.inputLabel}>Tu nombre</Text>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="Ej: Juan Pérez"
                                placeholderTextColor="#aaa"
                                autoCapitalize="words"
                            />
                            <Text style={styles.inputLabel}>Tu email *</Text>
                            <TextInput
                                style={styles.input}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="tu@email.com"
                                placeholderTextColor="#aaa"
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                            <Text style={styles.inputLabel}>Tu teléfono *</Text>
                            <TextInput
                                style={styles.input}
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="Ej: 1123456789"
                                placeholderTextColor="#aaa"
                                keyboardType="phone-pad"
                                autoFocus
                            />
                            <Pressable
                                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                                onPress={handleRequestOTP}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.primaryBtnText}>📩 Enviar código</Text>
                                )}
                            </Pressable>

                            <Pressable style={styles.skipBtn} onPress={() => router.back()}>
                                <Text style={styles.skipBtnText}>Continuar sin cuenta</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* ─── Step: Code ─── */}
                    {step === 'code' && (
                        <View style={styles.formArea}>
                            {devCode && (
                                <View style={styles.devBanner}>
                                    <Text style={styles.devBannerText}>
                                        🧪 Dev mode — Tu código: {devCode}
                                    </Text>
                                </View>
                            )}
                            <Text style={styles.inputLabel}>Código de verificación *</Text>
                            <TextInput
                                style={[styles.input, styles.codeInput]}
                                value={code}
                                onChangeText={setCode}
                                placeholder="0000"
                                placeholderTextColor="#ccc"
                                keyboardType="number-pad"
                                maxLength={4}
                                autoFocus
                                textAlign="center"
                            />
                            <Pressable
                                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                                onPress={handleVerifyOTP}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.primaryBtnText}>✅ Verificar</Text>
                                )}
                            </Pressable>

                            <Pressable
                                style={styles.skipBtn}
                                onPress={() => {
                                    setCode('');
                                    setDevCode(null);
                                    animateTransition('phone');
                                }}
                            >
                                <Text style={styles.skipBtnText}>← Cambiar</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* ─── Step: Logged In (Profile) ─── */}
                    {step === 'logged_in' && (
                        <View style={styles.formArea}>
                            <View style={styles.profileCard}>
                                <View style={styles.profileInitials}>
                                    <Text style={styles.profileInitialsText}>
                                        {(clientName || '?')[0].toUpperCase()}
                                    </Text>
                                </View>
                                <Text style={styles.profileName}>{clientName}</Text>
                                <Text style={styles.profilePhone}>📱 {clientPhone}</Text>
                            </View>

                            <Pressable
                                style={styles.primaryBtn}
                                onPress={() => router.replace('/')}
                            >
                                <Text style={styles.primaryBtnText}>🛒 Ir al catálogo</Text>
                            </Pressable>

                            <Pressable style={styles.logoutBtn} onPress={handleLogout}>
                                <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
                            </Pressable>
                        </View>
                    )}
                </Animated.View>
            </KeyboardAvoidingView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F9F5',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    // ─── Brand ───
    brandArea: {
        alignItems: 'center',
        marginBottom: 36,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#E8F5E9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#1B5E20',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
    },
    iconText: {
        fontSize: 36,
    },
    brandTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B5E20',
        marginBottom: 6,
    },
    brandSubtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    // ─── Form ───
    formArea: {
        gap: 12,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#555',
        marginBottom: -4,
    },
    input: {
        borderWidth: 1.5,
        borderColor: '#D0D0D0',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#1a1a1a',
        backgroundColor: '#fff',
    },
    codeInput: {
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: 12,
        paddingVertical: 18,
    },
    primaryBtn: {
        backgroundColor: '#1B5E20',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#1B5E20',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 6,
    },
    btnDisabled: {
        opacity: 0.7,
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    skipBtn: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    skipBtnText: {
        color: '#888',
        fontSize: 14,
    },
    // ─── Dev Banner ───
    devBanner: {
        backgroundColor: '#FFF3E0',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#FFB74D',
    },
    devBannerText: {
        color: '#E65100',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    // ─── Profile ───
    profileCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    profileInitials: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#1B5E20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    profileInitialsText: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '700',
    },
    profileName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333',
    },
    profilePhone: {
        fontSize: 15,
        color: '#666',
        marginTop: 4,
    },
    logoutBtn: {
        alignItems: 'center',
        paddingVertical: 14,
        marginTop: 4,
    },
    logoutBtnText: {
        color: '#D32F2F',
        fontSize: 15,
        fontWeight: '600',
    },
});
