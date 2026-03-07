import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Platform, KeyboardAvoidingView, Alert, TextInput, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { Stack, useNavigation } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

interface SimpleMessage {
    _id: string;
    text: string;
    createdAt: Date;
    user: { _id: number; name: string };
}

export default function CatalogChatScreen() {
    const [messages, setMessages] = useState<SimpleMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const { isLoggedIn, clientPhone, clientName } = useAuthStore();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const listRef = useRef<FlatList>(null);

    useEffect(() => {
        // Initial welcome message
        setMessages([
            {
                _id: '1',
                text: isLoggedIn() ? `¡Hola ${clientName}! Soy tu Asesor Virtual. ¿En qué te puedo ayudar hoy? Podés consultarme sobre productos, ofertas o armar tu pedido acá mismo.` : '¡Hola! Soy tu Asesor Virtual. ¿En qué te puedo ayudar hoy? Si querés hacer un pedido voy a necesitar que inicies sesión.',
                createdAt: new Date(),
                user: { _id: 2, name: 'Asesor Virtual' },
            },
        ]);
    }, [isLoggedIn, clientName]);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        const userText = inputText.trim();
        setInputText(''); // Clear input

        const userMessage: SimpleMessage = {
            _id: Math.random().toString(),
            text: userText,
            createdAt: new Date(),
            user: { _id: 1, name: clientName || 'Yo' }
        };

        setMessages(prev => [userMessage, ...prev]);
        setIsTyping(true);

        try {
            const phoneToSend = isLoggedIn() ? clientPhone : 'invitado';
            const response = await api.post('chat/', {
                phone: phoneToSend,
                message: userText
            });

            const replyText = response.data?.response || "Lo siento, tuve un problema procesando tu consulta.";

            const aiMessage: SimpleMessage = {
                _id: Math.random().toString(),
                text: replyText,
                createdAt: new Date(),
                user: { _id: 2, name: 'Asesor Virtual' },
            };

            setMessages(prev => [aiMessage, ...prev]);
        } catch (error: any) {
            console.error("AI Chat Error:", error);
            const errorMessage: SimpleMessage = {
                _id: Math.random().toString(),
                text: "Ups, hubo un problema genérico de conexión con el Asesor Virtual. Intentá nuevamente.",
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
            </View>
        );
    };

    const ChatContent = (
        <>
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
                    headerBackTitle: 'Volver'
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    bubbleWrapper: {
        width: '100%',
        flexDirection: 'row',
        marginBottom: 12,
    },
    bubbleWrapperUser: {
        justifyContent: 'flex-end',
    },
    bubbleWrapperAI: {
        justifyContent: 'flex-start',
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
    }
});
