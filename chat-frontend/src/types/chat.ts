export type Role = 'user' | 'ai';

export interface Agency {
    id: string;
    user_id?: string;
    score: number;
    name: string;
    budget: number;
    team_size: number;
    domain: string[];
    tech_stack: string[];
    description: string;
    avatar?: string | null;
}

export interface MessageType {
    id: string;
    role: Role;
    content: string;
    isStreaming?: boolean;
    isError?: boolean;
    agencies?: Agency[];
    statuses?: string[];
}
