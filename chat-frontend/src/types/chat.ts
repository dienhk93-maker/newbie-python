export type Role = 'user' | 'ai';

export interface MessageType {
    id: string;
    role: Role;
    content: string;
    isStreaming?: boolean;
    isError?: boolean;
}
