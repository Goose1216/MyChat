export type Chat = {
  id: number;
  name?: string;
  last_message?: string | null;
  updated_at?: string | null;
};

export type Message = {
  id: number;
  text: string;
  sender_id: number;
  chat_id: number;
  is_self: boolean;
  timestamp: string;
};
