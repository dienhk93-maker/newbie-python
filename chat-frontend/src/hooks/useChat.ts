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
    const [convPage, setConvPage] = useState<number>(1);
    const [hasMoreConversations, setHasMoreConversations] = useState<boolean>(true);
    const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState<boolean>(false);
    const [activeThreadId, setActiveThreadId] = useState<string>(getOrCreateThreadId());
    const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
    // Holds the interrupt payload when LangGraph pauses for human confirmation
    const [pendingInterrupt, setPendingInterrupt] = useState<Record<string, any> | null>(null);
    
    const abortControllerRef = useRef<AbortController | null>(null);
    // Ref to cancel in-flight history fetch when token changes mid-flight (race condition fix)
    const historyAbortControllerRef = useRef<AbortController | null>(null);

    // Fetch Sidebar Conversations (paginated)
    const fetchConversations = useCallback(async (pageToFetch: number = 1, isAppend: boolean = false) => {
        if (!token) return;
        if (isAppend) {
            setIsLoadingMoreConversations(true);
        }

        try {
            const makeRequest = async (authToken: string) => {
                return fetch(`http://localhost:8000/api/v1/conversations?page=${pageToFetch}&item_page=10`, {
                    headers: { "Authorization": `Bearer ${authToken}` }
                });
            };

            let res = await makeRequest(token);
            if (res.status === 401) {
                const newToken = await refreshToken();
                if (newToken) {
                    res = await makeRequest(newToken);
                }
            }

            if (res.ok) {
                const data = await res.json();
                const newDocs = data.docs || [];
                if (isAppend) {
                    setConversations(prev => {
                        const existingIds = new Set(prev.map(c => c.thread_id));
                        const filtered = newDocs.filter((c: any) => !existingIds.has(c.thread_id));
                        return [...prev, ...filtered];
                    });
                } else {
                    setConversations(newDocs);
                }
                setConvPage(data.page || pageToFetch);
                setHasMoreConversations((data.page || pageToFetch) < (data.total_page || 1));
            }
        } catch (err) {
            console.error("Failed to fetch conversations:", err);
        } finally {
            setIsLoadingMoreConversations(false);
        }
    }, [token, refreshToken]);

    const loadMoreConversations = useCallback(() => {
        if (hasMoreConversations && !isLoadingMoreConversations) {
            fetchConversations(convPage + 1, true);
        }
    }, [hasMoreConversations, isLoadingMoreConversations, convPage, fetchConversations]);

    // Ref to detect the streaming-ended transition (was true → now false)
    const prevIsStreamingRef = useRef<boolean>(false);

    // 1. Initial fetch — abortable so React StrictMode's double-mount in dev
    //    cancels the first in-flight request before the real mount completes.
    useEffect(() => {
        if (!token) return;
        const controller = new AbortController();

        const run = async () => {
            try {
                const res = await fetch(
                    `http://localhost:8000/api/v1/conversations?page=1&item_page=10`,
                    { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }
                );
                if (controller.signal.aborted) return;

                if (res.status === 401) {
                    const newToken = await refreshToken();
                    if (!newToken || controller.signal.aborted) return;
                    const res2 = await fetch(
                        `http://localhost:8000/api/v1/conversations?page=1&item_page=10`,
                        { headers: { Authorization: `Bearer ${newToken}` }, signal: controller.signal }
                    );
                    if (!res2.ok || controller.signal.aborted) return;
                    const data = await res2.json();
                    setConversations(data.docs || []);
                    setConvPage(data.page || 1);
                    setHasMoreConversations((data.page || 1) < (data.total_page || 1));
                    return;
                }

                if (res.ok && !controller.signal.aborted) {
                    const data = await res.json();
                    setConversations(data.docs || []);
                    setConvPage(data.page || 1);
                    setHasMoreConversations((data.page || 1) < (data.total_page || 1));
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error('Failed to fetch conversations:', err);
                }
            }
        };

        run();
        return () => controller.abort(); // StrictMode cleanup cancels the first mount's request
    }, [token, refreshToken]);

    // 2. Refresh list only when streaming ENDS (was true → now false)
    useEffect(() => {
        if (prevIsStreamingRef.current && !isStreaming && token) {
            fetchConversations(1, false);
        }
        prevIsStreamingRef.current = isStreaming;
    }, [isStreaming, token, fetchConversations]);


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

    const deleteConversation = useCallback(async (conversationId: string, threadId: string) => {
        if (!token || deletingConversationId) return;

        // Snapshot before optimistic removal for rollback
        let removedConv: any = null;
        let removedIndex = -1;

        // Optimistic UI: remove from sidebar immediately
        setConversations(prev => {
            removedIndex = prev.findIndex(c => c._id === conversationId);
            if (removedIndex !== -1) removedConv = prev[removedIndex];
            return prev.filter(c => c._id !== conversationId);
        });

        // If the deleted conversation was active, start a fresh one
        if (threadId === activeThreadId) {
            const newId = `thread_${generateId()}`;
            sessionStorage.setItem('chat_thread_id', newId);
            setActiveThreadId(newId);
            setMessages([]);
        }

        setDeletingConversationId(conversationId);
        try {
            const makeRequest = async (authToken: string) =>
                fetch(`http://localhost:8000/api/v1/conversations/${conversationId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${authToken}` },
                });

            let res = await makeRequest(token);
            if (res.status === 401) {
                const newToken = await refreshToken();
                if (newToken) res = await makeRequest(newToken);
            }

            if (!res.ok && res.status !== 204) {
                // Rollback: restore conversation to its original position
                if (removedConv !== null) {
                    setConversations(prev => {
                        const next = [...prev];
                        next.splice(removedIndex, 0, removedConv);
                        return next;
                    });
                }
                console.error(`Failed to delete conversation: HTTP ${res.status}`);
            }
        } catch (err) {
            // Rollback on network error
            if (removedConv !== null) {
                setConversations(prev => {
                    const next = [...prev];
                    next.splice(removedIndex, 0, removedConv);
                    return next;
                });
            }
            console.error('Failed to delete conversation:', err);
        } finally {
            setDeletingConversationId(null);
        }
    }, [token, refreshToken, activeThreadId, deletingConversationId]);

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

                    if (eventType === 'status_update') {
                        try {
                            const { status } = JSON.parse(rawData);
                            setMessages(prev =>
                                prev.map(msg => {
                                    if (msg.id === aiMsgId) {
                                        const curStatuses = msg.statuses || [];
                                        if (!curStatuses.includes(status)) {
                                            return { ...msg, statuses: [...curStatuses, status] };
                                        }
                                    }
                                    return msg;
                                })
                            );
                        } catch (e) {
                            console.error('[useChat] Failed to parse status:', e);
                        }
                    } else if (eventType === 'search_results') {
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
                    } else if (eventType === 'interrupt') {
                        // LangGraph paused — store interrupt payload so UI can render confirm card
                        try {
                            const interruptData = JSON.parse(rawData);
                            console.log('[useChat] Interrupt received:', interruptData);
                            setPendingInterrupt({ ...interruptData, aiMsgId });
                            // REMOVE the empty AI placeholder — the ConfirmCard replaces it.
                            // Keeping an empty bubble is confusing to the user.
                            setMessages(prev => prev.filter(msg => msg.id !== aiMsgId));
                        } catch (e) {
                            console.error('[useChat] Failed to parse interrupt data:', e);
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

    /**
     * Resume a paused LangGraph thread after a human-in-the-loop interrupt.
     * Calls POST /chat/resume and streams the continuation exactly like sendMessage.
     */
    const resumeSearch = useCallback(async (approved: boolean) => {
        if (!pendingInterrupt || isStreaming) return;
        setPendingInterrupt(null);

        // Add a new AI message placeholder for the resumed stream
        const resumeAiMsgId = generateId();
        setMessages(prev => [
            ...prev,
            { id: resumeAiMsgId, role: 'ai', content: '', isStreaming: true }
        ]);
        setIsStreaming(true);

        try {
            const makeRequest = async (authToken: string | null) =>
                fetch('http://localhost:8000/api/v1/ai-search/chat/resume', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                    },
                    body: JSON.stringify({ thread_id: activeThreadId, approved }),
                });

            let response = await makeRequest(token);
            if (response.status === 401) {
                const newToken = await refreshToken();
                if (newToken) response = await makeRequest(newToken);
                else throw new Error('Session expired.');
            }
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            if (!response.body) throw new Error('No stream body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let currentContent = '';
            let buf = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const blocks = buf.split('\n\n');
                buf = blocks.pop() ?? '';

                for (const block of blocks) {
                    if (!block.trim()) continue;
                    const lines = block.split('\n');
                    let eventType = 'message';
                    const dataLines: string[] = [];
                    for (const line of lines) {
                        if (line.startsWith('event: ')) eventType = line.slice(7).trim();
                        else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
                    }
                    const raw = dataLines.join('');
                    if (!raw) continue;

                    if (eventType === 'search_results') {
                        try {
                            const agencies = JSON.parse(raw);
                            setMessages(prev => prev.map(m =>
                                m.id === resumeAiMsgId ? { ...m, agencies } : m
                            ));
                        } catch { /* ignore */ }
                    } else if (eventType === 'status_update') {
                        try {
                            const { status } = JSON.parse(raw);
                            setMessages(prev => prev.map(m => {
                                if (m.id !== resumeAiMsgId) return m;
                                const cur = m.statuses || [];
                                return cur.includes(status) ? m : { ...m, statuses: [...cur, status] };
                            }));
                        } catch { /* ignore */ }
                    } else {
                        const chunk = raw.replace(/\\n/g, '\n');
                        currentContent += chunk;
                        setMessages(prev => prev.map(m =>
                            m.id === resumeAiMsgId ? { ...m, content: currentContent } : m
                        ));
                    }
                }
            }
        } catch (err: any) {
            console.error('[resumeSearch] Error:', err);
            setMessages(prev => prev.map(m =>
                m.id === resumeAiMsgId
                    ? { ...m, isStreaming: false, isError: true, content: '[Resume Error]' }
                    : m
            ));
        } finally {
            setMessages(prev => prev.map(m =>
                m.id === resumeAiMsgId ? { ...m, isStreaming: false } : m
            ));
            setIsStreaming(false);
        }
    }, [pendingInterrupt, isStreaming, activeThreadId, token, refreshToken]);

    return { 
        messages, 
        sendMessage, 
        isStreaming, 
        stopStreaming, 
        isLoadingHistory, 
        conversations, 
        activeThreadId, 
        selectConversation, 
        createNewChat,
        hasMoreConversations,
        isLoadingMoreConversations,
        loadMoreConversations,
        deleteConversation,
        deletingConversationId,
        pendingInterrupt,
        resumeSearch,
    };
};
