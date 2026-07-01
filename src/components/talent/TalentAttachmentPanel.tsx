"use client";

import {
  ExternalLink,
  Image as ImageIcon,
  Link2,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { talentApi, type TalentAttachmentRes } from "@/lib/api";
import { formatDate } from "@/utils/format";

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|webp|gif)$/i;

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "PNG, JPEG, WEBP, GIF 이미지만 업로드할 수 있습니다. SVG는 지원하지 않습니다.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "첨부파일은 5MB 이하만 업로드할 수 있습니다.";
  }

  return null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isImageAttachmentUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return IMAGE_EXTENSION_PATTERN.test(url.pathname);
  } catch {
    const pathWithoutQuery = value.split("?")[0]?.split("#")[0] ?? value;

    return IMAGE_EXTENSION_PATTERN.test(pathWithoutQuery);
  }
}

type AttachmentMode = "file" | "link";

interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  domain: string;
}

const linkPreviewCache = new Map<string, Promise<LinkPreviewData | null>>();

function normalizePreviewString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeLinkPreviewPayload(payload: unknown): LinkPreviewData | null {
  if (payload === null || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const url = normalizePreviewString(record.url);
  const domain = normalizePreviewString(record.domain);

  if (!url || !domain) {
    return null;
  }

  return {
    url,
    domain,
    title: normalizePreviewString(record.title),
    description: normalizePreviewString(record.description),
    image: normalizePreviewString(record.image),
    siteName: normalizePreviewString(record.siteName),
  };
}

function getAttachmentDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "외부 링크";
  }
}

async function requestLinkPreview(url: string): Promise<LinkPreviewData | null> {
  const response = await fetch(
    `/api/link-preview?url=${encodeURIComponent(url)}`,
    {
      cache: "force-cache",
      credentials: "same-origin",
    },
  );

  if (!response.ok) {
    return null;
  }

  return normalizeLinkPreviewPayload(await response.json());
}

function getLinkPreview(url: string): Promise<LinkPreviewData | null> {
  const cachedPreview = linkPreviewCache.get(url);

  if (cachedPreview) {
    return cachedPreview;
  }

  const previewRequest = requestLinkPreview(url).catch(() => null);
  linkPreviewCache.set(url, previewRequest);

  return previewRequest;
}

