import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { API_BASE_URL } from "@/lib/api/client";
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

type ConnectChatRoomListSocketParams = {
  roomIds: number[];
  onMessage: (message: ChatSocketMessage) => void;
  onRead: (event: ChatSocketReadEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: unknown) => void;
};

export type ChatSocketConnection = {
  client: Client;
  sendMessage: (message: ChatSocketSendMessage) => void;
  markAsRead: () => void;
  disconnect: () => void;
};

export type ChatRoomListSocketConnection = {
  client: Client;
  disconnect: () => void;
};

const SOCKET_URL =
  process.env.NEXT_PUBLIC_WS_URL?.replace(/\/+$/, "") ||
  (API_BASE_URL ? `${API_BASE_URL}/ws` : "/ws");

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
    markAsRead: () => {
      if (!client.connected) {
        throw new Error("WebSocket is not connected.");
      }

      client.publish({
        destination: `/app/chat-rooms/${roomId}/read`,
      });
    },
    disconnect: () => {
      messageSubscription?.unsubscribe();
      readSubscription?.unsubscribe();
      client.deactivate();
    },
  };
}


export function connectChatRoomListSocket({
  roomIds,
  onMessage,
  onRead,
  onConnect,
  onDisconnect,
  onError,
}: ConnectChatRoomListSocketParams): ChatRoomListSocketConnection {
  const subscriptions: StompSubscription[] = [];
  const uniqueRoomIds = Array.from(new Set(roomIds.filter((roomId) => roomId > 0)));
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
      uniqueRoomIds.forEach((roomId) => {
        subscriptions.push(
          client.subscribe(`/topic/chat-rooms/${roomId}`, (message: IMessage) => {
            try {
              const parsedMessage = JSON.parse(message.body) as ChatSocketMessage;
              onMessage(parsedMessage);
            } catch (error) {
              onError?.(error);
            }
          }),
        );

        subscriptions.push(
          client.subscribe(`/topic/chat-rooms/${roomId}/read`, (message: IMessage) => {
            try {
              const parsedEvent = JSON.parse(message.body) as ChatSocketReadEvent;
              onRead(parsedEvent);
            } catch (error) {
              onError?.(error);
            }
          }),
        );
      });

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
    disconnect: () => {
      subscriptions.forEach((subscription) => subscription.unsubscribe());
      client.deactivate();
    },
  };
}
