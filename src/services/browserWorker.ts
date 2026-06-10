export type WorkerChatResult = {
  ok: boolean;
  text?: string;
  markdown?: string;
  sources?: Array<Record<string, unknown>>;
  images?: Array<Record<string, unknown>>;
  videos?: Array<Record<string, unknown>>;
  error?: string | null;
};

export type WorkerPlaceResult = {
  query: string;
  title: string | null;
  place: string | null;
  latitude: number | null;
  longitude: number | null;
  zoom: number | null;
  place_id: string | null;
  final_url: string | null;
};

export interface BrowserWorker {
  health(): Promise<Record<string, unknown>>;
  chat(message: string, filePath?: string | null): Promise<WorkerChatResult>;
  place(query: string): Promise<WorkerPlaceResult>;
  reset(): Promise<{ success: boolean; reset: boolean }>;
}
