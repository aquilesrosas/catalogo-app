import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet, View, Text, Platform, KeyboardAvoidingView,
    Alert, TextInput, Pressable, FlatList, ActivityIndicator, Linking, TouchableOpacity
} from 'react-native';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';
import { useCatalogStore } from '@/stores/catalogStore';
import { useCartStore } from '@/stores/cartStore';

interface CartSuggestion {
    id: number;
    nombre: string;
    qty: number;
    precio: number;
}

interface SimpleMessage {
    _id: string;
    text: string;
    createdAt: Date;
    user: { _id: number; name: string };
    cart_items?: CartSuggestion[];
}

interface StoreInfo {
    name: string;
    address: string;
    whatsapp: string;
}

function CartSuggestionCard({ items }: { items: CartSuggestion[] }) {
    const router = useRouter();
    const { products } = useCatalogStore();
    const { addItem } = useCartStore();

    const total = items.reduce((sum, ci) => sum + ci.precio * ci.qty, 0);

    const handleAddAll = () => {
        let added = 0;
        for (const ci of items) {
            const product = products.find(p => p.id_producto === ci.id);
            if (product) {
                addItem(product, ci.qty);
                added++;
            }
        }
        if (added > 0) {
            router.push('/cart');
        } else {
            Alert.alert('No se pudo agregar', 'No encontré los productos en el catálogo cargado. Volvé al inicio primero.');
        }
    };

    return (
        <View style={cardStyles.container}>
            <Text style={cardStyles.title}>Carrito sugerido</Text>
            {items.map((ci, idx) => (
                <View key={idx} style={cardStyles.row}>
                    <Text style={cardStyles.qty}>{ci.qty}×</Text>
                    <Text style={cardStyles.name} numberOfLines={1}>{ci.nombre}</Text>
                    <Text style={cardStyles.price}>${(ci.precio * ci.qty).toLocaleString('es-AR')}</Text>
                </View>
            ))}
            <View style={cardStyles.totalRow}>
                <Text style={cardStyles.totalLabel}>Total</Text>
                <Text style={cardStyles.totalAmount}>${total.toLocaleString('es-AR')}</Text>
            </View>
            <TouchableOpacity style={cardStyles.button} onPress={handleAddAll}>
                <Ionicons name="cart" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={cardStyles.buttonText}>Agregar al carrito</Text>
            </TouchableOpacity>
        </View>
    );
}

export default function CatalogChatScreen() {
    const [messages, setMessages] = useState<SimpleMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);

    const { isLoggedIn, clientPhone, clientName } = useAuthStore();
    const insets = useSafeAreaInsets();
    const listRef = useRef<FlatList>(null);

    useEffect(() => {
        setMessages([
            {
                _id: '1',
                text: isLoggedIn()
                    ? `¡Hola ${clientName}! Soy tu Asesor Virtual. Puedo contarte sobre los productos, precios, stock y armar tu pedido. ¿En qué te ayudo?`
                    : '¡Hola! Soy el Asesor Virtual. Puedo ayudarte con productos, precios y hacer tu pedido. Para finalizar la compra vas a necesitar iniciar sesión.',
                createdAt: new Date(),
                user: { _id: 2, name: 'Asesor Virtual' },
            },
        ]);
    }, [isLoggedIn, clientName]);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        const userText = inputText.trim();
        setInputText('');

        const userMessage: SimpleMessage = {
            _id: Math.random().toString(),
            text: userText,
            createdAt: new Date(),
            user: { _id: 1, name: clientName || 'Yo' },
        };

        setMessages(prev => [userMessage, ...prev]);
        setIsTyping(true);

        try {
            const phoneToSend = isLoggedIn() ? clientPhone : 'invitado';
            const response = await api.post('chat/', {
                phone: phoneToSend,
                message: userText,
            });

            const replyText = response.data?.response || 'Lo siento, tuve un problema procesando tu consulta.';
            const cartItems: CartSuggestion[] = response.data?.cart_items || [];

            // Store info from first response
            if (!storeInfo && response.data?.store_info) {
                setStoreInfo(response.data.store_info);
            }

            const aiMessage: SimpleMessage = {
                _id: Math.random().toString(),
                text: replyText,
                createdAt: new Date(),
                user: { _id: 2, name: 'Asesor Virtual' },
                cart_items: cartItems.length > 0 ? cartItems : undefined,
            };

            setMessages(prev => [aiMessage, ...prev]);
        } catch (error: any) {
            console.error('AI Chat Error:', error);
            const errorMessage: SimpleMessage = {
                _id: Math.random().toString(),
                text: 'Ups, hubo un problema de conexión con el Asesor Virtual. Intentá nuevamente.',
                createdAt: new Date(),
                user: { _id: 2, name: 'Asesor Virtual' },
            };
            setMessages(prev => [errorMessage, ...prev]);
            Alert.alert('Error', error?.response?.data?.error || error.message || 'Error conectando con el asesor');
        } finally {
            setIsTyping(false);
        }
    };

    const renderMessage = ({ item }: { item: SimpleMessage }) => {
        const isUser = item.user._id === 1;
        return (
            <View style={[styles.bubbleWrapper, isUser ? styles.bubbleWrapperUser : styles.bubbleWrapperAI]}>
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
                    <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAI]}>
                        {item.text}
                    </Text>
                </View>
                {!isUser && item.cart_items && item.cart_items.length > 0 && (
                    <CartSuggestionCard items={item.cart_items} />
                )}
            </View>
        );
    };

    const StoreInfoBanner = storeInfo && (storeInfo.address || storeInfo.whatsapp) ? (
        <View style={styles.storeBanner}>
            {storeInfo.address ? (
                <View style={styles.storeRow}>
                    <Text style={styles.storeIcon}>📍</Text>
                    <Text style={styles.storeText} numberOfLines={1}>{storeInfo.address}</Text>
                </View>
            ) : null}
            {storeInfo.whatsapp ? (
                <Pressable
                    style={styles.storeRow}
                    onPress={() => Linking.openURL(`https://wa.me/${storeInfo.whatsapp.replace(/\D/g, '')}`)}
                >
                    <Text style={styles.storeIcon}>💬</Text>
                    <Text style={[styles.storeText, styles.storeLink]}>WhatsApp</Text>
                </Pressable>
            ) : null}
        </View>
    ) : null;

    const ChatContent = (
        <>
            {StoreInfoBanner}
            <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={item => item._id}
                renderItem={renderMessage}
                inverted
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />
            {isTyping && (
                <View style={styles.typingContainer}>
                    <ActivityIndicator size="small" color="#1B5E20" />
                    <Text style={styles.typingText}>El asesor está escribiendo...</Text>
                </View>
            )}
            <View style={[styles.inputContainer, { paddingBottom: Platform.OS === 'ios' ? 10 : Math.max(10, insets.bottom) }]}>
                <TextInput
                    style={styles.textInput}
                    placeholder="Escribí un mensaje..."
                    placeholderTextColor="#999"
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                    maxLength={500}
                />
                <Pressable
                    style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                    onPress={handleSend}
                    disabled={!inputText.trim()}
                >
                    <Ionicons name="send" size={20} color="#fff" />
                </Pressable>
            </View>
        </>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: '🤖 Asesor Virtual',
                    headerBackTitle: 'Volver',
                }}
            />
            {Platform.OS === 'ios' ? (
                <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={90}>
                    {ChatContent}
                </KeyboardAvoidingView>
            ) : (
                ChatContent
            )}
        </View>
    );
}

