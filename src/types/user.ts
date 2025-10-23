export interface User {
  id: number;
  email: string;
  name: string | null;
  bio: string | null;
  image_url?: string | null;
  created_at: string;
  updated_at?: string | null;
}
