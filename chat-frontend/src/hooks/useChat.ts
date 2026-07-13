import { useState, useCallback, useRef } from 'react';
import type { MessageType } from '../types/chat';
import { useAuth } from '../contexts/AuthContext';

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useChat = () => {
    const { token, logout, refreshToken } = useAuth();
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
            const makeRequest = async (authToken: string | null) => {
                return fetch("http://localhost:8000/api/v1/ai-search/chat/stream", {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
                    },
                    body: JSON.stringify({ 
                        prompt: prompt.trim(), 
                        limit: 5,
                        messages: messages.map(m => ({ role: m.role, content: m.content }))
                    }),
                    signal: abortController.signal
                });
            };

            let response = await makeRequest(token);

            if (response.status === 401) {
                const newToken = await refreshToken();
                if (newToken) {
                    // Retry with new token
                    response = await makeRequest(newToken);
                } else {
                    throw new Error("Session expired or unauthorized. Please sign in again.");
                }
            }


            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (!response.body) throw new Error("ReadableStream not supported in this browser.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            let currentAiContent = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // SSE blocks are separated by double newlines
                const blocks = buffer.split('\n\n');
                // Keep last (possibly incomplete) block in buffer
                buffer = blocks.pop() ?? '';

                for (const block of blocks) {
                    if (!block.trim()) continue;

                    const lines = block.split('\n');
                    let eventType = 'message'; // default SSE event
                    const dataLines: string[] = [];

                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            eventType = line.slice(7).trim();
                        } else if (line.startsWith('data: ')) {
                            dataLines.push(line.slice(6));
                        }
                    }

                    const rawData = dataLines.join('');
                    if (!rawData) continue;

                    if (eventType === 'search_results') {
                        // Parse agency cards JSON → attach to AI message
                        try {
                            const agencies = JSON.parse(rawData);
                            setMessages(prev =>
                                prev.map(msg =>
                                    msg.id === aiMsgId
                                        ? { ...msg, agencies }
                                        : msg
                                )
                            );
                        } catch (e) {
                            console.error('[useChat] Failed to parse search_results:', e);
                        }
                    } else {
                        // Default: streaming text chunk
                        const textChunk = rawData.replace(/\\n/g, '\n');
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
    }, [messages, isStreaming, token, logout]);

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