const cardStyles = StyleSheet.create({
    container: {
        marginTop: 8,
        backgroundColor: '#E8F5E9',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#A5D6A7',
        maxWidth: '90%',
    },
    title: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1B5E20',
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 6,
    },
    qty: {
        fontSize: 13,
        color: '#388E3C',
        fontWeight: '600',
        width: 28,
    },
    name: {
        fontSize: 13,
        color: '#333',
        flex: 1,
    },
    price: {
        fontSize: 13,
        color: '#1B5E20',
        fontWeight: '600',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#C8E6C9',
    },
    totalLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1B5E20',
    },
    totalAmount: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1B5E20',
    },
    button: {
        marginTop: 10,
        backgroundColor: '#2E7D32',
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    storeBanner: {
        backgroundColor: '#1B5E20',
        paddingHorizontal: 14,
        paddingVertical: 8,
        flexDirection: 'row',
        gap: 14,
        flexWrap: 'wrap',
    },
    storeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    storeIcon: {
        fontSize: 13,
    },
    storeText: {
        fontSize: 12,
        color: '#C8E6C9',
        fontWeight: '500',
    },
    storeLink: {
        color: '#A5D6A7',
        textDecorationLine: 'underline',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    bubbleWrapper: {
        width: '100%',
        flexDirection: 'column',
        marginBottom: 12,
    },
    bubbleWrapperUser: {
        alignItems: 'flex-end',
    },
    bubbleWrapperAI: {
        alignItems: 'flex-start',
    },
    bubble: {
        maxWidth: '80%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
    },
    bubbleUser: {
        backgroundColor: '#1B5E20',
        borderBottomRightRadius: 4,
    },
    bubbleAI: {
        backgroundColor: '#E0E0E0',
        borderBottomLeftRadius: 4,
    },
    bubbleText: {
        fontSize: 15,
        lineHeight: 22,
    },
    bubbleTextUser: {
        color: '#fff',
    },
    bubbleTextAI: {
        color: '#333',
    },
    typingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    typingText: {
        marginLeft: 8,
        fontSize: 13,
        color: '#666',
        fontStyle: 'italic',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingTop: 8,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#EEE',
    },
    textInput: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        fontSize: 16,
        maxHeight: 120,
        color: '#333',
    },
    sendButton: {
        backgroundColor: '#1B5E20',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
        marginBottom: 2,
    },
    sendButtonDisabled: {
        backgroundColor: '#A5D6A7',
    },
});
