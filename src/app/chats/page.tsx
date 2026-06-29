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

function readStoredUserId(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedUserId = window.localStorage.getItem("baton_user_id");
  const userId = storedUserId === null ? NaN : Number(storedUserId);

  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function formatMessageTime(date: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatDateDivider(date: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(date));
}

function isSameDate(left: string, right: string): boolean {
  const leftDate = new Date(left);
  const rightDate = new Date(right);

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
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
  const targetDate = new Date(date);
  const today = new Date();

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
  senderId: number;
  currentUserId: number | null;
  opponentName: string;
}): string {
  if (senderId === currentUserId) {
    return "나";
  }

  return opponentName;
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
  const initialRoomQueryHandledRef = useRef(false);
  const currentRoomId = currentRoom?.id ?? null;
  const currentRoomListItem =
    currentRoomId === null
      ? undefined
      : chatRooms.find((room) => room.roomId === currentRoomId);
  const currentOpponentName =
    currentRoomListItem?.opponentNickname?.trim() || "상대방";
  const currentTalentTitle =
    currentRoomListItem?.talentTitle?.trim() ||
    (currentRoom ? `talentId ${currentRoom.talentId}` : "재능 정보 없음");

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
        setMessages((prevMessages) => {
          const alreadyExists = prevMessages.some(
            (prevMessage) => prevMessage.id === message.id,
          );

          if (alreadyExists) {
            return prevMessages.map((prevMessage) =>
              prevMessage.id === message.id
                ? {
                  ...prevMessage,
                  ...message,
                }
                : prevMessage,
            );
          }

          return [...prevMessages, message];
        });

        const userId = currentUserIdRef.current;
        if (userId !== null && message.senderId !== userId) {
          chatSocketRef.current?.markAsRead();
        }
      },
      onRead: (event) => {
        const readMessageIds = new Set(event.messageIds);

        setMessages((prevMessages) =>
          prevMessages.map((message) =>
            readMessageIds.has(message.id)
              ? {
                ...message,
                read: true,
              }
              : message,
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
      setMessages(response.content);
    } catch (error) {
      setMessages([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "메시지를 불러오지 못했습니다.",
      );
    } finally {
      setIsLoadingMessages(false);
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
      setErrorMessage(null);
      setIsEnteringRoom(true);
      setIsConnectedToSocket(false);

      try {
        const room = await chatApi.getRoom(roomId);

        setCurrentRoom(room);
        setSocketConnectionVersion((version) => version + 1);
        await loadMessages(room.id);
      } catch (error) {
        setCurrentRoom(null);
        setMessages([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "채팅방에 입장하지 못했습니다.",
        );
      } finally {
        setIsEnteringRoom(false);
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
    <main className="relative min-h-[calc(100dvh-64px)] overflow-hidden bg-white">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#f4f0ff] blur-3xl" />

      <div className="fixed-container relative py-10">
        <header className="mx-auto mb-12 max-w-3xl text-center">
          <h1 className="mt-4 text-5xl font-black tracking-normal text-zinc-950">
            CHATING
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-8 text-zinc-600">
            매칭과 거래에서 이어진 대화를 한 곳에서 확인하고 실시간으로 메시지를 주고받으세요.
          </p>
          <div
            className={`mx-auto mt-5 inline-flex rounded-full px-4 py-2 text-sm font-black ${isConnectedToSocket
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-[#ded6ff] bg-white/90 text-zinc-500"
            }`}
          >
            {isConnectedToSocket ? "WebSocket 연결됨" : "WebSocket 연결 대기"}
          </div>
        </header>

        <div className="relative grid h-[720px] min-h-0 grid-cols-[340px_1fr] overflow-hidden rounded-lg border border-[#ded6ff] bg-white/95 shadow-[0_28px_80px_rgba(80,60,160,0.12)] backdrop-blur">
          <div
            className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]"
            aria-hidden="true"
          />
          <aside className="flex min-h-0 flex-col border-r border-[#eee8ff] bg-[#fbf9ff]/70">
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

        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="border-b border-[#eee8ff] px-6 py-5">
            {!hasCheckedUserId ? (
              <p className="text-xs font-semibold text-zinc-500">
                사용자 정보를 확인하는 중입니다.
              </p>
            ) : currentUserId === null ? (
              <p className="text-sm font-semibold text-amber-700">
                로그인 후 이용해 주세요.
              </p>
            ) : currentRoom ? (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-zinc-950">
                    {currentOpponentName}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-zinc-500">
                    {currentTalentTitle}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-[#d9ccff] bg-[#f4f0ff] px-3 py-1 text-xs font-black text-[#8c5bff]">
                  {getRoomStatusLabel(currentRoom.status)}
                </span>
              </div>
            ) : (
              <div>
                <p className="text-lg font-black text-zinc-950">
                  채팅방을 선택해 주세요
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-500">
                  왼쪽 목록에서 대화를 선택하면 메시지를 확인할 수 있습니다.
                </p>
              </div>
            )}
          </div>

          {errorMessage ? (
            <div className="px-6 pt-4">
              <ErrorState message={errorMessage} />
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbf9ff]/60 px-6 py-6 [scrollbar-gutter:stable]">
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
                  const shouldShowDateDivider =
                    previousMessage === undefined ||
                    !isSameDate(previousMessage.createdAt, message.createdAt);

                  return (
                    <Fragment key={message.id}>
                      {shouldShowDateDivider ? (
                        <DateDivider date={message.createdAt} />
                      ) : null}
                      <MessageBubble
                        message={message}
                        isMine={message.senderId === currentUserId}
                        senderLabel={getMessageSenderLabel({
                          senderId: message.senderId,
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

          <div className="border-t border-[#eee8ff] bg-white/95 px-6 py-4">
            <form onSubmit={handleSubmit} className="flex items-center gap-3">
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
                className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg bg-[#8c5bff] px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(140,91,255,0.22)] transition hover:bg-[#7c4eff] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
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

function ChatRoomListButton({
  room,
  isActive,
  onSelect,
}: {
  room: ChatRoomListItem;
  isActive: boolean;
  onSelect: () => void;
}) {
  const opponentName = room.opponentNickname?.trim() || "상대방";
  const listDate = formatChatRoomListDate(room.lastMessageAt ?? room.createdAt);

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
        <p className="mt-1 truncate text-xs font-semibold text-zinc-500">
          {room.talentTitle ?? "재능 정보 없음"}
        </p>
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

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <div
        className={`flex w-full items-end gap-2 ${isMine ? "justify-end" : "justify-start"
          }`}
      >
        {isMine ? (
          <MessageMeta
            createdAt={message.createdAt}
            shouldShowUnreadCount={shouldShowUnreadCount}
            isMine={isMine}
          />
        ) : null}

        <div
          className={`max-w-[72%] rounded-2xl px-4 py-3 shadow-sm ${isMine
              ? "bg-[#8c5bff] text-white shadow-[0_12px_24px_rgba(140,91,255,0.18)]"
              : "border border-[#eee8ff] bg-white text-zinc-900"
            }`}
        >
          <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-6">
            {message.content}
          </p>
        </div>

        {!isMine ? (
          <MessageMeta
            createdAt={message.createdAt}
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
