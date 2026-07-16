import { useState, useCallback, useRef, useEffect } from 'react';
import type { MessageType } from '../types/chat';
import { useAuth } from '../contexts/AuthContext';

const generateId = () => Math.random().toString(36).substring(2, 9);
const getOrCreateThreadId = () => {
    let tid = sessionStorage.getItem('chat_thread_id');
    if (!tid) {
        tid = `thread_${generateId()}`;
        sessionStorage.setItem('chat_thread_id', tid);
    }
    return tid;
};

export const useChat = () => {
    const { token, logout, refreshToken } = useAuth();
    const [messages, setMessages] = useState<MessageType[]>([]);
    const [isStreaming, setIsStreaming] = useState<boolean>(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
    const [conversations, setConversations] = useState<any[]>([]);
    const [activeThreadId, setActiveThreadId] = useState<string>(getOrCreateThreadId());
    
    const abortControllerRef = useRef<AbortController | null>(null);
    // Ref to cancel in-flight history fetch when token changes mid-flight (race condition fix)
    const historyAbortControllerRef = useRef<AbortController | null>(null);

    // Fetch Sidebar Conversations
    useEffect(() => {
        const fetchConversations = async (authToken: string) => {
            try {
                let res = await fetch(`http://localhost:8000/api/v1/ai-search/conversations`, {
                    headers: { "Authorization": `Bearer ${authToken}` }
                });

                if (res.status === 401) {
                    const newToken = await refreshToken();
                    if (newToken) {
                        res = await fetch(`http://localhost:8000/api/v1/ai-search/conversations`, {
                            headers: { "Authorization": `Bearer ${newToken}` }
                        });
                    }
                }

                if (res.ok) {
                    const data = await res.json();
                    setConversations(data.conversations || []);
                }
            } catch (err) {
                console.error("Failed to fetch conversations:", err);
            }
        };
        // Fetch only when NOT streaming, meaning a turn just ended (or just mounted)
        if (token && !isStreaming) {
            fetchConversations(token);
        }
    }, [token, isStreaming, refreshToken]);

    // Fetch Chat History
    useEffect(() => {
        if (!token) return;

        // Cancel any in-flight history request to prevent race condition:
        // When an expired token triggers refreshToken() → setTokens() → token state change
        // → this effect re-runs WHILE the previous fetch is still doing its 401-retry.
        // Without this abort, two fetches run in parallel and the second one resets messages to [].
        if (historyAbortControllerRef.current) {
            historyAbortControllerRef.current.abort();
        }
        const abortController = new AbortController();
        historyAbortControllerRef.current = abortController;
        const signal = abortController.signal;

        const fetchHistory = async (authToken: string) => {
            setIsLoadingHistory(true);
            try {
                let res = await fetch(`http://localhost:8000/api/v1/ai-search/chat/${activeThreadId}/history`, {
                    headers: { "Authorization": `Bearer ${authToken}` },
                    signal,
                });

                if (res.status === 401) {
                    if (signal.aborted) return; // Another fetch took over
                    const newToken = await refreshToken();
                    if (newToken && !signal.aborted) {
                        res = await fetch(`http://localhost:8000/api/v1/ai-search/chat/${activeThreadId}/history`, {
                            headers: { "Authorization": `Bearer ${newToken}` },
                            signal,
                        });
                    } else {
                        return; // This fetch was superseded
                    }
                }

                if (signal.aborted) return;

                if (res.ok) {
                    const data = await res.json();
                    if (!signal.aborted) {
                        if (data.history && data.history.length > 0) {
                            const historyMessages: MessageType[] = data.history.map((h: any) => ({
                                id: generateId(),
                                role: h.role,
                                content: h.content,
                                agencies: h.agencies,
                            }));
                            setMessages(historyMessages);
                        } else {
                            setMessages([]); // Reset to empty if new chat
                        }
                    }
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error("Failed to fetch chat history:", err);
                }
            } finally {
                if (!signal.aborted) {
                    setIsLoadingHistory(false);
                }
            }
        };

        fetchHistory(token);

        return () => {
            abortController.abort(); // Cleanup on unmount or dependency change
        };
    }, [token, activeThreadId, refreshToken]);

    const selectConversation = useCallback((threadId: string) => {
        sessionStorage.setItem('chat_thread_id', threadId);
        setActiveThreadId(threadId);
    }, []);

    const createNewChat = useCallback(() => {
        const newId = `thread_${generateId()}`;
        sessionStorage.setItem('chat_thread_id', newId);
        setActiveThreadId(newId);
        setMessages([]);
    }, []);

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
                        thread_id: activeThreadId
                        // NO NEED TO SEND 'messages' array anymore!
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
    }, [isStreaming, token, activeThreadId, refreshToken]);

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

    return { 
        messages, 
        sendMessage, 
        isStreaming, 
        stopStreaming, 
        isLoadingHistory, 
        conversations, 
        activeThreadId, 
        selectConversation, 
        createNewChat 
    };
};
