export interface ApiRequest {
  method?: string;
  url?: string;
  headers: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
  rawBody?: string | Buffer;
  readableEnded?: boolean;
  socket?: { remoteAddress?: string };
  on?: (event: string, listener: (...args: any[]) => void) => void;
}

export interface ApiResponse {
  setHeader(name: string, value: string | number | string[]): void;
  status(code: number): ApiResponse;
  json(body?: any): void;
  send(body?: any): void;
}
