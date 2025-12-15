export {};

declare global {
  interface Window {
    PB_CHAT_WIDGET_CONFIG?: {
      webhookUrl: string;
      title?: string;
      position?: "bottom-right" | "bottom-left";
      primary?: string;
      zIndex?: number;
      greeting?: string;
    };
  }
}
