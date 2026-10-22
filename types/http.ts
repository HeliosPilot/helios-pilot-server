export interface ApiRequest {
  method?: string;
  url?: string;
  headers: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
  socket?: { remoteAddress?: string };
}

export interface ApiResponse {
  setHeader(name: string, value: string | number | string[]): void;
  status(code: number): ApiResponse;
  json(body?: any): void;
  send(body?: any): void;
}
