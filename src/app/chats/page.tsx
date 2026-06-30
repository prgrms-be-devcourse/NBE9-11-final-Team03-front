"use client";

import {
  Fragment,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { MessageCircle, Send } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoginRequiredState } from "@/components/common/LoginRequiredState";
import {
  chatApi,
  type ChatMessageRes,
  type ChatRoomListItem,
  type ChatRoomRes,
} from "@/lib/api";
import {
  connectChatSocket,
  type ChatSocketConnection,
} from "@/lib/api/chatSocket";
import { isAuthRequiredMessage } from "@/lib/auth-required";

function readStoredUserId(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedUserId = window.localStorage.getItem("baton_user_id");
  const userId = storedUserId === null ? NaN : Number(storedUserId);

  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function formatMessageTime(date: string): string {
  const targetDate = getValidDate(date);

  if (targetDate === null) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(targetDate);
}

function formatDateDivider(date: string): string {
  const targetDate = getValidDate(date);

  if (targetDate === null) {
    return "날짜 정보 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(targetDate);
}

function isSameDate(left: string, right: string): boolean {
  const leftDate = getValidDate(left);
  const rightDate = getValidDate(right);

  if (leftDate === null || rightDate === null) {
    return false;
  }

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

function getValidDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime()) ? date : null;
}

function getPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function getNonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isYesterday(date: Date, today: Date): boolean {
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  );
}

function formatChatRoomListDate(date: string): string {
  const targetDate = getValidDate(date);
  const today = new Date();

  if (targetDate === null) {
    return "-";
  }

  if (isSameDate(date, today.toISOString())) {
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(targetDate);
  }

  if (isYesterday(targetDate, today)) {
    return "어제";
  }

  if (targetDate.getFullYear() === today.getFullYear()) {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "long",
      day: "numeric",
    }).format(targetDate);
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(targetDate)
    .replace(/\.\s?/g, ".")
    .replace(/\.$/, "");
}

function getRoomStatusLabel(status: ChatRoomRes["status"]): string {
  const labels: Record<ChatRoomRes["status"], string> = {
    MATCH: "매칭 채팅",
    TRANSACTION: "거래 채팅",
  };

  return labels[status] ?? status;
}

function getInitial(name: string): string {
  return name.trim().slice(0, 1) || "?";
}

function getMessageSenderLabel({
  senderId,
  currentUserId,
  opponentName,
}: {
  senderId: number | null;
  currentUserId: number | null;
  opponentName: string;
}): string {
  if (senderId !== null && senderId === currentUserId) {
    return "나";
  }

  return opponentName;
}

function getFallbackTalentLabel(
  title: unknown,
  id: unknown,
  fallbackText: string,
): string {
  const talentTitle = getNonEmptyText(title);

  if (talentTitle) {
    return talentTitle;
  }

  const talentId = getPositiveInteger(id);

  return talentId === null ? fallbackText : `재능 #${talentId}`;
}

function hasExplicitTalentPair(room: ChatRoomListItem): boolean {
  return (
    getNonEmptyText(room.myTalentTitle) !== null ||
    getPositiveInteger(room.myTalentId) !== null ||
    getNonEmptyText(room.opponentTalentTitle) !== null ||
    getPositiveInteger(room.opponentTalentId) !== null
  );
}

function hasRequesterProviderTalentPair(room: ChatRoomListItem): boolean {
  return (
    getNonEmptyText(room.requesterTalentTitle) !== null ||
    getPositiveInteger(room.requesterTalentId) !== null ||
    getNonEmptyText(room.providerTalentTitle) !== null ||
    getPositiveInteger(room.providerTalentId) !== null
  );
}

function getMyTalentLabel(
  room: ChatRoomListItem,
  currentUserId: number | null,
): string | null {
  if (hasExplicitTalentPair(room)) {
    return getFallbackTalentLabel(
      room.myTalentTitle,
      room.myTalentId,
      "내 재능 정보 없음",
    );
  }

  if (!hasRequesterProviderTalentPair(room) || currentUserId === null) {
    return null;
  }

  if (getPositiveInteger(room.requesterId) === currentUserId) {
    return getFallbackTalentLabel(
      room.requesterTalentTitle,
      room.requesterTalentId,
      "내 재능 정보 없음",
    );
  }

  if (getPositiveInteger(room.providerId) === currentUserId) {
    return getFallbackTalentLabel(
      room.providerTalentTitle,
      room.providerTalentId,
      "내 재능 정보 없음",
    );
  }

  return null;
}

