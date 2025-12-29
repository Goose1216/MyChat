export type Chat = {
  id: number;
  name?: string;
  last_message?: string | null;
  updated_at?: string | null;
};

export interface Message {
  id: number;
  content: string | null;
  sender_id: number;
  chat_id: number;
  created_at: string;
  updated_at?: string;
  is_deleted?: boolean;
}
