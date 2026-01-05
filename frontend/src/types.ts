export type Chat = {
  id: number;
  name?: string;
  last_message?: string | null;
  updated_at?: string | null;
};

export type FileAttachment = {
  id: number;
  filename: string;
  path: string;
  download_url?: string;
};

export type Message = {
  id: number;
  chat_id: number;
  sender_id: number | null;
  text: string | null;
  timestamp: string;
  is_deleted: boolean;
  is_system: boolean;
  is_self: boolean;
  edited: boolean;
  sender: any;
  file?: FileAttachment | null;
};