function getOpponentTalentLabel(
  room: ChatRoomListItem,
  currentUserId: number | null,
): string | null {
  if (hasExplicitTalentPair(room)) {
    return getFallbackTalentLabel(
      room.opponentTalentTitle,
      room.opponentTalentId,
      "상대 재능 정보 없음",
    );
  }

  if (!hasRequesterProviderTalentPair(room) || currentUserId === null) {
    return null;
  }

  if (getPositiveInteger(room.requesterId) === currentUserId) {
    return getFallbackTalentLabel(
      room.providerTalentTitle,
      room.providerTalentId,
      "상대 재능 정보 없음",
    );
  }

  if (getPositiveInteger(room.providerId) === currentUserId) {
    return getFallbackTalentLabel(
      room.requesterTalentTitle,
      room.requesterTalentId,
      "상대 재능 정보 없음",
    );
  }

  return null;
}

function getChatRoomTalentLines(
  room: ChatRoomListItem,
  currentUserId: number | null,
): { label: string; value: string }[] {
  if (room.roomType === "TRANSACTION") {
    const myTalentLabel = getMyTalentLabel(room, currentUserId);
    const opponentTalentLabel = getOpponentTalentLabel(room, currentUserId);

    if (myTalentLabel !== null || opponentTalentLabel !== null) {
      return [
        {
          label: "내 재능",
          value: myTalentLabel ?? "내 재능 정보 없음",
        },
        {
          label: "상대 재능",
          value: opponentTalentLabel ?? "상대 재능 정보 없음",
        },
      ];
    }

    if (hasRequesterProviderTalentPair(room)) {
      return [
        {
          label: "요청자 재능",
          value: getFallbackTalentLabel(
            room.requesterTalentTitle,
            room.requesterTalentId,
            "요청자 재능 정보 없음",
          ),
        },
        {
          label: "제공자 재능",
          value: getFallbackTalentLabel(
            room.providerTalentTitle,
            room.providerTalentId,
            "제공자 재능 정보 없음",
          ),
        },
      ];
    }
  }

  return [
    {
      label: "재능",
      value: getFallbackTalentLabel(
        room.talentTitle,
        room.talentId,
        "재능 정보 없음",
      ),
    },
  ];
}

function getChatRoomTalentSummary(
  room: ChatRoomListItem,
  currentUserId: number | null,
): string {
  return getChatRoomTalentLines(room, currentUserId)
    .map((line) => `${line.label}: ${line.value}`)
    .join(" · ");
}

type ChatMessageRuntimeFields = ChatMessageRes & {
  messageId?: number | string | null;
  sentAt?: string | null;
  createdDate?: string | null;
  message?: string | null;
};

function getMessageRoomId(message: ChatMessageRes): number | null {
  return getPositiveInteger(message.roomId);
}

function isMessageForRoom(message: ChatMessageRes, roomId: number): boolean {
  const messageRoomId = getMessageRoomId(message);

  return messageRoomId === null || messageRoomId === roomId;
}

function getMessageCreatedAtValue(message: ChatMessageRes): string {
  const runtimeMessage = message as ChatMessageRuntimeFields;
  const candidates = [
    runtimeMessage.createdAt,
    runtimeMessage.sentAt,
    runtimeMessage.createdDate,
  ];

  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === "string" && candidate.trim().length > 0,
    ) ?? ""
  );
}

function getMessageTime(message: ChatMessageRes): number {
  const date = getValidDate(getMessageCreatedAtValue(message));

  return date?.getTime() ?? 0;
}

