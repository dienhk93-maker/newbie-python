import { useState, useCallback, useRef } from 'react';
import type { MessageType } from '../types/chat';
import { useAuth } from '../contexts/AuthContext';

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useChat = () => {
    const { token } = useAuth();
    const [messages, setMessages] = useState<MessageType[]>([]);
    const [isStreaming, setIsStreaming] = useState<boolean>(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const sendMessage = useCallback(async (prompt: string) => {
        if (!prompt.trim() || isStreaming) return;

        const userMsg: MessageType = {
            id: generateId(),
            role: 'user',
            content: prompt.trim()
        };

        const aiMsgId = generateId();
        const initialAiMsg: MessageType = {
            id: aiMsgId,
            role: 'ai',
            content: '',
            isStreaming: true
        };

        setMessages(prev => [...prev, userMsg, initialAiMsg]);
        setIsStreaming(true);

        // Abort previous request if any
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            const response = await fetch("http://localhost:8000/api/v1/ai-search/chat/stream", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ 
                    prompt: prompt.trim(), 
                    limit: 5,
                    messages: messages.map(m => ({ role: m.role, content: m.content }))
                }),
                signal: abortController.signal
            });

            if (!response.body) throw new Error("ReadableStream not supported in this browser.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            let currentAiContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunkText = decoder.decode(value, { stream: true });
                const lines = chunkText.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.replace("data: ", "");
                        const textChunk = data.replace(/\\n/g, "\n");
                        currentAiContent += textChunk;
                        
                        setMessages(prev => 
                            prev.map(msg => 
                                msg.id === aiMsgId 
                                    ? { ...msg, content: currentAiContent } 
                                    : msg
                            )
                        );
                    }
                }
            }

            // Finalize AI message
            setMessages(prev => 
                prev.map(msg => 
                    msg.id === aiMsgId 
                        ? { ...msg, isStreaming: false } 
                        : msg
                )
            );
        } catch (error: any) {
            if (error.name !== "AbortError") {
                console.error(error);
                setMessages(prev => 
                    prev.map(msg => 
                        msg.id === aiMsgId 
                            ? { ...msg, isStreaming: false, isError: true, content: msg.content + "\n\n[Connection Error]" } 
                            : msg
                    )
                );
            }
        } finally {
            setIsStreaming(false);
        }
    }, [messages, isStreaming, token]);

    const stopStreaming = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsStreaming(false);
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'ai' && lastMsg.isStreaming) {
                    return prev.map(msg => 
                        msg.id === lastMsg.id ? { ...msg, isStreaming: false } : msg
                    );
                }
                return prev;
            });
        }
    }, []);

    return { messages, sendMessage, isStreaming, stopStreaming };
};
