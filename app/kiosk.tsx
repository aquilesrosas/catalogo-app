import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    Modal,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView,
    useWindowDimensions,
    StatusBar,
    BackHandler,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useKioskStore } from '@/stores/kioskStore';
import { useConfigStore } from '@/stores/configStore';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
import {
    getProducts,
    getCategories,
    getPaymentMethods,
    searchClientsPublic,
    registerClientPublic,
    createOrder,
    Category,
    Product,
} from '@/services/api';
import { formatPrice } from '@/utils/format';

// ─── Constants ───────────────────────────────
const INACTIVITY_TIMEOUT = 60000; // 60 seconds
const ADMIN_PIN = '2424'; // PIN para salir del kiosco
const CONFIG_PIN = '1234'; // PIN para configurar categorías

// Hardcoded extras removed. Dynamic extras will be loaded from configured categories.

// ─── Main Kiosk Screen ──────────────────────
export default function KioskScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isTablet = width > 700;
    const numColumns = isTablet ? (width > 900 ? 4 : 3) : 2;

    // Store
    const store = useKioskStore();
    const params = useLocalSearchParams();
    const kioskCategoryIds = useConfigStore((s) => s.kioskCategoryIds);
    const kioskExtraCategoryIds = useConfigStore((s) => s.kioskExtraCategoryIds) || [];
    const setKioskCategoryIds = useConfigStore((s) => s.setKioskCategoryIds);
    const setKioskExtraCategoryIds = useConfigStore((s) => s.setKioskExtraCategoryIds);
    const { isLoggedIn, clientId, clientName, clientPhone } = useAuthStore();

    // Set kioskId from URL param (Table QR Ordering)
    useEffect(() => {
        if (params.kiosk && typeof params.kiosk === 'string') {
            store.setKioskId(params.kiosk);
        }
    }, [params.kiosk]);

    // Smart checkout: auto-identify if already logged in
    const handleStartCheckout = () => {
        if (isLoggedIn() && clientId && clientName) {
            store.startCheckout();
            store.setSelectedClient({
                id: clientId,
                name: clientName,
                phone: clientPhone || '',
            });
            store.setCheckoutStep('payment');
        } else {
            store.startCheckout();
        }
    };

    // Data
    const [products, setProducts] = useState<Product[]>([]);
    const [dynamicExtras, setDynamicExtras] = useState<any[]>([]);
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string, name: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

    // Filtered categories for kiosk display
    const filteredCategories = kioskCategoryIds.length > 0
        ? allCategories.filter(c => kioskCategoryIds.includes(c.id_categoria))
        : allCategories;

    // Builder local state
    const [builderQty, setBuilderQty] = useState(1);
    const [builderNotes, setBuilderNotes] = useState('');
    const [selectedExtras, setSelectedExtras] = useState<any[]>([]);
    const addItemToGlobalCart = useCartStore((s) => s.addItem);

    // Checkout local state
    const [identityQuery, setIdentityQuery] = useState('');
    const [identityError, setIdentityError] = useState('');

    // Admin PIN modal
    const [pinModalVisible, setPinModalVisible] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinAction, setPinAction] = useState<'exit' | 'config'>('exit');

    // Config modal
    const [configModalVisible, setConfigModalVisible] = useState(false);
    const [tempCategoryIds, setTempCategoryIds] = useState<number[]>([]);
    const [tempExtraCategoryIds, setTempExtraCategoryIds] = useState<number[]>([]);

    // Inactivity timer
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Hardware back button → go back to main view
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            store.resetKiosk();
            router.back();
            return true;
        });
        return () => sub.remove();
    }, []);

    // Auto-reset on inactivity
    useEffect(() => {
        const resetTimer = () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                store.resetKiosk();
                setSelectedCategory(null);
            }, INACTIVITY_TIMEOUT);
        };

        resetTimer();
        const interval = setInterval(() => {
            if (Date.now() - store.lastInteraction > INACTIVITY_TIMEOUT) {
                store.resetKiosk();
                setSelectedCategory(null);
            }
        }, 5000);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            clearInterval(interval);
        };
    }, [store.lastInteraction, store.resetKiosk]);

    // Fetch data on mount
    useEffect(() => {
        fetchData();
    }, []);

    // Helper: sort products so available (in_stock) come first
    const sortByAvailability = (prods: Product[]) => {
        return [...prods].sort((a, b) => {
            if (a.in_stock && !b.in_stock) return -1;
            if (!a.in_stock && b.in_stock) return 1;
            return 0;
        });
    };

    // Helper: fetch products for multiple categories and merge (avoids pagination issues)
    const fetchProductsByCategories = async (categoryIds: number[], cats: Category[]): Promise<Product[]> => {
        if (categoryIds.length === 0) {
            // No filter — fetch page 1 with max page_size
            const data = await getProducts({ page: 1, page_size: 50 } as any);
            return data.results || [];
        }
        // Fetch each configured category separately to get all products
        const fetches = categoryIds.map(async (catId) => {
            try {
                const data = await getProducts({ page: 1, category: catId, page_size: 50 } as any);
                return data.results || [];
            } catch { return []; }
        });
        const results = await Promise.all(fetches);
        // Merge and deduplicate by id_producto
        const seen = new Set<number>();
        const merged: Product[] = [];
        for (const list of results) {
            for (const p of list) {
                if (!seen.has(p.id_producto)) {
                    seen.add(p.id_producto);
                    merged.push(p);
                }
            }
        }
        return merged;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [cats, methods] = await Promise.all([
                getCategories(),
                getPaymentMethods(),
            ]);
            const allCats = cats || [];
            setAllCategories(allCats);
            // For kiosk: only show Efectivo, Transferencia + always add Mixto
            const KIOSK_TYPES = ['EFECTIVO', 'TRANSFERENCIA'];
            const apiMethods = (methods || []).filter((m: any) => KIOSK_TYPES.includes(m.tipo));
            // Always add Mixto option
            const mixtoExists = apiMethods.some((m: any) => m.tipo === 'MIXTO');
            const kioskMethods = [
                ...(apiMethods.length > 0 ? apiMethods : [
                    { id_metodo_pago: -1, nombre_metodo: 'Efectivo', tipo: 'EFECTIVO' },
                    { id_metodo_pago: -2, nombre_metodo: 'Transferencia', tipo: 'TRANSFERENCIA' },
                ]),
                ...(!mixtoExists ? [{ id_metodo_pago: -3, nombre_metodo: 'Mixto (Efectivo + Transf.)', tipo: 'MIXTO' }] : []),
            ];
            setPaymentMethods(kioskMethods as any);

            // Fetch products for configured kiosk categories
            const allProds = await fetchProductsByCategories(kioskCategoryIds, allCats);
            setProducts(sortByAvailability(allProds));

            // Build Dynamic Extras List
            if (kioskExtraCategoryIds && kioskExtraCategoryIds.length > 0) {
                const extraProds = await fetchProductsByCategories(kioskExtraCategoryIds, allCats);
                const extras = extraProds
                    .filter((p: any) => p.in_stock)
                    .map((p: any) => ({
                        id: p.id_producto,
                        name: p.nombre_producto,
                        price: parseFloat(p.price || p.precio_venta || '0')
                    }));
                extras.sort((a: any, b: any) => a.name.localeCompare(b.name));
                setDynamicExtras(extras);
            } else {
                setDynamicExtras([]);
            }
        } catch (e) {
            console.error('Error loading kiosk data:', e);
        } finally {
            setLoading(false);
        }
    };

    // Fetch products when category changes
    useEffect(() => {
        const fetchByCategory = async () => {
            try {
                if (!selectedCategory && kioskCategoryIds.length > 0) {
                    // 'Todo' selected with kiosk filter → fetch each configured category
                    const allProds = await fetchProductsByCategories(kioskCategoryIds, allCategories);
                    setProducts(sortByAvailability(allProds));
                } else {
                    // Specific category selected OR no kiosk filter configured
                    const params: any = { page: 1, page_size: 50 };
                    if (selectedCategory) params.category = selectedCategory;
                    const data = await getProducts(params as any);
                    setProducts(sortByAvailability(data.results || []));
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchByCategory();
    }, [selectedCategory]);

    // ─── Handlers ────────────────────────────
    const handleAddToCart = () => {
        if (!store.builderProduct) return;
        
        // Calculate total including extras if needed
        const extrasTotal = selectedExtras.reduce((acc, curr) => acc + curr.price, 0);
        const basePrice = parseFloat(store.builderProduct.price || store.builderProduct.precio_venta || '0');
        
        // Prepare description from extras + notes
        const extrasNames = selectedExtras.map(e => e.name).join(', ');
        let description = extrasNames;
        if (builderNotes.trim()) {
            description = description ? `${description}. Nota: ${builderNotes.trim()}` : builderNotes.trim();
        }

        const extrasIds = selectedExtras.map(e => e.id);

        // Add to global cart instead of kiosk store
        addItemToGlobalCart(
            { 
                ...store.builderProduct, 
                price: (basePrice + (extrasTotal / builderQty)).toString() // Spread extras cost across units or just add it
            }, 
            builderQty, 
            extrasIds, 
            description
        );

        store.closeBuilder();
        setBuilderQty(1);
        setBuilderNotes('');
        setSelectedExtras([]);
        
        // Navigate to the cart as requested
        router.push('/cart');
    };

    const toggleExtra = (extra: any) => {
        store.touchInteraction();
        if (selectedExtras.find(e => e.id === extra.id)) {
            setSelectedExtras(selectedExtras.filter(e => e.id !== extra.id));
        } else {
            setSelectedExtras([...selectedExtras, extra]);
        }
    };

    // Kiosk Identity is just a local name for the order
    const handleIdentifyGuest = () => {
        if (identityQuery.trim().length < 2) {
            setIdentityError('Ingresá al menos 2 caracteres.');
            return;
        }
        setIdentityError('');
        store.setSelectedClient({
            id: 0,
            name: identityQuery.trim(),
            phone: ''
        } as any);
        store.setCheckoutStep('payment');
    };

    const handleConfirmOrder = async () => {
        if (!store.selectedPaymentMethodId) return;

        store.setOrderProcessing(true);
        try {
            // Resolve payment method type string from selected ID
            const selectedMethod = paymentMethods.find(
                (m: any) => m.id_metodo_pago === store.selectedPaymentMethodId || m.id === store.selectedPaymentMethodId
            ) as any;
            const paymentType = selectedMethod?.tipo || selectedMethod?.id || 'EFECTIVO';

            const payload: any = {
                source: store.kioskId ? 'table' : 'kiosk',
                tipo_entrega: store.kioskId ? 'MESA' : 'LOCAL',
                kiosk_id: store.kioskId || 'local-kiosco',
                payment_method: paymentType,
                items: store.cart.map((item) => ({
                    product_id: item.product.id_producto,
                    quantity: item.quantity,
                    notes: item.notes || undefined,
                })),
            };
            if (store.selectedClient && store.selectedClient.id) {
                payload.cliente_id = store.selectedClient.id;
            }
            if (store.selectedClient && store.selectedClient.name) {
                payload.client_name = store.selectedClient.name;
            }
            if (store.selectedClient && store.selectedClient.phone) {
                payload.client_phone = store.selectedClient.phone;
            }
            // For anonymous kiosk orders, provide a fallback name
            if (!payload.client_name && !payload.cliente_id) {
                payload.client_name = 'Cliente Kiosco';
                payload.client_phone = '0000000000';
            }

            const result = await createOrder(payload);

            store.closeCheckout();

            const name = store.selectedClient ? store.selectedClient.name.split(' ')[0] : '';
            Alert.alert(
                name ? `¡Gracias ${name}!` : '¡Pedido enviado!',
                `${result.message}\n\nTotal: ${formatPrice(result.order.total)}`,
                [{ text: 'Nuevo Pedido', onPress: () => store.resetKiosk() }]
            );
        } catch (e: any) {
            const errorMsg = e?.response?.data?.error
                || e?.response?.data?.items?.join('\n')
                || e?.response?.data?.detail
                || 'No se pudo enviar el pedido.';
            Alert.alert('Error', errorMsg);
            console.error('Kiosk order error:', JSON.stringify(e?.response?.data));
        } finally {
            store.setOrderProcessing(false);
        }
    };

    const handlePinSubmit = () => {
        const requiredPin = pinAction === 'config' ? CONFIG_PIN : ADMIN_PIN;
        if (pinInput === requiredPin) {
            setPinModalVisible(false);
            setPinInput('');
            if (pinAction === 'config') {
                setTempCategoryIds([...kioskCategoryIds]);
                setTempExtraCategoryIds([...(kioskExtraCategoryIds || [])]);
                setConfigModalVisible(true);
            } else {
                store.resetKiosk();
                router.back();
            }
        } else {
            Alert.alert('PIN incorrecto', 'El PIN ingresado no es válido.');
            setPinInput('');
        }
    };

    const openPinModal = (action: 'exit' | 'config') => {
        setPinAction(action);
        setPinInput('');
        setPinModalVisible(true);
    };

    const handleSaveConfig = () => {
        setKioskCategoryIds(tempCategoryIds);
        setKioskExtraCategoryIds(tempExtraCategoryIds);
        setConfigModalVisible(false);
        // Reload products with new filter
        fetchData();
    };

    const toggleCategoryId = (id: number) => {
        setTempCategoryIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const toggleExtraCategoryId = (id: number) => {
        setTempExtraCategoryIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const renderProduct = ({ item }: { item: Product }) => {
        const price = parseFloat(item.price || '0');
        const hasNumericStock = item.stock !== undefined && item.stock !== null;
        const stockNum = hasNumericStock ? parseFloat(item.stock) : 0;
        const stockColor = item.stock_level === 'out_of_stock' ? '#F44336' : item.stock_level === 'low' ? '#FF9800' : '#4CAF50';
        const stockLabel = !item.in_stock
            ? 'Agotado'
            : hasNumericStock && stockNum > 0
                ? `${stockNum % 1 === 0 ? stockNum.toFixed(0) : stockNum.toFixed(1)} ${item.unit || 'u'}`
                : item.stock_level === 'low' ? 'Últimas unidades' : 'Disponible';
        return (
            <Pressable
                style={[s.productCard, { width: `${(100 / numColumns) - 3}%` as any }, !item.in_stock && s.productOutOfStock]}
                onPress={() => {
                    if (!item.in_stock) return;
                    store.touchInteraction();
                    store.openBuilder(item);
                    setBuilderQty(1);
                    setBuilderNotes('');
                }}
            >
                <View style={s.productImgPlaceholder}>
                    <Text style={s.productEmoji}>🍔</Text>
                    <View style={s.productUnitBadge}>
                        <Text style={s.productUnitText}>{item.unit || 'Unid'}</Text>
                    </View>
                    <View style={[s.productStockBadge, { backgroundColor: stockColor }]}>
                        <Text style={s.productStockText}>{stockLabel}</Text>
                    </View>
                </View>
                <View style={s.productInfo}>
                    <Text style={s.productName} numberOfLines={2}>{item.nombre_producto}</Text>
                    <Text style={[s.productPrice, !item.in_stock && { color: '#666' }]}>{formatPrice(price)}</Text>
                </View>
                {item.in_stock && (
                    <View style={s.addBtnSmall}>
                        <Text style={s.addBtnSmallText}>+</Text>
                    </View>
                )}
            </Pressable>
        );
    };

    // ─── Main Render ─────────────────────────
    if (loading) {
        return (
            <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color="#FF9100" />
                <Text style={s.loadingText}>Cargando menú...</Text>
            </View>
        );
    }

    return (
        <View
            style={s.container}
            onTouchStart={() => store.touchInteraction()}
        >
            <StatusBar hidden />

            {/* ─── Header ─────────────────── */}
            <View style={s.header}>
                <Pressable
                    style={s.logoBtn}
                    onLongPress={() => {
                        store.touchInteraction();
                        store.resetKiosk();
                        router.back();
                    }}
                    delayLongPress={2000}
                >
                    <Text style={s.logoEmoji}>🍔</Text>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable
                        style={s.configBtn}
                        onPress={() => {
                            store.touchInteraction();
                            openPinModal('config');
                        }}
                    >
                        <Text style={s.configBtnText}>⚙️</Text>
                    </Pressable>
                    <Pressable
                        style={s.closeBtn}
                        onPress={() => {
                            store.touchInteraction();
                            store.resetKiosk();
                            router.back();
                        }}
                    >
                        <Text style={s.closeBtnText}>✕</Text>
                    </Pressable>
                </View>
            </View>

            {/* ─── Hero ───────────────────── */}
            <View style={s.hero}>
                <Text style={s.heroLine1}>¿Qué vas a</Text>
                <Text style={s.heroLine2}>pedir hoy?</Text>
            </View>

            {/* ─── Categories ─────────────── */}
            <View style={s.categoriesContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoriesScroll}>
                    <Pressable
                        style={[s.categoryChip, !selectedCategory && s.categoryChipActive]}
                        onPress={() => { store.touchInteraction(); setSelectedCategory(null); }}
                    >
                        <Text style={[s.categoryText, !selectedCategory && s.categoryTextActive]}>Todo</Text>
                    </Pressable>
                    {filteredCategories.map((cat) => (
                        <Pressable
                            key={cat.id_categoria}
                            style={[s.categoryChip, selectedCategory === cat.id_categoria && s.categoryChipActive]}
                            onPress={() => { store.touchInteraction(); setSelectedCategory(cat.id_categoria); }}
                        >
                            <Text style={[s.categoryText, selectedCategory === cat.id_categoria && s.categoryTextActive]}>
                                {cat.nombre_categoria}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            {/* ─── Products Grid ──────────── */}
            <FlatList
                key={`grid-${numColumns}`}
                data={products}
                numColumns={numColumns}
                keyExtractor={(item) => item.id_producto.toString()}
                contentContainerStyle={s.gridContent}
                columnWrapperStyle={s.gridRow}
                renderItem={renderProduct}
                onScrollBeginDrag={() => store.touchInteraction()}
                ListEmptyComponent={
                    <View style={s.emptyContainer}>
                        <Text style={s.emptyEmoji}>🍽️</Text>
                        <Text style={s.emptyText}>No hay productos disponibles</Text>
                    </View>
                }
            />

            {/* ─── Floating Cart Bar ─────── */}
            {store.cart.length > 0 && (
                <View style={s.cartBar}>
                    <View style={s.cartBarLeft}>
                        <View style={s.cartBadge}>
                            <Text style={s.cartBadgeText}>{store.getCartCount()}</Text>
                        </View>
                        <View>
                            <Text style={s.cartBarTitle}>Tu Pedido</Text>
                            <Text style={s.cartBarTotal}>{formatPrice(store.getCartTotal())}</Text>
                        </View>
                    </View>
                    <Pressable
                        style={s.payBtn}
                        onPress={() => { store.touchInteraction(); handleStartCheckout(); }}
                    >
                        <Text style={s.payBtnText}>Pagar Ahora</Text>
                    </Pressable>
                </View>
            )}

            {/* ─── Builder Modal ──────────── */}
            <Modal visible={store.builderVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={s.modalDark}>
                    {store.builderProduct && (
                        <>
                            <View style={s.builderHeader}>
                                <Text style={s.builderEmoji}>🍔</Text>
                                <Pressable style={s.modalCloseBtn} onPress={() => store.closeBuilder()}>
                                    <Text style={s.modalCloseBtnText}>✕</Text>
                                </Pressable>
                            </View>

                            <ScrollView style={s.builderBody}>
                                <Text style={s.builderName}>{store.builderProduct.nombre_producto}</Text>
                                <Text style={s.builderPrice}>
                                    {formatPrice(store.builderProduct.price || store.builderProduct.precio_venta)}
                                </Text>

                                {/* Notes */}
                                <Text style={s.sectionLabel}>Notas / Personalización</Text>
                                <TextInput
                                    style={s.notesInput}
                                    placeholder="Ej: Sin cebolla, extra salsa..."
                                    placeholderTextColor="#555"
                                    value={builderNotes}
                                    onChangeText={(t) => { store.touchInteraction(); setBuilderNotes(t); }}
                                    multiline
                                />

                                {/* Quantity */}
                                <View style={s.qtyRow}>
                                    <Text style={s.qtyLabel}>Cantidad</Text>
                                    <View style={s.qtyControls}>
                                        <Pressable
                                            style={s.qtyBtn}
                                            onPress={() => { store.touchInteraction(); setBuilderQty(Math.max(1, builderQty - 1)); }}
                                        >
                                            <Text style={s.qtyBtnText}>−</Text>
                                        </Pressable>
                                        <Text style={s.qtyValue}>{builderQty}</Text>
                                        <Pressable
                                            style={s.qtyBtn}
                                            onPress={() => { store.touchInteraction(); setBuilderQty(builderQty + 1); }}
                                        >
                                            <Text style={s.qtyBtnText}>+</Text>
                                        </Pressable>
                                    </View>
                                </View>

                                {/* EXTRAS */}
                                {dynamicExtras.length > 0 && (
                                    <>
                                        <Text style={s.sectionLabel}>Aderezos y Extras</Text>
                                        <View style={s.extrasGrid}>
                                            {dynamicExtras.map(extra => {
                                                const isSelected = !!selectedExtras.find(e => e.id === extra.id);
                                                return (
                                                    <Pressable
                                                        key={extra.id}
                                                        style={[s.extraBtn, isSelected && s.extraBtnActive]}
                                                        onPress={() => toggleExtra(extra)}
                                                    >
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={[s.extraName, isSelected && s.extraTextActive]}>{extra.name}</Text>
                                                            {extra.price > 0 && (
                                                                <Text style={[s.extraPrice, isSelected && s.extraTextActive]}>+ {formatPrice(extra.price)}</Text>
                                                            )}
                                                        </View>
                                                        {isSelected && <Text style={s.checkIconSmall}>✓</Text>}
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    </>
                                )}
                            </ScrollView>

                            {/* Add Button */}
                            <View style={s.builderFooter}>
                                <Pressable style={s.addCartBtn} onPress={handleAddToCart}>
                                    <Text style={s.addCartBtnText}>
                                        Agregar al Carrito • {formatPrice(
                                            ((parseFloat(store.builderProduct.price || store.builderProduct.precio_venta || '0')) * builderQty) + selectedExtras.reduce((acc, curr) => acc + curr.price, 0)
                                        )}
                                    </Text>
                                </Pressable>
                            </View>
                        </>
                    )}
                </View>
            </Modal>

            {/* ─── Checkout Modal ─────────── */}
            <Modal
                visible={store.checkoutVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => store.closeCheckout()}
            >
                <View style={s.modalDark}>
                    {/* Checkout Header */}
                    <View style={s.checkoutHeader}>
                        <Text style={s.checkoutTitle}>
                            {store.checkoutStep === 'payment' ? '💳 Pago' : '👤 Identificación'}
                        </Text>
                        <Pressable style={s.modalCloseBtn} onPress={() => store.closeCheckout()}>
                            <Text style={s.modalCloseBtnText}>✕</Text>
                        </Pressable>
                    </View>

                    {/* Step 1: Identify */}
                    {store.checkoutStep === 'identify' && (
                        <View style={s.checkoutCenter}>
                            <Text style={s.identifyHint}>Tu nombre para llamarte cuando el pedido esté listo:</Text>
                            <TextInput
                                style={s.identifyInput}
                                placeholder="Ej: Juan"
                                placeholderTextColor="#555"
                                value={identityQuery}
                                onChangeText={(t) => { store.touchInteraction(); setIdentityQuery(t); }}
                                autoFocus
                            />
                            {identityError ? <Text style={s.errorText}>{identityError}</Text> : null}
                            <Pressable
                                style={s.continueBtn}
                                onPress={handleIdentifyGuest}
                            >
                                <Text style={s.continueBtnText}>Continuar</Text>
                            </Pressable>
                            <Pressable
                                style={s.skipIdentifyBtn}
                                onPress={() => {
                                    store.touchInteraction();
                                    store.setSelectedClient(null);
                                    store.setCheckoutStep('payment');
                                }}
                            >
                                <Text style={s.skipIdentifyText}>Pedir sin identificarse →</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* Step 3: Payment */}
                    {store.checkoutStep === 'payment' && (
                        <ScrollView style={s.paymentScroll}>
                            {/* Client Info (if identified) */}
                            {store.selectedClient && (
                                <View style={s.clientCard}>
                                    <Text style={s.clientIcon}>👤</Text>
                                    <View>
                                        <Text style={s.clientName}>{store.selectedClient.name}</Text>
                                        <Text style={s.clientPhone}>{store.selectedClient.phone}</Text>
                                    </View>
                                </View>
                            )}
                            {!store.selectedClient && (
                                <View style={s.clientCard}>
                                    <Text style={s.clientIcon}>👤</Text>
                                    <View>
                                        <Text style={s.clientName}>Pedido anónimo</Text>
                                        <Text style={s.clientPhone}>Sin identificación</Text>
                                    </View>
                                </View>
                            )}

                            <Text style={s.paymentTitle}>Seleccioná cómo pagar</Text>

                            {paymentMethods.map((method: any) => {
                                const id = method.id_metodo_pago;
                                const name = method.nombre_metodo;
                                const isActive = store.selectedPaymentMethodId === id;
                                return (
                                    <Pressable
                                        key={id}
                                        style={[s.paymentOption, isActive && s.paymentOptionActive]}
                                        onPress={() => {
                                            store.touchInteraction();
                                            store.setSelectedPaymentMethodId(id);
                                        }}
                                    >
                                        <Text style={[s.paymentOptionText, isActive && s.paymentOptionTextActive]}>
                                            {name}
                                        </Text>
                                        {isActive && <Text style={s.checkIcon}>✓</Text>}
                                    </Pressable>
                                );
                            })}

                            {/* Total + Confirm */}
                            <View style={s.totalSection}>
                                <View style={s.totalRow}>
                                    <Text style={s.totalLabel}>Total a Pagar</Text>
                                    <Text style={s.totalValue}>{formatPrice(store.getCartTotal())}</Text>
                                </View>
                                <Pressable
                                    style={[
                                        s.confirmBtn,
                                        !store.selectedPaymentMethodId && s.confirmBtnDisabled,
                                    ]}
                                    onPress={handleConfirmOrder}
                                    disabled={store.orderProcessing || !store.selectedPaymentMethodId}
                                >
                                    {store.orderProcessing ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={s.confirmBtnText}>CONFIRMAR PEDIDO</Text>
                                    )}
                                </Pressable>
                            </View>
                        </ScrollView>
                    )}
                </View>
            </Modal>

            {/* ─── Admin PIN Modal (Only for Config now) ────────── */}
            <Modal visible={pinModalVisible} transparent animationType="fade">
                <View style={s.pinOverlay}>
                    <View style={s.pinCard}>
                        <Text style={s.pinTitle}>⚙️ Configuración</Text>
                        <Text style={s.pinSubtitle}>Ingresá el PIN de configuración</Text>
                        <TextInput
                            style={s.pinInput}
                            placeholder="PIN"
                            placeholderTextColor="#999"
                            value={pinInput}
                            onChangeText={setPinInput}
                            secureTextEntry
                            keyboardType="number-pad"
                            maxLength={6}
                            autoFocus
                        />
                        <View style={s.pinActions}>
                            <Pressable
                                style={s.pinCancelBtn}
                                onPress={() => { setPinModalVisible(false); setPinInput(''); }}
                            >
                                <Text style={s.pinCancelText}>Cancelar</Text>
                            </Pressable>
                            <Pressable style={s.pinConfirmBtn} onPress={handlePinSubmit}>
                                <Text style={s.pinConfirmText}>Entrar</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ─── Config Modal ────────────── */}
            <Modal visible={configModalVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={s.modalDark}>
                    <View style={s.checkoutHeader}>
                        <Text style={s.checkoutTitle}>⚙️ Categorías del Kiosco</Text>
                        <Pressable style={s.modalCloseBtn} onPress={() => setConfigModalVisible(false)}>
                            <Text style={s.modalCloseBtnText}>✕</Text>
                        </Pressable>
                    </View>
                    <Text style={s.configHint}>Seleccioná qué categorías se usan como Menú Principal (si no elegís ninguna, se muestran todas).</Text>
                    <ScrollView style={[s.paymentScroll, { maxHeight: '35%' }]} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                        {allCategories.map((cat) => {
                            const isSelected = tempCategoryIds.includes(cat.id_categoria);
                            return (
                                <Pressable
                                    key={`main-${cat.id_categoria}`}
                                    style={[s.paymentOption, isSelected && s.paymentOptionActive]}
                                    onPress={() => toggleCategoryId(cat.id_categoria)}
                                >
                                    <Text style={[s.paymentOptionText, isSelected && s.paymentOptionTextActive]}>
                                        {cat.nombre_categoria}
                                    </Text>
                                    {isSelected && <Text style={s.checkIcon}>✓</Text>}
                                </Pressable>
                            );
                        })}
                    </ScrollView>

                    <Text style={[s.configHint, { marginTop: 24, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 20 }]}>Seleccioná qué categorías actúan como Extras/Aderezos dentro de cada producto.</Text>
                    <ScrollView style={[s.paymentScroll, { maxHeight: '35%' }]} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                        {allCategories.map((cat) => {
                            const isSelected = tempExtraCategoryIds.includes(cat.id_categoria);
                            return (
                                <Pressable
                                    key={`opt-${cat.id_categoria}`}
                                    style={[s.paymentOption, isSelected && s.paymentOptionActive]}
                                    onPress={() => toggleExtraCategoryId(cat.id_categoria)}
                                >
                                    <Text style={[s.paymentOptionText, isSelected && s.paymentOptionTextActive]}>
                                        {cat.nombre_categoria}
                                    </Text>
                                    {isSelected && <Text style={s.checkIcon}>✓</Text>}
                                </Pressable>
                            );
                        })}
                    </ScrollView>

                    <View style={s.builderFooter}>
                        <Pressable style={s.addCartBtn} onPress={handleSaveConfig}>
                            <Text style={s.addCartBtnText}>
                                Guardar Configuración
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ─── Styles ──────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    loadingContainer: { flex: 1, backgroundColor: '#121212', alignItems: 'center', justifyContent: 'center', gap: 16 },
    loadingText: { color: '#888', fontSize: 16 },

    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 },
    logoBtn: { padding: 4 },
    logoEmoji: { fontSize: 32 },
    closeBtn: { backgroundColor: '#222', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    closeBtnText: { color: '#666', fontSize: 18 },
    configBtn: { backgroundColor: '#222', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    configBtnText: { color: '#666', fontSize: 18 },

    // Hero
    hero: { paddingHorizontal: 24, marginBottom: 20 },
    heroLine1: { fontSize: 34, fontWeight: '800', color: '#fff' },
    heroLine2: { fontSize: 34, fontWeight: '800', color: '#FF9100' },

    // Categories
    categoriesContainer: { marginBottom: 16 },
    categoriesScroll: { paddingHorizontal: 24, gap: 10 },
    categoryChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#333' },
    categoryChipActive: { backgroundColor: '#FF9100', borderColor: '#FF9100' },
    categoryText: { color: '#888', fontWeight: '700', fontSize: 14 },
    categoryTextActive: { color: '#fff' },

    // Grid
    gridContent: { paddingHorizontal: 12, paddingBottom: 140 },
    gridRow: { justifyContent: 'flex-start', gap: 10, marginBottom: 10 },

    // Product Card
    productCard: { backgroundColor: '#1E1E1E', borderRadius: 20, overflow: 'hidden', position: 'relative' },
    productImgPlaceholder: { height: 110, backgroundColor: '#282828', alignItems: 'center', justifyContent: 'center', position: 'relative' },
    productEmoji: { fontSize: 48, opacity: 0.4 },
    productUnitBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    productUnitText: { fontSize: 10, fontWeight: '700', color: '#000' },
    productStockBadge: { position: 'absolute', bottom: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    productStockText: { fontSize: 10, fontWeight: '700', color: '#fff' },
    productOutOfStock: { opacity: 0.5 },
    productInfo: { padding: 12 },
    productName: { color: '#fff', fontWeight: '700', fontSize: 14, lineHeight: 18, marginBottom: 6 },
    productPrice: { color: '#FF9100', fontWeight: '800', fontSize: 18 },
    addBtnSmall: { position: 'absolute', bottom: 12, right: 12, backgroundColor: '#FF9100', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    addBtnSmallText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 22 },

    // Empty
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyEmoji: { fontSize: 64, marginBottom: 12 },
    emptyText: { color: '#666', fontSize: 16 },

    // Cart Bar
    cartBar: { position: 'absolute', bottom: 50, left: 20, right: 20, backgroundColor: '#fff', borderRadius: 24, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.25, shadowRadius: 12 },
    cartBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cartBadge: { backgroundColor: '#121212', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    cartBadgeText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    cartBarTitle: { color: '#000', fontWeight: '700', fontSize: 16 },
    cartBarTotal: { color: '#666', fontWeight: '700', fontSize: 18 },
    payBtn: { backgroundColor: '#FF9100', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
    payBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

    // Modal Dark
    modalDark: { flex: 1, backgroundColor: '#121212' },

    // Builder
    builderHeader: { height: 220, backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center', position: 'relative' },
    builderEmoji: { fontSize: 100, opacity: 0.3 },
    modalCloseBtn: { position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    modalCloseBtnText: { color: '#fff', fontSize: 18 },
    builderBody: { flex: 1, padding: 24 },
    builderName: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 8 },
    builderPrice: { fontSize: 24, fontWeight: '800', color: '#FF9100', marginBottom: 24 },
    sectionLabel: { color: '#888', fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, marginTop: 24 },
    notesInput: { backgroundColor: '#1E1E1E', color: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#333', fontSize: 16, minHeight: 80, textAlignVertical: 'top', marginBottom: 24 },

    // Quantity
    qtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E1E1E', padding: 16, borderRadius: 16, marginBottom: 40 },
    qtyLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
    qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    qtyBtn: { backgroundColor: '#333', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    qtyBtnText: { color: '#fff', fontSize: 22, fontWeight: '700' },
    qtyValue: { color: '#fff', fontSize: 20, fontWeight: '800', minWidth: 30, textAlign: 'center' },

    // Builder Footer
    builderFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#222' },
    addCartBtn: { backgroundColor: '#FF9100', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
    addCartBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },

    // Extras
    extrasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 20 },
    extraBtn: { width: '48%', backgroundColor: '#222', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#333', flexDirection: 'row', alignItems: 'center' },
    extraBtnActive: { backgroundColor: 'rgba(255,145,0,0.2)', borderColor: '#FF9100' },
    extraName: { color: '#fff', fontSize: 13, fontWeight: '600' },
    extraPrice: { color: '#888', fontSize: 11, marginTop: 2 },
    extraTextActive: { color: '#FF9100' },
    checkIconSmall: { color: '#FF9100', fontSize: 16, fontWeight: 'bold' },

    // Checkout
    checkoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 20 },
    checkoutTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
    checkoutCenter: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },

    // Identify
    identifyHint: { color: '#888', fontSize: 16, textAlign: 'center', marginBottom: 16 },
    identifyInput: { backgroundColor: '#1E1E1E', color: '#fff', fontWeight: '700', fontSize: 22, padding: 20, borderRadius: 18, textAlign: 'center', borderWidth: 1, borderColor: '#333', marginBottom: 12 },
    errorText: { color: '#FF5252', textAlign: 'center', marginBottom: 12, fontSize: 14 },
    continueBtn: { backgroundColor: '#FF9100', paddingVertical: 18, borderRadius: 18, alignItems: 'center', marginTop: 8 },
    continueBtnText: { color: '#fff', fontWeight: '800', fontSize: 18 },

    // Register
    registerIcon: { fontSize: 56, textAlign: 'center', marginBottom: 12 },
    registerTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
    registerSubtitle: { color: '#888', textAlign: 'center', marginBottom: 24, fontSize: 14 },
    regInput: { backgroundColor: '#1E1E1E', color: '#fff', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#333', fontSize: 16, marginBottom: 12 },
    backLink: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
    backLinkText: { color: '#666', fontSize: 14 },

    // Payment
    paymentScroll: { flex: 1, paddingHorizontal: 24 },
    clientCard: { backgroundColor: '#1E1E1E', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
    clientIcon: { fontSize: 28 },
    clientName: { color: '#fff', fontWeight: '700', fontSize: 18 },
    clientPhone: { color: '#888', fontSize: 14 },
    paymentTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 16 },
    paymentOption: { padding: 20, marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: '#333', backgroundColor: '#1E1E1E', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    paymentOptionActive: { backgroundColor: '#FF9100', borderColor: '#FF9100' },
    paymentOptionText: { color: '#ccc', fontSize: 18, fontWeight: '700' },
    paymentOptionTextActive: { color: '#fff' },
    checkIcon: { color: '#fff', fontSize: 20, fontWeight: '800' },

    // Total + Confirm
    totalSection: { paddingTop: 20, borderTopWidth: 1, borderTopColor: '#222', marginTop: 16, paddingBottom: 40 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    totalLabel: { color: '#888', fontSize: 16 },
    totalValue: { color: '#fff', fontWeight: '800', fontSize: 28 },
    confirmBtn: { backgroundColor: '#2E7D32', paddingVertical: 20, borderRadius: 18, alignItems: 'center' },
    confirmBtnDisabled: { backgroundColor: '#333' },
    confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 18, letterSpacing: 1 },

    // PIN Modal
    pinOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
    pinCard: { backgroundColor: '#1E1E1E', borderRadius: 24, padding: 32, width: 320, alignItems: 'center' },
    pinTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
    pinSubtitle: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 20 },
    pinInput: { backgroundColor: '#282828', color: '#fff', fontSize: 24, fontWeight: '800', padding: 16, borderRadius: 14, width: '100%', textAlign: 'center', borderWidth: 1, borderColor: '#444', marginBottom: 20 },
    pinActions: { flexDirection: 'row', gap: 12, width: '100%' },
    pinCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#333' },
    pinCancelText: { color: '#ccc', fontWeight: '700', fontSize: 16 },
    pinConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#D32F2F' },
    pinConfirmText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    // Config
    configLink: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
    configLinkText: { color: '#FF9100', fontSize: 14, fontWeight: '600' },
    configHint: { color: '#888', fontSize: 14, paddingHorizontal: 24, marginBottom: 16 },
    skipIdentifyBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
    skipIdentifyText: { color: '#FF9100', fontSize: 15, fontWeight: '600' },
});