function getMessageContent(message: ChatMessageRes): string {
  const runtimeMessage = message as ChatMessageRuntimeFields;
  const content =
    typeof runtimeMessage.content === "string"
      ? runtimeMessage.content
      : typeof runtimeMessage.message === "string"
        ? runtimeMessage.message
        : "";

  return content;
}

function getMessageId(message: ChatMessageRes): string {
  const runtimeMessage = message as ChatMessageRuntimeFields;
  const primaryId = runtimeMessage.messageId ?? runtimeMessage.id;

  if (typeof primaryId === "number" && Number.isFinite(primaryId)) {
    return `id-${primaryId}`;
  }

  if (typeof primaryId === "string" && primaryId.trim().length > 0) {
    return `id-${primaryId.trim()}`;
  }

  const roomId = getMessageRoomId(message) ?? "unknown-room";
  const senderId = getPositiveInteger(runtimeMessage.senderId) ?? "unknown";
  const createdAt = getMessageCreatedAtValue(message);
  const content = getMessageContent(message);

  return `fallback-${roomId}-${senderId}-${createdAt}-${content}`;
}

function getMessageNumericId(message: ChatMessageRes): number | null {
  const runtimeMessage = message as ChatMessageRuntimeFields;
  const primaryId = runtimeMessage.messageId ?? runtimeMessage.id;

  if (typeof primaryId === "number" && Number.isFinite(primaryId)) {
    return primaryId;
  }

  if (typeof primaryId === "string") {
    const numericId = Number(primaryId);

    return Number.isFinite(numericId) ? numericId : null;
  }

  return null;
}

function dedupeMessages(messages: ChatMessageRes[]): ChatMessageRes[] {
  const messageMap = new Map<string, ChatMessageRes>();

  for (const message of messages) {
    messageMap.set(getMessageId(message), message);
  }

  return Array.from(messageMap.values());
}

function sortMessagesByCreatedAtAsc(
  messages: ChatMessageRes[],
): ChatMessageRes[] {
  return [...messages].sort((left, right) => {
    const timeDiff = getMessageTime(left) - getMessageTime(right);

    if (timeDiff !== 0) {
      return timeDiff;
    }

    const leftId = getMessageNumericId(left);
    const rightId = getMessageNumericId(right);

    if (leftId !== null && rightId !== null && leftId !== rightId) {
      return leftId - rightId;
    }

    return getMessageId(left).localeCompare(getMessageId(right));
  });
}

function normalizeMessages(messages: ChatMessageRes[]): ChatMessageRes[] {
  return sortMessagesByCreatedAtAsc(dedupeMessages(messages));
}

