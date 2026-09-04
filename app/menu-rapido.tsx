import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    activateAllMenu,
    getMenuRapido,
    MenuRapidoProducto,
    resetMenu,
    updateMenuStock,
} from '@/services/api';

export default function MenuRapidoScreen() {
    const router = useRouter();
    const [productos, setProductos] = useState<MenuRapidoProducto[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [categoriaActiva, setCategoriaActiva] = useState<string>('Todas');
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [editCantidadId, setEditCantidadId] = useState<number | null>(null);
    const [cantidadInput, setCantidadInput] = useState('');
    const inputRef = useRef<TextInput>(null);

    const cargar = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const res = await getMenuRapido();
            setProductos(res.productos);
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error || 'No se pudo cargar el menú');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const disponibles = productos.filter(p => p.disponible).length;

    const categorias = ['Todas', ...Array.from(new Set(productos.map(p => p.categoria).filter(Boolean)))];
    const filtrados = categoriaActiva === 'Todas'
        ? productos
        : productos.filter(p => p.categoria === categoriaActiva);

    const toggleDisponible = async (p: MenuRapidoProducto) => {
        const nueva = p.disponible ? 0 : 1;
        setUpdatingId(p.id);
        try {
            await updateMenuStock(p.id, nueva);
            setProductos(prev => prev.map(x => x.id === p.id ? { ...x, cantidad: nueva, disponible: nueva > 0 } : x));
        } catch {
            Alert.alert('Error', 'No se pudo actualizar');
        } finally {
            setUpdatingId(null);
        }
    };

    const guardarCantidad = async (id: number) => {
        const cant = parseInt(cantidadInput, 10);
        if (isNaN(cant) || cant < 0) {
            Alert.alert('Error', 'Ingresá un número válido');
            return;
        }
        setEditCantidadId(null);
        setUpdatingId(id);
        try {
            await updateMenuStock(id, cant);
            setProductos(prev => prev.map(x => x.id === id ? { ...x, cantidad: cant, disponible: cant > 0 } : x));
        } catch {
            Alert.alert('Error', 'No se pudo actualizar');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleActivarTodos = () => {
        Alert.alert('Activar todos', '¿Activar todos los platos con cantidad 1?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Activar', onPress: async () => {
                    setLoading(true);
                    try {
                        await activateAllMenu();
                        await cargar(true);
                    } catch {
                        Alert.alert('Error', 'No se pudo activar');
                    } finally {
                        setLoading(false);
                    }
                }
            },
        ]);
    };

    const handleCerrarTodo = () => {
        Alert.alert('Cerrar menú', '¿Poner todos los platos en agotado?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Cerrar', style: 'destructive', onPress: async () => {
                    setLoading(true);
                    try {
                        await resetMenu();
                        await cargar(true);
                    } catch {
                        Alert.alert('Error', 'No se pudo cerrar');
                    } finally {
                        setLoading(false);
                    }
                }
            },
        ]);
    };

    const renderProducto = ({ item: p }: { item: MenuRapidoProducto }) => {
        const isUpdating = updatingId === p.id;
        const isEditing = editCantidadId === p.id;
        return (
            <View style={[styles.card, !p.disponible && styles.cardAgotado]}>
                {p.imagen ? (
                    <Image source={{ uri: p.imagen }} style={styles.imagen} />
                ) : (
                    <View style={[styles.imagen, styles.sinImagen]}>
                        <Text style={styles.sinImagenIcon}>🍽️</Text>
                    </View>
                )}
                <View style={styles.cardBody}>
                    <Text style={styles.nombre} numberOfLines={2}>{p.nombre}</Text>
                    <Text style={styles.categoria}>{p.categoria || '—'}</Text>
                    <View style={styles.cantidadRow}>
                        {isEditing ? (
                            <View style={styles.cantidadEdit}>
                                <TextInput
                                    ref={inputRef}
                                    style={styles.cantidadInput}
                                    value={cantidadInput}
                                    onChangeText={setCantidadInput}
                                    keyboardType="number-pad"
                                    autoFocus
                                    selectTextOnFocus
                                    onSubmitEditing={() => guardarCantidad(p.id)}
                                    onBlur={() => guardarCantidad(p.id)}
                                    maxLength={4}
                                />
                                <Pressable onPress={() => guardarCantidad(p.id)} style={styles.guardarBtn}>
                                    <Text style={styles.guardarBtnText}>✓</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable
                                onPress={() => {
                                    setEditCantidadId(p.id);
                                    setCantidadInput(String(p.cantidad));
                                    setTimeout(() => inputRef.current?.focus(), 100);
                                }}
                                style={styles.cantidadBadge}
                            >
                                <Text style={[styles.cantidadBadgeText, p.disponible ? styles.cantDisponible : styles.cantAgotado]}>
                                    {p.disponible ? `${p.cantidad} disponibles` : 'Agotado'}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                </View>
                <View style={styles.toggleArea}>
                    {isUpdating ? (
                        <ActivityIndicator size="small" color="#1B5E20" />
                    ) : (
                        <Switch
                            value={p.disponible}
                            onValueChange={() => toggleDisponible(p)}
                            trackColor={{ false: '#ccc', true: '#A5D6A7' }}
                            thumbColor={p.disponible ? '#2E7D32' : '#f4f3f4'}
                        />
                    )}
                </View>
            </View>
        );
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1B5E20" />
                <Text style={styles.loadingText}>Cargando menú...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header stats + acciones */}
            <View style={styles.header}>
                <Text style={styles.statsText}>
                    <Text style={styles.statsNum}>{disponibles}</Text>
                    {' disponibles / '}
                    <Text style={styles.statsTotal}>{productos.length}</Text>
                    {' platos'}
                </Text>
                <View style={styles.accionesRow}>
                    <Pressable style={[styles.accionBtn, styles.activarBtn]} onPress={handleActivarTodos}>
                        <Text style={styles.activarBtnText}>✅ Activar todos</Text>
                    </Pressable>
                    <Pressable style={[styles.accionBtn, styles.cerrarBtn]} onPress={handleCerrarTodo}>
                        <Text style={styles.cerrarBtnText}>❌ Cerrar todo</Text>
                    </Pressable>
                </View>
            </View>

            {/* Filtro por categoría */}
            <View style={styles.categoriaWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriaScroll}>
                    {categorias.map(cat => (
                        <Pressable
                            key={cat}
                            style={[styles.catChip, categoriaActiva === cat && styles.catChipActivo]}
                            onPress={() => setCategoriaActiva(cat)}
                        >
                            <Text style={[styles.catChipText, categoriaActiva === cat && styles.catChipTextActivo]}>
                                {cat}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            {/* Lista */}
            <FlatList
                data={filtrados}
                keyExtractor={p => String(p.id)}
                renderItem={renderProducto}
                contentContainerStyle={styles.lista}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(true); }} colors={['#1B5E20']} />}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <Text style={styles.emptyText}>Sin platos en esta categoría</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F9F5' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: '#555', fontSize: 15 },
    header: {
        backgroundColor: '#1B5E20',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 12,
        gap: 10,
    },
    statsText: { color: '#C8E6C9', fontSize: 14, textAlign: 'center' },
    statsNum: { color: '#fff', fontWeight: '800', fontSize: 20 },
    statsTotal: { color: '#A5D6A7', fontWeight: '600' },
    accionesRow: { flexDirection: 'row', gap: 8 },
    accionBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    activarBtn: { backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#4CAF50' },
    activarBtnText: { color: '#1B5E20', fontWeight: '700', fontSize: 13 },
    cerrarBtn: { backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#EF9A9A' },
    cerrarBtnText: { color: '#C62828', fontWeight: '700', fontSize: 13 },
    categoriaWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E0E0E0' },
    categoriaScroll: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
    catChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    catChipActivo: { backgroundColor: '#1B5E20', borderColor: '#1B5E20' },
    catChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
    catChipTextActivo: { color: '#fff' },
    lista: { padding: 12, gap: 10, paddingBottom: 40 },
    card: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 14,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
        alignItems: 'center',
    },
    cardAgotado: { opacity: 0.65 },
    imagen: { width: 72, height: 72 },
    sinImagen: {
        backgroundColor: '#E8F5E9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sinImagenIcon: { fontSize: 28 },
    cardBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
    nombre: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
    categoria: { fontSize: 12, color: '#888' },
    cantidadRow: { marginTop: 4 },
    cantidadBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: '#F5F5F5',
    },
    cantidadBadgeText: { fontSize: 12, fontWeight: '600' },
    cantDisponible: { color: '#2E7D32' },
    cantAgotado: { color: '#B71C1C' },
    cantidadEdit: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cantidadInput: {
        borderWidth: 1.5,
        borderColor: '#1B5E20',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        fontSize: 15,
        fontWeight: '700',
        color: '#1B5E20',
        width: 70,
        textAlign: 'center',
    },
    guardarBtn: {
        backgroundColor: '#1B5E20',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    guardarBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    toggleArea: { paddingRight: 14, paddingLeft: 4 },
    emptyWrap: { alignItems: 'center', paddingTop: 60 },
    emptyText: { color: '#999', fontSize: 15 },
});
