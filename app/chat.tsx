import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Platform, KeyboardAvoidingView, Alert } from 'react-native';
import { GiftedChat, IMessage, Bubble } from 'react-native-gifted-chat';
import { Stack, useNavigation } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';

export default function CatalogChatScreen() {
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const { isLoggedIn, clientPhone, clientName } = useAuthStore();
    const navigation = useNavigation();

    useEffect(() => {
        // Initial welcome message
        setMessages([
            {
                _id: 1,
                text: isLoggedIn() ? `¡Hola ${clientName}! Soy tu Asesor Virtual. ¿En qué te puedo ayudar hoy? Podés consultarme sobre productos, ofertas o armar tu pedido acá mismo.` : '¡Hola! Soy tu Asesor Virtual. ¿En qué te puedo ayudar hoy? Si querés hacer un pedido voy a necesitar que inicies sesión.',
                createdAt: new Date(),
                user: {
                    _id: 2,
                    name: 'Asesor Virtual',
                    avatar: 'https://ui-avatars.com/api/?name=IA&background=1B5E20&color=fff',
                },
            },
        ]);
    }, [isLoggedIn, clientName]);

    const onSend = useCallback(async (newMessages: IMessage[] = []) => {
        setMessages(previousMessages => GiftedChat.append(previousMessages, newMessages));
        const userText = newMessages[0].text;

        setIsTyping(true);

        try {
            // Send to our new Django AI endpoint
            // phone is required by the backend to link the Conversation
            const phoneToSend = isLoggedIn() ? clientPhone : 'invitado';

            const response = await api.post('chat/', {
                phone: phoneToSend,
                message: userText
            });

            const replyText = response.data?.response || "Lo siento, tuve un problema procesando tu consulta.";

            const aiMessage: IMessage = {
                _id: Math.round(Math.random() * 1000000),
                text: replyText,
                createdAt: new Date(),
                user: {
                    _id: 2,
                    name: 'Asesor Virtual',
                    avatar: 'https://ui-avatars.com/api/?name=IA&background=1B5E20&color=fff',
                },
            };

            setMessages(previousMessages => GiftedChat.append(previousMessages, [aiMessage]));
        } catch (error: any) {
            console.error("AI Chat Error:", error);
            const errorMessage: IMessage = {
                _id: Math.round(Math.random() * 1000000),
                text: "Ups, hubo un problema de conexión con el Asesor Virtual. Intentá nuevamente.",
                createdAt: new Date(),
                user: {
                    _id: 2,
                    name: 'Asesor Virtual',
                    avatar: 'https://ui-avatars.com/api/?name=IA&background=D32F2F&color=fff',
                },
            };
            setMessages(previousMessages => GiftedChat.append(previousMessages, [errorMessage]));
            const errDetail = error?.response?.data?.error || error.message;
            Alert.alert('Error', errDetail || 'Error conectando con el asesor');
        } finally {
            setIsTyping(false);
        }
    }, [isLoggedIn, clientPhone]);

    const renderBubble = (props: any) => {
        return (
            <Bubble
                {...props}
                wrapperStyle={{
                    right: {
                        backgroundColor: '#1B5E20', // Tema Minisuper
                    },
                    left: {
                        backgroundColor: '#E0E0E0',
                    }
                }}
            />
        );
    };

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
                    <GiftedChat
                        messages={messages}
                        onSend={messages => onSend(messages)}
                        user={{
                            _id: 1,
                        }}
                        renderBubble={renderBubble}
                    />
                </KeyboardAvoidingView>
            ) : (
                <GiftedChat
                    messages={messages}
                    onSend={messages => onSend(messages)}
                    user={{
                        _id: 1,
                    }}
                    renderBubble={renderBubble}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
});