export default function ChatsPage() {
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [hasCheckedUserId, setHasCheckedUserId] = useState(false);
  const [chatRooms, setChatRooms] = useState<ChatRoomListItem[]>([]);
  const [hasNextRooms, setHasNextRooms] = useState(false);
  const [nextRoomCursor, setNextRoomCursor] = useState<number | null>(null);
  const [currentRoom, setCurrentRoom] = useState<ChatRoomRes | null>(null);
  const [messages, setMessages] = useState<ChatMessageRes[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isLoadingMoreRooms, setIsLoadingMoreRooms] = useState(false);
  const [isEnteringRoom, setIsEnteringRoom] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConnectedToSocket, setIsConnectedToSocket] = useState(false);
  const [socketConnectionVersion, setSocketConnectionVersion] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatSocketRef = useRef<ChatSocketConnection | null>(null);
  const currentUserIdRef = useRef<number | null>(null);
  const selectedRoomIdRef = useRef<number | null>(null);
  const initialRoomQueryHandledRef = useRef(false);
  const currentRoomId = currentRoom?.id ?? null;
  const currentRoomListItem =
    currentRoomId === null
      ? undefined
      : chatRooms.find((room) => room.roomId === currentRoomId);
  const currentOpponentName =
    currentRoomListItem?.opponentNickname?.trim() || "상대방";
  const currentTalentTitle =
    currentRoomListItem !== undefined
      ? getChatRoomTalentSummary(currentRoomListItem, currentUserId)
      : currentRoom
        ? getFallbackTalentLabel(null, currentRoom.talentId, "재능 정보 없음")
        : "재능 정보 없음";

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentUserId(readStoredUserId());
      setHasCheckedUserId(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    if (currentRoomId === null) {
      chatSocketRef.current?.disconnect();
      chatSocketRef.current = null;
      return;
    }

    chatSocketRef.current?.disconnect();

    let connection: ChatSocketConnection | null = null;

    connection = connectChatSocket({
      roomId: currentRoomId,
      onMessage: (message) => {
        if (
          selectedRoomIdRef.current !== currentRoomId ||
          !isMessageForRoom(message, currentRoomId)
        ) {
          return;
        }

        setMessages((prevMessages) => {
          const currentRoomMessages = prevMessages.filter((prevMessage) =>
            isMessageForRoom(prevMessage, currentRoomId),
          );

          return normalizeMessages([...currentRoomMessages, message]);
        });

        const userId = currentUserIdRef.current;
        if (userId !== null && message.senderId !== userId) {
          chatSocketRef.current?.markAsRead();
        }
      },
      onRead: (event) => {
        const readRoomId = getPositiveInteger(event.roomId);

        if (
          selectedRoomIdRef.current !== currentRoomId ||
          (readRoomId !== null && readRoomId !== currentRoomId)
        ) {
          return;
        }

        const readMessageIds = new Set(
          Array.isArray(event.messageIds) ? event.messageIds : [],
        );

        setMessages((prevMessages) =>
          normalizeMessages(
            prevMessages
              .filter((message) => isMessageForRoom(message, currentRoomId))
              .map((message) =>
                readMessageIds.has(message.id)
                  ? {
                    ...message,
                    read: true,
                  }
                  : message,
              ),
          ),
        );
      },
      onConnect: () => {
        setIsConnectedToSocket(true);

        const userId = currentUserIdRef.current;
        if (userId !== null) {
          connection?.markAsRead();
        }
      },
      onDisconnect: () => {
        setIsConnectedToSocket(false);
      },
      onError: () => {
        setIsConnectedToSocket(false);
        setErrorMessage(
          "WebSocket 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        );
      },
    });

    chatSocketRef.current = connection;

    return () => {
      connection?.disconnect();
      if (chatSocketRef.current === connection) {
        chatSocketRef.current = null;
      }
    };
  }, [currentRoomId, socketConnectionVersion]);

  const loadMessages = useCallback(async (roomId: number) => {
    setErrorMessage(null);
    setIsLoadingMessages(true);

    try {
      const response = await chatApi.getMessages(roomId);
      const nextMessages = Array.isArray(response.content)
        ? response.content
        : [];

      if (selectedRoomIdRef.current !== roomId) {
        return;
      }

      setMessages((prevMessages) => {
        const currentRoomMessages = prevMessages.filter((message) =>
          isMessageForRoom(message, roomId),
        );

        return normalizeMessages([...currentRoomMessages, ...nextMessages]);
      });
    } catch (error) {
      if (selectedRoomIdRef.current !== roomId) {
        return;
      }

      setMessages([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "메시지를 불러오지 못했습니다.",
      );
    } finally {
      if (selectedRoomIdRef.current === roomId) {
        setIsLoadingMessages(false);
      }
    }
  }, []);

  const loadChatRooms = useCallback(
    async ({ cursor, append = false }: { cursor?: number | null; append?: boolean } = {}) => {
      if (!append) {
        setIsLoadingRooms(true);
      } else {
        setIsLoadingMoreRooms(true);
      }

      setErrorMessage(null);

      try {
        const response = await chatApi.getMyChatRooms({
          cursor,
          size: 20,
        });

        setChatRooms((prevRooms) =>
          append ? [...prevRooms, ...response.content] : response.content,
        );
        setHasNextRooms(response.hasNext);
        setNextRoomCursor(response.nextCursor);
      } catch (error) {
        if (!append) {
          setChatRooms([]);
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "채팅방 목록을 불러오지 못했습니다.",
        );
      } finally {
        setIsLoadingRooms(false);
        setIsLoadingMoreRooms(false);
      }
    },
    [],
  );

  const openExistingRoom = useCallback(
    async (roomId: number) => {
      let activeRoomId = roomId;

      setErrorMessage(null);
      setIsEnteringRoom(true);
      setIsConnectedToSocket(false);
      selectedRoomIdRef.current = roomId;
      setCurrentRoom(null);
      setMessages([]);

      try {
        const room = await chatApi.getRoom(roomId);

        if (selectedRoomIdRef.current !== roomId) {
          return;
        }

        activeRoomId = room.id;
        selectedRoomIdRef.current = room.id;
        setCurrentRoom(room);
        setSocketConnectionVersion((version) => version + 1);
        await loadMessages(room.id);
      } catch (error) {
        if (selectedRoomIdRef.current !== roomId) {
          return;
        }

        setCurrentRoom(null);
        setMessages([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "채팅방에 입장하지 못했습니다.",
          );
      } finally {
        if (selectedRoomIdRef.current === activeRoomId) {
          setIsEnteringRoom(false);
        }
      }
    },
    [loadMessages],
  );

  useEffect(() => {
    if (
      !hasCheckedUserId ||
      currentUserId === null ||
      initialRoomQueryHandledRef.current
    ) {
      return;
    }

    const roomIdQuery = new URLSearchParams(window.location.search).get(
      "roomId",
    );
    const roomId = roomIdQuery === null ? NaN : Number(roomIdQuery);

    if (!Number.isInteger(roomId) || roomId <= 0) {
      initialRoomQueryHandledRef.current = true;
      return;
    }

    initialRoomQueryHandledRef.current = true;

    const timeoutId = window.setTimeout(() => {
      void openExistingRoom(roomId);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentUserId, hasCheckedUserId, openExistingRoom]);

  useEffect(() => {
    if (!hasCheckedUserId) {
      return;
    }

    if (currentUserId === null) {
      const timeoutId = window.setTimeout(() => {
        setChatRooms([]);
        setHasNextRooms(false);
        setNextRoomCursor(null);
        setCurrentRoom(null);
        setMessages([]);
        selectedRoomIdRef.current = null;
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    const timeoutId = window.setTimeout(() => {
      void loadChatRooms();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentUserId, hasCheckedUserId, loadChatRooms]);

  async function handleSelectRoom(roomId: number) {
    if (currentUserId === null) {
      setErrorMessage("로그인 후 이용해 주세요.");
      return;
    }

    await openExistingRoom(roomId);
  }

  async function handleLoadMoreRooms() {
    if (!hasNextRooms || nextRoomCursor === null || isLoadingMoreRooms) {
      return;
    }

    await loadChatRooms({
      cursor: nextRoomCursor,
      append: true,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (currentRoom === null || currentUserId === null || isSending) {
      return;
    }

    const content = messageInput.trim();
    if (content.length === 0) {
      return;
    }

    if (chatSocketRef.current === null || !isConnectedToSocket) {
      setErrorMessage("WebSocket 연결 후 메시지를 전송할 수 있습니다.");
      return;
    }

    setErrorMessage(null);
    setIsSending(true);

    try {
      chatSocketRef.current.sendMessage({
        content,
      });
      setMessageInput("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "메시지를 전송하지 못했습니다.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="relative min-h-[calc(100dvh-64px)] overflow-x-hidden bg-white">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#f4f0ff] blur-3xl" />

      <div className="fixed-container relative py-10 sm:py-14">
        <header className="mx-auto mb-8 max-w-3xl text-center sm:mb-12">
          <h1 className="baton-page-title mt-3 !font-bold">
            CHATTING
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-zinc-500 sm:mt-5 sm:text-lg sm:leading-8">
            매칭과 거래에서 이어진 대화를 한 곳에서 확인하고 실시간으로 메시지를 주고받으세요.
          </p>
        </header>

        <div className="relative grid min-h-[680px] overflow-hidden rounded-lg border border-[#ded6ff] bg-white/95 shadow-[0_28px_80px_rgba(80,60,160,0.12)] backdrop-blur lg:h-[720px] lg:min-h-0 lg:grid-cols-[340px_1fr]">
          <div
            className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]"
            aria-hidden="true"
          />
          <aside className="flex min-h-0 max-h-[360px] flex-col border-b border-[#eee8ff] bg-[#fbf9ff]/70 lg:max-h-none lg:border-b-0 lg:border-r">
            <div className="border-b border-[#eee8ff] px-5 py-5">
              <p className="text-sm font-black text-zinc-950">대화 목록</p>
              <p className="mt-1 text-xs font-bold text-zinc-400">
                총 {chatRooms.length}{hasNextRooms ? "+" : ""}개 대화
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto [overscroll-behavior-y:contain] [scrollbar-gutter:stable]">
              {isLoadingRooms ? (
                <div className="px-5 py-8 text-center text-sm font-semibold text-zinc-500">
                  채팅방 목록을 불러오는 중입니다.
                </div>
              ) : null}

              {!isLoadingRooms && chatRooms.length > 0 ? (
                <div className="divide-y divide-[#eee8ff]">
                  {chatRooms.map((room) => (
                    <ChatRoomListButton
                      key={room.roomId}
                      room={room}
                      currentUserId={currentUserId}
                      isActive={currentRoomId === room.roomId}
                      onSelect={() => handleSelectRoom(room.roomId)}
                    />
                  ))}
                  {hasNextRooms ? (
                    <div className="p-4">
                      <button
                        type="button"
                        disabled={isLoadingMoreRooms}
                        onClick={handleLoadMoreRooms}
                        className="h-10 w-full cursor-pointer rounded-lg border border-[#ded6ff] bg-white text-sm font-black text-zinc-700 transition hover:border-[#8c5bff] hover:bg-[#fbf9ff] hover:text-[#8c5bff] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLoadingMoreRooms ? "불러오는 중" : "더 보기"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!isLoadingRooms && chatRooms.length === 0 ? (
                <div className="px-5 py-5">
                  <EmptyState
                    title="아직 채팅방이 없습니다."
                    description="매칭 제안이 수락되거나 거래가 시작되면 채팅방이 생성됩니다."
                  />
                </div>
              ) : null}
            </div>
          </aside>

          <section className="flex min-h-[560px] min-w-0 flex-col lg:min-h-0">
            <div className="border-b border-[#eee8ff] px-6 py-5">
              {!hasCheckedUserId ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold text-zinc-500">
                    사용자 정보를 확인하는 중입니다.
                  </p>
                  <SocketStatusBadge isConnected={isConnectedToSocket} />
                </div>
              ) : currentUserId === null ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-amber-700">
                    로그인 후 이용해 주세요.
                  </p>
                  <SocketStatusBadge isConnected={isConnectedToSocket} />
                </div>
              ) : currentRoom ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black text-zinc-950">
                      {currentOpponentName}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-zinc-500">
                      {currentTalentTitle}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <span className="rounded-full border border-[#d9ccff] bg-[#f4f0ff] px-3 py-1 text-xs font-black text-[#8c5bff]">
                      {getRoomStatusLabel(currentRoom.status)}
                    </span>
                    <SocketStatusBadge isConnected={isConnectedToSocket} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-black text-zinc-950">
                      채팅방을 선택해 주세요
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-500">
                      왼쪽 목록에서 대화를 선택하면 메시지를 확인할 수 있습니다.
                    </p>
                  </div>
                  <SocketStatusBadge isConnected={isConnectedToSocket} />
                </div>
              )}
            </div>

            {isAuthRequiredMessage(errorMessage) ? (
              <div className="px-6 pt-4">
                <LoginRequiredState description="채팅은 로그인 후 이용할 수 있어요." />
              </div>
            ) : errorMessage ? (
              <div className="px-6 pt-4">
                <ErrorState message={errorMessage} />
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbf9ff]/60 px-4 py-5 [scrollbar-gutter:stable] sm:px-6 sm:py-6">
              <div className="mx-auto flex max-w-[720px] flex-col gap-4">
                {currentRoom === null ? (
                  isEnteringRoom ? (
                    <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
                      채팅방에 입장하는 중입니다.
                    </div>
                  ) : (
                    <EmptyState
                      title="채팅방을 선택해 주세요"
                      description="왼쪽 채팅방 목록에서 대화를 선택하면 메시지를 확인할 수 있어요."
                    />
                  )
                ) : isLoadingMessages ? (
                  <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
                    메시지를 불러오는 중입니다.
                  </div>
                ) : messages.length === 0 ? (
                  <EmptyState
                    title="아직 메시지가 없어요"
                    description="첫 메시지를 보내 대화를 시작해 보세요."
                  />
                ) : (
                  messages.map((message, index) => {
                    const previousMessage = messages[index - 1];
                    const messageCreatedAt = getMessageCreatedAtValue(message);
                    const shouldShowDateDivider =
                      previousMessage === undefined ||
                      !isSameDate(
                        getMessageCreatedAtValue(previousMessage),
                        messageCreatedAt,
                      );
                    const senderId = getPositiveInteger(message.senderId);

                    return (
                      <Fragment key={getMessageId(message)}>
                        {shouldShowDateDivider ? (
                          <DateDivider date={messageCreatedAt} />
                        ) : null}
                        <MessageBubble
                          message={message}
                          isMine={senderId !== null && senderId === currentUserId}
                          senderLabel={getMessageSenderLabel({
                            senderId,
                            currentUserId,
                            opponentName: currentOpponentName,
                          })}
                        />
                      </Fragment>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            <div className="border-t border-[#eee8ff] bg-white/95 px-4 py-4 sm:px-6">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label htmlFor="chat-message" className="sr-only">
                  메시지 입력
                </label>
                <div className="flex h-12 flex-1 items-center gap-3 rounded-lg border border-[#ded6ff] bg-white px-4 transition focus-within:border-[#8c5bff] focus-within:ring-4 focus-within:ring-[#f4f0ff]">
                  <MessageCircle
                    className="size-5 text-[#8c5bff]"
                    aria-hidden="true"
                  />
                  <input
                    id="chat-message"
                    value={messageInput}
                    onChange={(event) => setMessageInput(event.target.value)}
                    maxLength={1000}
                    disabled={
                      currentRoom === null ||
                      currentUserId === null ||
                      !isConnectedToSocket
                    }
                    className="field h-full flex-1 border-0 bg-transparent text-sm font-semibold text-zinc-950 outline-none placeholder:text-zinc-400 disabled:bg-transparent"
                    placeholder={
                      isConnectedToSocket
                        ? "메시지를 입력해 주세요."
                        : "WebSocket 연결 후 메시지를 입력할 수 있습니다."
                    }
                  />
                </div>
                <button
                  type="submit"
                  disabled={
                    currentRoom === null ||
                    currentUserId === null ||
                    !isConnectedToSocket ||
                    messageInput.trim().length === 0 ||
                    isSending
                  }
                  className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#8c5bff] px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(140,91,255,0.22)] transition hover:bg-[#7c4eff] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none sm:w-auto"
                >
                  <Send className="size-4" aria-hidden="true" />
                  {isSending ? "전송 중" : "보내기"}
                </button>
              </form>
              <p className="mt-2 text-right text-xs font-semibold text-zinc-400">
                {messageInput.length}/1000
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function SocketStatusBadge({ isConnected }: { isConnected: boolean }) {
  return (
    <span
      className={`inline-flex h-9 shrink-0 items-center justify-center rounded-full border px-4 text-xs font-black sm:text-sm ${
        isConnected
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-[#ded6ff] bg-white text-zinc-500"
      }`}
    >
      {isConnected ? "WebSocket 연결됨" : "WebSocket 연결 대기"}
    </span>
  );
}

function ChatRoomListButton({
  room,
  currentUserId,
  isActive,
  onSelect,
}: {
  room: ChatRoomListItem;
  currentUserId: number | null;
  isActive: boolean;
  onSelect: () => void;
}) {
  const opponentName = room.opponentNickname?.trim() || "상대방";
  const listDate = formatChatRoomListDate(room.lastMessageAt ?? room.createdAt);
  const talentLines = getChatRoomTalentLines(room, currentUserId);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex w-full cursor-pointer gap-3 px-5 py-5 text-left transition ${isActive ? "bg-[#f4f0ff]" : "bg-white/70 hover:bg-white"
        }`}
    >
      <span
        className={`absolute bottom-0 left-0 top-0 w-1 transition ${isActive ? "bg-[#8c5bff]" : "bg-transparent group-hover:bg-[#ded6ff]"
          }`}
        aria-hidden="true"
      />
      <ChatRoomAvatar
        imageUrl={room.opponentProfileImageUrl}
        name={opponentName}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-black text-zinc-950">
            {opponentName}
          </p>
          <p className="shrink-0 text-xs font-semibold text-zinc-400">
            {listDate}
          </p>
        </div>
        <div className="mt-1 space-y-0.5">
          {talentLines.map((line) => (
            <p
              key={line.label}
              className="truncate text-xs font-semibold text-zinc-500"
              title={`${line.label}: ${line.value}`}
            >
              <span className="font-black text-zinc-600">{line.label}</span>
              <span aria-hidden="true">: </span>
              <span>{line.value}</span>
            </p>
          ))}
        </div>
        <p className="mt-2 truncate text-sm text-zinc-600">
          {room.lastMessage ?? "아직 메시지가 없습니다."}
        </p>
        <span className="mt-3 inline-flex rounded-full border border-[#ded6ff] bg-white px-2.5 py-1 text-[11px] font-black text-[#8c5bff]">
          {getRoomStatusLabel(room.roomType)}
        </span>
      </div>
    </button>
  );
}

function ChatRoomAvatar({
  imageUrl,
  name,
}: {
  imageUrl: string | null;
  name: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={`${name} 프로필 이미지`}
        className="h-11 w-11 shrink-0 rounded-full border border-[#ded6ff] object-cover"
      />
    );
  }

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#ded6ff] bg-[#f4f0ff] text-sm font-black text-[#8c5bff]">
      {getInitial(name)}
    </div>
  );
}

function DateDivider({ date }: { date: string }) {
  return (
    <div className="flex justify-center py-2">
      <span className="rounded-full border border-[#ded6ff] bg-white px-3 py-1 text-xs font-bold text-zinc-500">
        {formatDateDivider(date)}
      </span>
    </div>
  );
}

function MessageBubble({
  message,
  isMine,
  senderLabel,
}: {
  message: ChatMessageRes;
  isMine: boolean;
  senderLabel: string;
}) {
  const shouldShowUnreadCount = isMine && !message.read;
  const createdAt = getMessageCreatedAtValue(message);
  const content = getMessageContent(message) || "메시지 내용이 없습니다.";

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <div
        className={`flex w-full items-end gap-2 ${isMine ? "justify-end" : "justify-start"
          }`}
      >
        {isMine ? (
          <MessageMeta
            createdAt={createdAt}
            shouldShowUnreadCount={shouldShowUnreadCount}
            isMine={isMine}
          />
        ) : null}

        <div
          className={`max-w-[86%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[72%] ${isMine
            ? "bg-[#8c5bff] text-white shadow-[0_12px_24px_rgba(140,91,255,0.18)]"
            : "border border-[#eee8ff] bg-white text-zinc-900"
            }`}
        >
          <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-6">
            {content}
          </p>
        </div>

        {!isMine ? (
          <MessageMeta
            createdAt={createdAt}
            shouldShowUnreadCount={false}
            isMine={isMine}
          />
        ) : null}
      </div>

      <p className="mt-1 text-xs font-semibold text-zinc-400">
        {senderLabel}
      </p>
    </div>
  );
}

function MessageMeta({
  createdAt,
  shouldShowUnreadCount,
  isMine,
}: {
  createdAt: string;
  shouldShowUnreadCount: boolean;
  isMine: boolean;
}) {
  return (
    <div
      className={`mb-1 flex shrink-0 flex-col text-[11px] font-semibold leading-4 ${isMine ? "items-end" : "items-start"
        }`}
    >
      {shouldShowUnreadCount ? (
        <span className="font-black text-amber-500">1</span>
      ) : null}
      <span className="text-zinc-400">{formatMessageTime(createdAt)}</span>
    </div>
  );
}