function useLinkPreview(url: string, enabled: boolean) {
  const [state, setState] = useState<{
    url: string;
    preview: LinkPreviewData | null;
    isLoading: boolean;
  }>({
    url: "",
    preview: null,
    isLoading: false,
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let ignore = false;

    queueMicrotask(() => {
      if (!ignore) {
        setState({
          url,
          preview: null,
          isLoading: true,
        });
      }
    });

    void getLinkPreview(url)
      .then((nextPreview) => {
        if (!ignore) {
          setState({
            url,
            preview: nextPreview,
            isLoading: false,
          });
        }
      })
      .catch(() => {
        if (!ignore) {
          setState({
            url,
            preview: null,
            isLoading: false,
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, [enabled, url]);

  if (!enabled) {
    return { preview: null, isLoading: false };
  }

  if (state.url !== url) {
    return { preview: null, isLoading: true };
  }

  return { preview: state.preview, isLoading: state.isLoading };
}

export function TalentAttachmentPanel({
  talentId,
  isOwner,
}: {
  talentId: number;
  isOwner: boolean;
}) {
  const [attachments, setAttachments] = useState<TalentAttachmentRes[]>([]);
  const [mode, setMode] = useState<AttachmentMode>("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [description, setDescription] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<
    number | null
  >(null);

  const loadAttachments = useCallback(async () => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const nextAttachments = await talentApi.getAttachments(talentId);
      setAttachments(Array.isArray(nextAttachments) ? nextAttachments : []);
    } catch (error) {
      setAttachments([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "첨부파일 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [talentId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAttachments();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadAttachments]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSuccessMessage("");

    if (file === null) {
      setSelectedFile(null);
      return;
    }

    const validationMessage = validateImageFile(file);
    if (validationMessage) {
      event.target.value = "";
      setSelectedFile(null);
      setErrorMessage(validationMessage);
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isOwner) {
      setErrorMessage("작성자만 첨부파일을 관리할 수 있습니다.");
      return;
    }

    if (selectedFile === null) {
      setErrorMessage("업로드할 이미지 파일을 선택해 주세요.");
      return;
    }

    const validationMessage = validateImageFile(selectedFile);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setErrorMessage(null);
    setSuccessMessage("");
    setIsUploading(true);

    try {
      const presigned = await talentApi.createAttachmentPresignedUrl(talentId, {
        fileName: selectedFile.name,
        contentType: selectedFile.type,
      });

      await talentApi.uploadFileToPresignedUrl(
        presigned.uploadUrl,
        selectedFile,
      );

      await talentApi.saveAttachment(talentId, {
        url: presigned.key,
        description: description.trim() || null,
      });

      setSelectedFile(null);
      setFileInputKey((currentKey) => currentKey + 1);
      setDescription("");
      setSuccessMessage("첨부파일이 등록되었습니다.");
      await loadAttachments();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "첨부파일 업로드에 실패했습니다.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: number) {
    if (!isOwner) {
      setErrorMessage("작성자만 첨부파일을 삭제할 수 있습니다.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage("");
    setDeletingAttachmentId(attachmentId);

    try {
      await talentApi.deleteAttachment(talentId, attachmentId);
      setSuccessMessage("첨부파일이 삭제되었습니다.");
      await loadAttachments();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "첨부파일을 삭제하지 못했습니다.",
      );
    } finally {
      setDeletingAttachmentId(null);
    }
  }

  async function handleSaveLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isOwner) {
      setErrorMessage("작성자만 외부 참고 링크를 저장할 수 있습니다.");
      return;
    }

    const nextLinkUrl = linkUrl.trim();
    if (!nextLinkUrl) {
      setErrorMessage("저장할 외부 참고 링크를 입력해 주세요.");
      return;
    }

    if (!isHttpUrl(nextLinkUrl)) {
      setErrorMessage("외부 참고 링크는 http:// 또는 https://로 시작해야 합니다.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage("");
    setIsUploading(true);

    try {
      await talentApi.saveAttachment(talentId, {
        url: nextLinkUrl,
        description: description.trim() || null,
      });
      setLinkUrl("");
      setDescription("");
      setSuccessMessage("외부 참고 링크가 등록되었습니다.");
      await loadAttachments();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "외부 참고 링크를 저장하지 못했습니다.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[#ded6ff] bg-white shadow-sm shadow-violet-950/[0.04]">
      <div
        className="h-1 bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]"
        aria-hidden="true"
      />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8c5bff]">
              Preview
            </p>
            <h2 className="mt-2 text-xl font-black text-zinc-950">
              포트폴리오 미리보기
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-500">
              재능을 설명하는 이미지와 외부 참고 링크를 확인할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAttachments}
            disabled={isLoading}
            title="첨부 새로고침"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#ded6ff] bg-white px-4 text-sm font-black text-[#8c5bff] shadow-sm shadow-violet-950/[0.03] transition hover:border-[#8c5bff] hover:bg-[#fbf9ff] disabled:opacity-60"
          >
            <RefreshCw
              className={`size-4 ${isLoading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {isLoading ? "불러오는 중" : "새로고침"}
          </button>
        </div>

        {errorMessage ? (
          <div className="mt-5">
            <ErrorState message={errorMessage} />
          </div>
        ) : null}

        {successMessage ? (
          <p
            aria-live="polite"
            className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-black text-emerald-700"
          >
            {successMessage}
          </p>
        ) : null}

        <div className="mt-6">
          {isLoading ? (
            <div className="rounded-lg border border-dashed border-[#ded6ff] bg-[#fbf9ff] p-8 text-center text-sm font-black text-zinc-500">
              첨부파일을 불러오는 중입니다.
            </div>
          ) : attachments.length === 0 ? (
            <EmptyState
              title="등록된 포트폴리오가 없습니다."
              description={
                isOwner
                  ? "이미지나 외부 링크를 추가하면 다른 사용자가 재능 예시를 미리 볼 수 있어요."
                  : "작성자가 이미지나 참고 링크를 등록하면 이 영역에 표시됩니다."
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {attachments.map((attachment) => (
                <AttachmentPreviewCard
                  key={attachment.attachmentId}
                  attachment={attachment}
                  isDeleting={
                    deletingAttachmentId === attachment.attachmentId
                  }
                  isOwner={isOwner}
                  onDelete={handleDeleteAttachment}
                />
              ))}
            </div>
          )}
        </div>

        {isOwner ? (
          <div className="mt-6 rounded-lg border border-[#ded6ff] bg-[#fbf9ff] p-4 sm:p-5">
            <div className="flex gap-2 rounded-lg border border-[#ded6ff] bg-white p-1">
              {[
                { value: "file" as const, label: "파일 업로드" },
                { value: "link" as const, label: "외부 링크" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setMode(item.value);
                    setErrorMessage(null);
                    setSuccessMessage("");
                  }}
                  className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-black transition ${
                    mode === item.value
                      ? "bg-[#8c5bff] text-white shadow-sm shadow-violet-500/20"
                      : "text-zinc-500 hover:bg-[#fbf9ff] hover:text-[#8c5bff]"
                  }`}
                >
                  {item.value === "file" ? (
                    <UploadCloud className="size-4" aria-hidden="true" />
                  ) : (
                    <Link2 className="size-4" aria-hidden="true" />
                  )}
                  {item.label}
                </button>
              ))}
            </div>

            {mode === "file" ? (
              <form onSubmit={handleUpload} className="mt-5">
                <p className="font-black text-zinc-950">이미지 업로드</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">
                  PNG, JPEG, WEBP, GIF 이미지만 가능하며 최대 5MB까지 업로드할 수
                  있습니다.
                </p>
                <div className="mt-4 grid gap-4">
                  <label className="block text-sm font-black text-zinc-800">
                    이미지 파일
                    <input
                      key={fileInputKey}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleFileChange}
                      className="mt-2 block w-full text-sm font-semibold text-zinc-700 file:mr-4 file:h-10 file:rounded-lg file:border-0 file:bg-zinc-950 file:px-4 file:text-sm file:font-black file:text-white"
                    />
                  </label>
                  <AttachmentDescriptionField
                    value={description}
                    onChange={setDescription}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isUploading || selectedFile === null}
                  className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-5 text-sm font-black text-white transition hover:bg-zinc-800 disabled:opacity-60"
                >
                  <UploadCloud className="size-4" aria-hidden="true" />
                  {isUploading ? "업로드 중" : "이미지 등록"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSaveLink} className="mt-5">
                <p className="font-black text-zinc-950">외부 참고 링크</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">
                  작업 예시, 포트폴리오, 참고 문서 링크를 저장할 수 있습니다.
                </p>
                <div className="mt-4 grid gap-4">
                  <label className="block text-sm font-black text-zinc-800">
                    링크 URL
                    <input
                      value={linkUrl}
                      onChange={(event) => setLinkUrl(event.target.value)}
                      placeholder="https://example.com/reference"
                      className="form-input mt-2 h-11 rounded-lg border-[#d9ccff] bg-white px-4 text-sm font-semibold focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff]"
                    />
                  </label>
                  <AttachmentDescriptionField
                    value={description}
                    onChange={setDescription}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isUploading || linkUrl.trim().length === 0}
                  className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-5 text-sm font-black text-white transition hover:bg-zinc-800 disabled:opacity-60"
                >
                  <Link2 className="size-4" aria-hidden="true" />
                  {isUploading ? "저장 중" : "링크 등록"}
                </button>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AttachmentPreviewCard({
  attachment,
  isDeleting,
  isOwner,
  onDelete,
}: {
  attachment: TalentAttachmentRes;
  isDeleting: boolean;
  isOwner: boolean;
  onDelete: (attachmentId: number) => void;
}) {
  const isImage = isImageAttachmentUrl(attachment.url);
  const { preview, isLoading: isPreviewLoading } = useLinkPreview(
    attachment.url,
    !isImage,
  );
  const domain = preview?.domain ?? getAttachmentDomain(attachment.url);
  const title = isImage
    ? (attachment.description ?? "설명이 없습니다.")
    : (preview?.title ?? attachment.description ?? domain);
  const description = !isImage ? preview?.description : null;
  const memo =
    !isImage && preview?.title && attachment.description
      ? attachment.description
      : null;

  return (
    <article className="overflow-hidden rounded-lg border border-[#ded6ff] bg-white shadow-sm shadow-violet-950/[0.03]">
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="group block"
      >
        {isImage ? (
          <div className="relative aspect-[16/10] overflow-hidden bg-[#fbf9ff]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.url}
              alt={attachment.description ?? "포트폴리오 미리보기 이미지"}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          </div>
        ) : (
          <LinkPreviewMedia
            domain={domain}
            isLoading={isPreviewLoading}
            preview={preview}
          />
        )}
      </a>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[#f4f0ff] px-2.5 py-1 text-xs font-black text-[#8c5bff]">
              {isImage ? (
                <ImageIcon className="size-3.5" aria-hidden="true" />
              ) : (
                <Link2 className="size-3.5" aria-hidden="true" />
              )}
              {isImage ? "이미지" : (preview?.siteName ?? "링크")}
            </p>
            <p className="mt-3 break-words text-sm font-black leading-6 text-zinc-950">
              {title}
            </p>
            {description ? (
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-500">
                {description}
              </p>
            ) : null}
            {memo ? (
              <p className="mt-3 rounded-lg bg-[#fbf9ff] p-3 text-xs font-bold leading-5 text-zinc-500">
                메모: {memo}
              </p>
            ) : null}
            <p className="mt-2 text-xs font-semibold text-zinc-400">
              {isImage ? "등록일" : domain} · {formatDate(attachment.createdAt)}
            </p>
          </div>
          <a
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            title="새 창에서 열기"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#ded6ff] bg-white text-[#8c5bff] transition hover:border-[#8c5bff] hover:bg-[#fbf9ff]"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        </div>
        {isOwner ? (
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => onDelete(attachment.attachmentId)}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {isDeleting ? "삭제 중" : "삭제"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function LinkPreviewMedia({
  domain,
  isLoading,
  preview,
}: {
  domain: string;
  isLoading: boolean;
  preview: LinkPreviewData | null;
}) {
  const imageUrl = preview?.image ?? null;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex aspect-[16/10] animate-pulse flex-col items-center justify-center gap-3 bg-[linear-gradient(135deg,#fbf9ff_0%,#eef8ff_100%)] text-[#8c5bff]">
        <Link2 className="size-9" aria-hidden="true" />
        <span className="text-xs font-black">미리보기 불러오는 중</span>
      </div>
    );
  }

  if (imageUrl && failedImageUrl !== imageUrl) {
    return (
      <div className="relative aspect-[16/10] overflow-hidden bg-[#fbf9ff]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={preview?.title ?? "링크 미리보기 이미지"}
          onError={() => setFailedImageUrl(imageUrl)}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        />
      </div>
    );
  }

  return (
    <div className="flex aspect-[16/10] flex-col items-center justify-center gap-3 bg-[linear-gradient(135deg,#fbf9ff_0%,#eef8ff_100%)] px-5 text-center text-[#8c5bff]">
      <Link2 className="size-10" aria-hidden="true" />
      <span className="max-w-full truncate text-xs font-black text-zinc-500">
        {domain}
      </span>
    </div>
  );
}

function AttachmentDescriptionField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-black text-zinc-800">
      설명
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        maxLength={200}
        className="form-input mt-2 min-h-24 resize-none rounded-lg border-[#d9ccff] bg-white px-4 py-3 text-sm font-semibold focus:border-[#8c5bff] focus:ring-4 focus:ring-[#f4f0ff]"
        placeholder="첨부 설명을 입력해 주세요."
      />
    </label>
  );
}
