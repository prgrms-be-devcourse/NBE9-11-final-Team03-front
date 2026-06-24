import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { getAccessToken } from "@/lib/auth";

export type ChatSocketMessage = {
  id: number;
  roomId: number;
  senderId: number;
  messageType: "TEXT" | "IMAGE" | "SYSTEM";
  content: string;
  read: boolean;
  createdAt: string;
};

export type ChatSocketSendMessage = {
  senderId: number;
  content: string;
};

export type ChatSocketReadEvent = {
  roomId: number;
  readerId: number;
  messageIds: number[];
};

type ConnectChatSocketParams = {
  roomId: number;
  onMessage: (message: ChatSocketMessage) => void;
  onRead: (event: ChatSocketReadEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: unknown) => void;
};

export type ChatSocketConnection = {
  client: Client;
  sendMessage: (message: ChatSocketSendMessage) => void;
  markAsRead: (message: { readerId: number }) => void;
  disconnect: () => void;
};

const SOCKET_URL = "http://localhost:8080/ws";

export function connectChatSocket({
  roomId,
  onMessage,
  onRead,
  onConnect,
  onDisconnect,
  onError,
}: ConnectChatSocketParams): ChatSocketConnection {
  let messageSubscription: StompSubscription | null = null;
  let readSubscription: StompSubscription | null = null;
  const accessToken = getAccessToken();

  const client = new Client({
    webSocketFactory: () => new SockJS(SOCKET_URL),
    connectHeaders: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : {},
    reconnectDelay: 3000,
    onConnect: () => {
      messageSubscription = client.subscribe(
        `/topic/chat-rooms/${roomId}`,
        (message: IMessage) => {
          try {
            const parsedMessage = JSON.parse(message.body) as ChatSocketMessage;
            onMessage(parsedMessage);
          } catch (error) {
            onError?.(error);
          }
        },
      );

      readSubscription = client.subscribe(
        `/topic/chat-rooms/${roomId}/read`,
        (message: IMessage) => {
          try {
            const parsedEvent = JSON.parse(message.body) as ChatSocketReadEvent;
            onRead(parsedEvent);
          } catch (error) {
            onError?.(error);
          }
        },
      );

      onConnect?.();
    },
    onDisconnect: () => {
      onDisconnect?.();
    },
    onStompError: (frame) => {
      onError?.(frame);
    },
    onWebSocketError: (event) => {
      onError?.(event);
    },
  });

  client.activate();

  return {
    client,
    sendMessage: (message: ChatSocketSendMessage) => {
      if (!client.connected) {
        throw new Error("WebSocket is not connected.");
      }

      client.publish({
        destination: `/app/chat-rooms/${roomId}/messages`,
        body: JSON.stringify(message),
      });
    },
    markAsRead: (message: { readerId: number }) => {
      if (!client.connected) {
        throw new Error("WebSocket is not connected.");
      }

      client.publish({
        destination: `/app/chat-rooms/${roomId}/read`,
        body: JSON.stringify(message),
      });
    },
    disconnect: () => {
      messageSubscription?.unsubscribe();
      readSubscription?.unsubscribe();
      client.deactivate();
    },
  };
}
