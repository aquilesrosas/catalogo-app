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
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { requestOTP, verifyOTP, logoutAPI, getProfile, loginPassword, setPassword, registerAPI, loginStaff } from '@/services/api';
import { useConfigStore } from '@/stores/configStore';
import { useCartStore } from '@/stores/cartStore';

type Step = 'phone' | 'password' | 'code' | 'set_password' | 'logged_in';

export default function LoginScreen() {
    const router = useRouter();
    const { isLoggedIn, clientName, clientPhone, clientPoints, isStaff, login, logout, setPoints } = useAuthStore();
    const { clearConfig } = useConfigStore();
    const primaryColor = useConfigStore((s) => s.primaryColor);
    const storeName = useConfigStore((s) => s.storeName);
    const storeAddress = useConfigStore((s) => s.storeAddress);
    const storeTimeRanges = useConfigStore((s) => s.storeTimeRanges);

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
    const [showStaffLogin, setShowStaffLogin] = useState(false);
    const [staffUsername, setStaffUsername] = useState('');
    const [staffPassword, setStaffPasswordState] = useState('');

    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (step === 'logged_in') {
            getProfile().then(data => {
                if (data?.points !== undefined) setPoints(data.points);
            }).catch(() => { });
        }
    }, [step]);

    const animateTransition = (nextStep: Step) => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
            setStep(nextStep);
            Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        });
    };

    const handleVerifyOTP = async () => {
        const trimmedCode = code.trim();
        if (!trimmedCode || trimmedCode.length !== 4) { Alert.alert('Error', 'Ingresá el código de 4 dígitos'); return; }
        Keyboard.dismiss();
        setLoading(true);
        try {
            const result = await verifyOTP(phone.trim(), trimmedCode, name.trim() || undefined, email.trim() || undefined);
            login(result.token, result.client.name, result.client.phone, result.client.id);
            if (!result.client.has_password) animateTransition('set_password');
            else { animateTransition('logged_in'); Alert.alert('✅ ¡Listo!', `Bienvenido, ${result.client.name}`); }
        } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || err?.message || 'Error al verificar código');
        } finally { setLoading(false); }
    };

    const handleLoginPassword = async () => {
        if (!phone || !password) { Alert.alert('Aviso', 'Ingresá tu teléfono y contraseña'); return; }
        setLoading(true);
        try {
            const result = await loginPassword(phone.trim(), password);
            login(result.token, result.client.name, result.client.phone, result.client.id);
            animateTransition('logged_in');
            Alert.alert('✅ ¡Listo!', `Bienvenido, ${result.client.name}`);
        } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'Teléfono o contraseña incorrectos');
        } finally { setLoading(false); }
    };

    const handleSetPassword = async () => {
        if (!newPassword || newPassword.length < 6) { Alert.alert('Error', 'Mínimo 6 caracteres'); return; }
        setLoading(true);
        try {
            await setPassword(newPassword);
            animateTransition('logged_in');
            Alert.alert('✅ Éxito', 'Contraseña guardada');
        } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'No se pudo guardar');
        } finally { setLoading(false); }
    };

    const handleLogout = async () => {
        try { await logoutAPI(); } catch { }
        logout();
        animateTransition('phone');
    };

    const handleRegister = async () => {
        const trimmedName = name.trim();
        const trimmedPhone = phone.trim();
        const trimmedPass = password.trim();
        if (!trimmedName || !trimmedPhone || !trimmedPass) { Alert.alert('Error', 'Completá los campos obligatorios (*)'); return; }
        if (trimmedPass.length < 6) { Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres'); return; }
        setLoading(true);
        try {
            const result = await registerAPI(trimmedName, trimmedPhone, email.trim(), trimmedPass);
            if (result.requires_otp) {
                setDevCode(result.dev_code || null);
                animateTransition('code');
                Alert.alert('📬 Verificá tu email', `Te enviamos un código`);
            } else {
                login(result.token, result.client.name, result.client.phone, result.client.id);
                setShowRegister(false);
                animateTransition('logged_in');
                Alert.alert('✅ ¡Cuenta creada!', `Bienvenido ${result.client.name}`);
            }
        } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'No se pudo crear la cuenta');
        } finally { setLoading(false); }
    };

    const handleStaffLogin = async () => {
        if (!staffUsername || !staffPassword) { Alert.alert('Error', 'Ingresá usuario y contraseña'); return; }
        setLoading(true);
        try {
            const result = await loginStaff(staffUsername.trim(), staffPassword);
            login(result.token, result.client.name, result.client.phone, result.client.id, true);
            setShowStaffLogin(false);
            setStaffUsername(''); setStaffPasswordState('');
            animateTransition('logged_in');
            Alert.alert('✅ Acceso staff', `Bienvenido, ${result.client.name}`);
        } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'Credenciales incorrectas');
        } finally { setLoading(false); }
    };

    const doChangeLocal = () => {
        const { clearCart } = useCartStore.getState();
        clearCart(); logout(); clearConfig();
        router.replace('/config_setup');
    };

    const confirmChangeLocal = () => {
        if (Platform.OS === 'web') {
            if (window.confirm('¿Estás seguro? Se borrará el local actual.')) doChangeLocal();
        } else {
            Alert.alert('Cambiar de Local', '¿Estás seguro?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Sí, cambiar', style: 'destructive', onPress: doChangeLocal },
            ]);
        }
    };

    // Store info card — shown when not logged in
    const storeCard = storeName ? (
        <View style={[s.storeCard, { borderColor: primaryColor + '33' }]}>
            <View style={[s.storeCardAccent, { backgroundColor: primaryColor }]} />
            <View style={s.storeCardBody}>
                <Text style={[s.storeCardName, { color: primaryColor }]}>{storeName}</Text>
                {!!storeAddress && (
                    <Text style={s.storeCardRow}>📍 {storeAddress}</Text>
                )}
                {storeTimeRanges.length > 0 && (
                    <Text style={s.storeCardRow}>
                        🕐 {storeTimeRanges.map(r => `${r.start} – ${r.end}`).join(' · ')}
                    </Text>
                )}
            </View>
        </View>
    ) : null;

    return (
        <>
            <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={s.scrollGrow} showsVerticalScrollIndicator={false}>
                    <Animated.View style={[s.content, { opacity: fadeAnim }]}>

                        {/* Brand header */}
                        <View style={s.brandArea}>
                            <View style={[s.iconCircle, { backgroundColor: primaryColor + '18', shadowColor: primaryColor }]}>
                                <Text style={s.iconText}>{step === 'logged_in' ? '👤' : '🔐'}</Text>
                            </View>
                            <Text style={[s.brandTitle, { color: primaryColor }]}>
                                {step === 'logged_in' ? 'Mi Cuenta' : 'Iniciar Sesión'}
                            </Text>
                            <Text style={s.brandSubtitle}>
                                {step === 'phone' && 'Ingresá tus datos para continuar'}
                                {step === 'password' && `Contraseña para ${phone}`}
                                {step === 'code' && `Código enviado a ${email}`}
                                {step === 'set_password' && 'Creá una contraseña'}
                                {step === 'logged_in' && 'Sesión activa'}
                            </Text>
                        </View>

                        {/* ── LOGIN ── */}
                        {step === 'phone' && (
                            <View style={s.formArea}>
                                <Text style={s.inputLabel}>Tu teléfono *</Text>
                                <TextInput style={s.input} value={phone} onChangeText={setPhone}
                                    placeholder="Ej: 1123456789" placeholderTextColor="#aaa" keyboardType="phone-pad" />
                                <Text style={s.inputLabel}>Tu contraseña *</Text>
                                <TextInput style={s.input} value={password} onChangeText={setPasswordState}
                                    placeholder="******" placeholderTextColor="#aaa" secureTextEntry />
                                <Pressable style={[s.primaryBtn, { backgroundColor: primaryColor }, loading && s.btnDisabled]}
                                    onPress={handleLoginPassword} disabled={loading}>
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Entrar</Text>}
                                </Pressable>

                                <View style={s.separatorArea}>
                                    <View style={s.separator} />
                                    <Text style={s.separatorText}>O TAMBIÉN</Text>
                                    <View style={s.separator} />
                                </View>

                                <Pressable style={[s.secondaryBtn, { borderColor: primaryColor }]}
                                    onPress={() => { setName(''); setEmail(''); setPhone(''); setPasswordState(''); setShowRegister(true); }}>
                                    <Text style={[s.secondaryBtnText, { color: primaryColor }]}>✨ Crear cuenta nueva</Text>
                                </Pressable>

                                <Pressable style={s.skipBtn} onPress={() => router.back()}>
                                    <Text style={s.skipBtnText}>Continuar sin cuenta</Text>
                                </Pressable>
                                <Pressable style={s.skipBtn} onPress={() => setShowStaffLogin(true)}>
                                    <Text style={[s.skipBtnText, { color: primaryColor, fontWeight: '600' }]}>🔑 Acceso staff / empleado</Text>
                                </Pressable>
                                <Pressable style={s.changeConfigBtn} onPress={confirmChangeLocal}>
                                    <Text style={s.changeConfigBtnText}>🏘️ Cambiar de Local</Text>
                                </Pressable>

                                {/* Datos del local */}
                                {storeCard}
                            </View>
                        )}

                        {/* ── CÓDIGO OTP ── */}
                        {step === 'code' && (
                            <View style={s.formArea}>
                                {devCode && (
                                    <View style={s.devBanner}>
                                        <Text style={s.devBannerText}>🧪 Dev — Código: {devCode}</Text>
                                    </View>
                                )}
                                <Text style={s.inputLabel}>Código de verificación *</Text>
                                <TextInput style={[s.input, s.codeInput]} value={code} onChangeText={setCode}
                                    placeholder="0000" placeholderTextColor="#ccc" keyboardType="number-pad"
                                    maxLength={4} autoFocus textAlign="center" />
                                <Pressable style={[s.primaryBtn, { backgroundColor: primaryColor }, loading && s.btnDisabled]}
                                    onPress={handleVerifyOTP} disabled={loading}>
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>✅ Verificar</Text>}
                                </Pressable>
                                <Pressable style={s.skipBtn} onPress={() => { setCode(''); setDevCode(null); animateTransition('phone'); }}>
                                    <Text style={s.skipBtnText}>← Cambiar</Text>
                                </Pressable>
                            </View>
                        )}

                        {/* ── SET PASSWORD ── */}
                        {step === 'set_password' && (
                            <View style={s.formArea}>
                                <Text style={s.inputLabel}>Nueva contraseña</Text>
                                <TextInput style={s.input} value={newPassword} onChangeText={setNewPassword}
                                    placeholder="Mínimo 6 caracteres" secureTextEntry autoFocus />
                                <Pressable style={[s.primaryBtn, { backgroundColor: primaryColor }, loading && s.btnDisabled]}
                                    onPress={handleSetPassword} disabled={loading}>
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Guardar contraseña</Text>}
                                </Pressable>
                                <Pressable style={s.skipBtn} onPress={() => animateTransition('logged_in')}>
                                    <Text style={s.skipBtnText}>Omitir por ahora</Text>
                                </Pressable>
                            </View>
                        )}

                        {/* ── LOGGED IN ── */}
                        {step === 'logged_in' && (
                            <ScrollView style={s.loggedInScroll} contentContainerStyle={s.loggedInContent} showsVerticalScrollIndicator={false}>
                                <View style={[s.profileCard, { borderColor: primaryColor + '22' }]}>
                                    <View style={[s.profileInitials, { backgroundColor: primaryColor }]}>
                                        <Text style={s.profileInitialsText}>{(clientName || '?')[0].toUpperCase()}</Text>
                                    </View>
                                    <Text style={[s.profileName, { color: primaryColor }]}>{clientName}</Text>
                                    <Text style={s.profilePhone}>📱 {clientPhone}</Text>
                                    <View style={s.pointsContainer}>
                                        <Text style={s.pointsIcon}>🌟</Text>
                                        <View>
                                            <Text style={s.pointsValue}>{clientPoints}</Text>
                                            <Text style={s.pointsLabel}>Puntos Acumulados</Text>
                                        </View>
                                    </View>
                                </View>

                                <Pressable style={[s.primaryBtn, { backgroundColor: primaryColor }]} onPress={() => router.replace('/(tabs)')}>
                                    <Text style={s.primaryBtnText}>🛒 Ir al catálogo</Text>
                                </Pressable>
                                <Pressable style={[s.ordersBtn, { borderColor: primaryColor }]} onPress={() => router.push('/(tabs)/orders')}>
                                    <Text style={[s.ordersBtnText, { color: primaryColor }]}>📄 Mis Pedidos</Text>
                                </Pressable>
                                <Pressable style={[s.ordersBtn, { borderColor: '#FF6F00', backgroundColor: '#FFF8E1' }]} onPress={() => router.push('/store')}>
                                    <Text style={[s.ordersBtnText, { color: '#FF6F00' }]}>🏪 Nuestro Local</Text>
                                </Pressable>
                                {isStaff && (
                                    <Pressable style={[s.ordersBtn, { borderColor: primaryColor, backgroundColor: primaryColor + '10' }]} onPress={() => router.push('/menu-rapido' as any)}>
                                        <Text style={[s.ordersBtnText, { color: primaryColor }]}>⚡ Menú Rápido</Text>
                                    </Pressable>
                                )}

                                {/* Datos del local para usuarios logueados */}
                                {storeCard}

                                <Pressable style={s.changeConfigBtn} onPress={confirmChangeLocal}>
                                    <Text style={s.changeConfigBtnText}>🏘️ Cambiar de Local</Text>
                                </Pressable>
                                <Pressable style={s.logoutBtn} onPress={handleLogout}>
                                    <Text style={s.logoutBtnText}>Cerrar sesión</Text>
                                </Pressable>
                            </ScrollView>
                        )}
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── Modal: Staff Login ── */}
            <Modal visible={showStaffLogin} animationType="slide" transparent onRequestClose={() => setShowStaffLogin(false)}>
                <View style={s.modalOverlay}>
                    <View style={s.modalContent}>
                        <View style={s.modalHeader}>
                            <Text style={[s.modalTitle, { color: primaryColor }]}>🔑 Acceso Staff</Text>
                            <Pressable onPress={() => setShowStaffLogin(false)} hitSlop={15}>
                                <Text style={s.modalCloseText}>✕</Text>
                            </Pressable>
                        </View>
                        <View style={s.formArea}>
                            <Text style={s.inputLabel}>Usuario del sistema</Text>
                            <TextInput style={s.input} value={staffUsername} onChangeText={setStaffUsername}
                                placeholder="Ej: maria_garcia" placeholderTextColor="#aaa" autoCapitalize="none" autoCorrect={false} />
                            <Text style={s.inputLabel}>Contraseña</Text>
                            <TextInput style={s.input} value={staffPassword} onChangeText={setStaffPasswordState}
                                placeholder="******" placeholderTextColor="#aaa" secureTextEntry />
                            <Pressable style={[s.primaryBtn, { backgroundColor: primaryColor }, loading && s.btnDisabled]}
                                onPress={handleStaffLogin} disabled={loading}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Entrar como staff</Text>}
                            </Pressable>
                            <View style={{ height: 20 }} />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Modal: Registro ── */}
            <Modal visible={showRegister} animationType="slide" transparent onRequestClose={() => setShowRegister(false)}>
                <View style={s.modalOverlay}>
                    <View style={s.modalContent}>
                        <View style={s.modalHeader}>
                            <View>
                                <Text style={[s.modalTitle, { color: primaryColor }]}>✨ Crear cuenta</Text>
                                <Text style={s.modalSubtitle}>Es gratis y te da acceso a beneficios</Text>
                            </View>
                            <Pressable onPress={() => setShowRegister(false)} hitSlop={15}>
                                <Text style={s.modalCloseText}>✕</Text>
                            </Pressable>
                        </View>

                        {/* Beneficios */}
                        <View style={s.benefitsRow}>
                            <View style={s.benefitChip}><Text style={s.benefitChipText}>🌟 Puntos</Text></View>
                            <View style={s.benefitChip}><Text style={s.benefitChipText}>📦 Seguí pedidos</Text></View>
                            <View style={s.benefitChip}><Text style={s.benefitChipText}>⚡ Más rápido</Text></View>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={s.formArea}>
                                <Text style={s.inputLabel}>Tu nombre *</Text>
                                <TextInput style={s.input} value={name} onChangeText={setName}
                                    placeholder="Ej: Juan Pérez" placeholderTextColor="#aaa" autoCapitalize="words" />
                                <Text style={s.inputLabel}>Tu teléfono *</Text>
                                <TextInput style={s.input} value={phone} onChangeText={setPhone}
                                    placeholder="Ej: 1123456789" placeholderTextColor="#aaa" keyboardType="phone-pad" />
                                <Text style={s.inputLabel}>Email (opcional)</Text>
                                <TextInput style={s.input} value={email} onChangeText={setEmail}
                                    placeholder="tu@email.com" placeholderTextColor="#aaa"
                                    keyboardType="email-address" autoCapitalize="none" />
                                <Text style={s.inputLabel}>Contraseña *</Text>
                                <TextInput style={s.input} value={password} onChangeText={setPasswordState}
                                    placeholder="Mínimo 6 caracteres" placeholderTextColor="#aaa" secureTextEntry />
                                <Pressable style={[s.primaryBtn, { backgroundColor: primaryColor }, loading && s.btnDisabled]}
                                    onPress={handleRegister} disabled={loading}>
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Registrarme gratis</Text>}
                                </Pressable>
                                <Pressable style={s.skipBtn} onPress={() => setShowRegister(false)}>
                                    <Text style={s.skipBtnText}>Ya tengo cuenta</Text>
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

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F9F5' },
    scrollGrow: { flexGrow: 1, justifyContent: 'center' },
    content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
    brandArea: { alignItems: 'center', marginBottom: 32 },
    iconCircle: {
        width: 80, height: 80, borderRadius: 40,
        justifyContent: 'center', alignItems: 'center', marginBottom: 14,
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
    },
    iconText: { fontSize: 36 },
    brandTitle: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
    brandSubtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
    formArea: { gap: 12 },
    inputLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: -4 },
    input: {
        borderWidth: 1.5, borderColor: '#D0D0D0', borderRadius: 12,
        padding: 14, fontSize: 16, color: '#1a1a1a', backgroundColor: '#fff',
    },
    codeInput: { fontSize: 28, fontWeight: '700', letterSpacing: 12, paddingVertical: 18 },
    primaryBtn: {
        paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8,
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
    },
    btnDisabled: { opacity: 0.7 },
    primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    secondaryBtn: { borderWidth: 1.5, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#fff' },
    secondaryBtnText: { fontSize: 16, fontWeight: '700' },
    skipBtn: { alignItems: 'center', paddingVertical: 12 },
    skipBtnText: { color: '#888', fontSize: 14 },
    separatorArea: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 12 },
    separator: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
    separatorText: { fontSize: 12, color: '#999', fontWeight: '600' },
    changeConfigBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
    changeConfigBtnText: { color: '#666', fontSize: 14, fontWeight: '600' },
    // Store info card
    storeCard: {
        marginTop: 24, borderRadius: 16, borderWidth: 1,
        backgroundColor: '#fff', overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    storeCardAccent: { height: 4 },
    storeCardBody: { padding: 16, gap: 6 },
    storeCardName: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
    storeCardRow: { fontSize: 13, color: '#555', lineHeight: 20 },
    // Logged in
    loggedInScroll: { flex: 1 },
    loggedInContent: { paddingBottom: 40, gap: 12 },
    profileCard: {
        backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center',
        borderWidth: 1, marginBottom: 8,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    },
    profileInitials: {
        width: 70, height: 70, borderRadius: 35,
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    profileInitialsText: { color: '#fff', fontSize: 28, fontWeight: '800' },
    profileName: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
    profilePhone: { fontSize: 16, color: '#666', marginBottom: 12 },
    pointsContainer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#FFF8E1', paddingHorizontal: 20, paddingVertical: 14,
        borderRadius: 16, width: '100%', borderWidth: 1, borderColor: '#FFECB3', gap: 12, marginTop: 10,
    },
    pointsIcon: { fontSize: 32 },
    pointsValue: { fontSize: 24, fontWeight: '900', color: '#FF8F00' },
    pointsLabel: { fontSize: 12, fontWeight: '700', color: '#FFB300', textTransform: 'uppercase' },
    ordersBtn: {
        backgroundColor: '#fff', borderWidth: 1.5, paddingVertical: 16,
        borderRadius: 14, alignItems: 'center', marginTop: 4,
    },
    ordersBtnText: { fontSize: 17, fontWeight: '700' },
    logoutBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 10 },
    logoutBtnText: { color: '#D32F2F', fontWeight: '700', fontSize: 15 },
    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    modalTitle: { fontSize: 22, fontWeight: '800' },
    modalSubtitle: { fontSize: 13, color: '#888', marginTop: 2 },
    modalCloseText: { fontSize: 24, color: '#888', padding: 4 },
    devBanner: { backgroundColor: '#FFF3E0', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#FFE0B2' },
    devBannerText: { color: '#E65100', fontSize: 14, fontWeight: '700', textAlign: 'center' },
    // Beneficios chips
    benefitsRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
    benefitChip: { backgroundColor: '#F0F9F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    benefitChipText: { fontSize: 13, fontWeight: '600', color: '#2E7D32' },
});
