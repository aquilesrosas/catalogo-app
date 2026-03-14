import React, { useState, useRef, useEffect } from 'react';
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
    Modal,
    ScrollView,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { requestOTP, verifyOTP, logoutAPI, getProfile, loginPassword, setPassword, registerAPI } from '@/services/api';
import { useConfigStore } from '@/stores/configStore';
import { useCartStore } from '@/stores/cartStore';

type Step = 'phone' | 'password' | 'code' | 'set_password' | 'logged_in';

export default function LoginScreen() {
    const router = useRouter();
    const { isLoggedIn, clientName, clientPhone, clientPoints, login, logout, setPoints } = useAuthStore();
    const { clearConfig } = useConfigStore();

    const [step, setStep] = useState<Step>(isLoggedIn() ? 'logged_in' : 'phone');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [password, setPasswordState] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [devCode, setDevCode] = useState<string | null>(null);
    const [showRegister, setShowRegister] = useState(false);

    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (step === 'logged_in') {
            getProfile().then(data => {
                if (data?.points !== undefined) setPoints(data.points);
            }).catch(() => { });
        }
    }, [step]);

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
            if (!result.client.has_password) {
                animateTransition('set_password');
            } else {
                animateTransition('logged_in');
                Alert.alert('✅ ¡Listo!', `Bienvenido, ${result.client.name}`);
            }
        } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || err?.message || 'Error al verificar código');
        } finally {
            setLoading(false);
        }
    };

    const handleLoginPassword = async () => {
        if (!phone || !password) {
            Alert.alert('Aviso', 'Ingresá tu teléfono y contraseña');
            return;
        }
        setLoading(true);
        try {
            const result = await loginPassword(phone.trim(), password);
            login(result.token, result.client.name, result.client.phone, result.client.id);
            animateTransition('logged_in');
            Alert.alert('✅ ¡Listo!', `Bienvenido, ${result.client.name}`);
        } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'Teléfono o contraseña incorrectos');
        } finally {
            setLoading(false);
        }
    };

    const handleSetPassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            Alert.alert('Error', 'Mínimo 6 caracteres');
            return;
        }
        setLoading(true);
        try {
            await setPassword(newPassword);
            animateTransition('logged_in');
            Alert.alert('✅ Éxito', 'Contraseña guardada');
        } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'No se pudo guardar');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await logoutAPI();
        } catch { }
        logout();
        animateTransition('phone');
    };

    const handleRegister = async () => {
        const trimmedName = name.trim();
        const trimmedPhone = phone.trim();
        const trimmedEmail = email.trim();
        const trimmedPass = password.trim();

        if (!trimmedName || !trimmedPhone || !trimmedPass) {
            Alert.alert('Error', 'Completá los campos obligatorios (*)');
            return;
        }
        if (trimmedPass.length < 6) {
            Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
            return;
        }
        try {
            const result = await registerAPI(trimmedName, trimmedPhone, trimmedEmail, trimmedPass);

            if (result.requires_otp) {
                setDevCode(result.dev_code || null);
                animateTransition('code');
                Alert.alert('📬 Verificá tu email', `Te enviamos un código a ${trimmedEmail}`);
            } else {
                login(result.token, result.client.name, result.client.phone, result.client.id);
                setShowRegister(false);
                animateTransition('logged_in');
                Alert.alert('✅ ¡Cuenta creada!', `Bienvenido ${result.client.name}`);
            }
        } catch (err: any) {
            const errorMsg = err?.response?.data?.error || 'No se pudo crear la cuenta';
            Alert.alert('Error', errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Stack.Screen options={{ title: step === 'logged_in' ? 'Mi cuenta' : 'Iniciar sesión' }} />
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.scrollGrow} showsVerticalScrollIndicator={false}>
                    <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                        <View style={styles.brandArea}>
                            <View style={styles.iconCircle}>
                                <Text style={styles.iconText}>{step === 'logged_in' ? '👤' : '🔐'}</Text>
                            </View>
                            <Text style={styles.brandTitle}>{step === 'logged_in' ? 'Mi Cuenta' : 'Iniciar Sesión'}</Text>
                            <Text style={styles.brandSubtitle}>
                                {step === 'phone' && 'Ingresá tus datos para continuar'}
                                {step === 'password' && `Ingresá tu contraseña para ${phone}`}
                                {step === 'code' && `Te enviamos un código a ${email}`}
                                {step === 'set_password' && 'Creá una contraseña para tu cuenta'}
                                {step === 'logged_in' && 'Sesión activa'}
                            </Text>
                        </View>

                        {step === 'phone' && (
                            <View style={styles.formArea}>
                                <Text style={styles.inputLabel}>Tu teléfono *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={phone}
                                    onChangeText={setPhone}
                                    placeholder="Ej: 1123456789"
                                    placeholderTextColor="#aaa"
                                    keyboardType="phone-pad"
                                />
                                <Text style={styles.inputLabel}>Tu contraseña *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={password}
                                    onChangeText={setPasswordState}
                                    placeholder="******"
                                    placeholderTextColor="#aaa"
                                    secureTextEntry
                                />
                                <Pressable
                                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                                    onPress={handleLoginPassword}
                                    disabled={loading}
                                >
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Entrar</Text>}
                                </Pressable>
                                <View style={styles.separatorArea}>
                                    <View style={styles.separator} />
                                    <Text style={styles.separatorText}>O TAMBIÉN</Text>
                                    <View style={styles.separator} />
                                </View>
                                <Pressable
                                    style={styles.secondaryBtn}
                                    onPress={() => {
                                        setName('');
                                        setEmail('');
                                        setPhone('');
                                        setPasswordState('');
                                        setShowRegister(true);
                                    }}
                                >
                                    <Text style={styles.secondaryBtnText}>✨ Crear cuenta nueva</Text>
                                </Pressable>
                                <Pressable style={styles.skipBtn} onPress={() => router.back()}>
                                    <Text style={styles.skipBtnText}>Continuar sin cuenta</Text>
                                </Pressable>
                                <Pressable
                                    style={styles.changeConfigBtn}
                                    onPress={() => {
                                        Alert.alert(
                                            'Cambiar de Local',
                                            '¿Estás seguro? Se borrará el local actual y tendrás que ingresar el código de nuevo.',
                                            [
                                                { text: 'Cancelar', style: 'cancel' },
                                                {
                                                    text: 'Sí, cambiar',
                                                    style: 'destructive',
                                                    onPress: () => {
                                                        const { clearCart } = useCartStore.getState();
                                                        clearCart();
                                                        logout();
                                                        clearConfig();
                                                        router.replace('/config_setup');
                                                    }
                                                }
                                            ]
                                        );
                                    }}
                                >
                                    <Text style={styles.changeConfigBtnText}>🏘️ Cambiar de Local</Text>
                                </Pressable>
                            </View>
                        )}

                        {step === 'code' && (
                            <View style={styles.formArea}>
                                {devCode && (
                                    <View style={styles.devBanner}>
                                        <Text style={styles.devBannerText}>🧪 Dev mode — Tu código: {devCode}</Text>
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
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>✅ Verificar</Text>}
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

                        {step === 'set_password' && (
                            <View style={styles.formArea}>
                                <Text style={styles.inputLabel}>Nueva contraseña</Text>
                                <TextInput
                                    style={styles.input}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    placeholder="Mínimo 6 caracteres"
                                    secureTextEntry
                                    autoFocus
                                />
                                <Pressable
                                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                                    onPress={handleSetPassword}
                                    disabled={loading}
                                >
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Guardar contraseña</Text>}
                                </Pressable>
                                <Pressable style={styles.skipBtn} onPress={() => animateTransition('logged_in')}>
                                    <Text style={styles.skipBtnText}>Omitir por ahora</Text>
                                </Pressable>
                            </View>
                        )}

                        {step === 'logged_in' && (
                            <ScrollView style={styles.loggedInScroll} contentContainerStyle={styles.loggedInContent} showsVerticalScrollIndicator={false}>
                                <View style={styles.profileCard}>
                                    <View style={styles.profileInitials}>
                                        <Text style={styles.profileInitialsText}>{(clientName || '?')[0].toUpperCase()}</Text>
                                    </View>
                                    <Text style={styles.profileName}>{clientName}</Text>
                                    <Text style={styles.profilePhone}>📱 {clientPhone}</Text>
                                    <View style={styles.pointsBadge}>
                                        <Text style={styles.pointsText}>🏆 {clientPoints} puntos</Text>
                                    </View>
                                </View>
                                <Pressable style={styles.primaryBtn} onPress={() => router.replace('/')}>
                                    <Text style={styles.primaryBtnText}>🛒 Ir al catálogo</Text>
                                </Pressable>
                                <Pressable style={styles.ordersBtn} onPress={() => router.push('/orders')}>
                                    <Text style={styles.ordersBtnText}>📄 Mis Pedidos</Text>
                                </Pressable>
                                <Pressable
                                    style={styles.changeConfigBtn}
                                    onPress={() => {
                                        Alert.alert(
                                            'Cambiar de Local',
                                            '¿Estás seguro? Se borrará el local actual y tendrás que ingresar el código de nuevo.',
                                            [
                                                { text: 'Cancelar', style: 'cancel' },
                                                {
                                                    text: 'Sí, cambiar',
                                                    style: 'destructive',
                                                    onPress: () => {
                                                        clearConfig();
                                                        router.replace('/config_setup');
                                                    }
                                                }
                                            ]
                                        );
                                    }}
                                >
                                    <Text style={styles.changeConfigBtnText}>🏘️ Cambiar de Local</Text>
                                </Pressable>
                                <Pressable style={styles.logoutBtn} onPress={handleLogout}>
                                    <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
                                </Pressable>
                            </ScrollView>
                        )}
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal
                visible={showRegister}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowRegister(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Crear cuenta ✨</Text>
                            <Pressable onPress={() => setShowRegister(false)} hitSlop={15}>
                                <Text style={styles.modalCloseText}>✕</Text>
                            </Pressable>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.formArea}>
                                <Text style={styles.inputLabel}>Tu nombre *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="Ej: Juan Pérez"
                                    placeholderTextColor="#aaa"
                                    autoCapitalize="words"
                                />
                                <Text style={styles.inputLabel}>Email (opcional)</Text>
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
                                />
                                <Text style={styles.inputLabel}>Tu contraseña *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={password}
                                    onChangeText={setPasswordState}
                                    placeholder="Mínimo 6 caracteres"
                                    placeholderTextColor="#aaa"
                                    secureTextEntry
                                />
                                <Pressable
                                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                                    onPress={handleRegister}
                                    disabled={loading}
                                >
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Registrarme</Text>}
                                </Pressable>
                                <View style={{ height: 40 }} />
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F9F5',
    },
    scrollGrow: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
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
    separatorArea: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
        gap: 12,
    },
    separator: {
        flex: 1,
        height: 1,
        backgroundColor: '#E0E0E0',
    },
    separatorText: {
        fontSize: 12,
        color: '#999',
        fontWeight: '600',
    },
    secondaryBtn: {
        borderWidth: 1.5,
        borderColor: '#1B5E20',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    secondaryBtnText: {
        color: '#1B5E20',
        fontSize: 16,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1B5E20',
    },
    modalCloseText: {
        fontSize: 24,
        color: '#888',
        padding: 4,
    },
    profileCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E8F5E9',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    profileInitials: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#1B5E20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    profileInitialsText: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '800',
    },
    profileName: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1B5E20',
        marginBottom: 4,
    },
    profilePhone: {
        fontSize: 16,
        color: '#666',
        marginBottom: 12,
    },
    pointsBadge: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#C8E6C9',
    },
    pointsText: {
        color: '#1B5E20',
        fontWeight: '700',
        fontSize: 14,
    },
    logoutBtn: {
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 10,
    },
    logoutBtnText: {
        color: '#D32F2F',
        fontWeight: '700',
        fontSize: 15,
    },
    ordersBtn: {
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#1B5E20',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 12,
    },
    ordersBtnText: {
        color: '#1B5E20',
        fontSize: 17,
        fontWeight: '700',
    },
    devBanner: {
        backgroundColor: '#FFF3E0',
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#FFE0B2',
    },
    devBannerText: {
        color: '#E65100',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },
    loggedInScroll: {
        flex: 1,
    },
    loggedInContent: {
        paddingBottom: 40,
        gap: 12,
    },
    changeConfigBtn: {
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 4,
    },
    changeConfigBtnText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '600',
    },
});
