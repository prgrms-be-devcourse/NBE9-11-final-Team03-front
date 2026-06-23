"use client";

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
import { hasStoredAccessToken } from "@/lib/auth";
import { formatDate } from "@/utils/format";

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "PNG, JPEG, WEBP, GIF 이미지만 업로드할 수 있습니다. SVG는 지원하지 않습니다.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "첨부파일은 5MB 이하만 업로드할 수 있습니다.";
  }

  return null;
}

export function TalentAttachmentPanel({ talentId }: { talentId: number }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [attachments, setAttachments] = useState<TalentAttachmentRes[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
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
      setIsLoggedIn(hasStoredAccessToken());
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

    if (!isLoggedIn) {
      setErrorMessage("로그인 후 이용해 주세요.");
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
    if (!isLoggedIn) {
      setErrorMessage("로그인 후 이용해 주세요.");
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

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6">
      <div className="flex items-start justify-between gap-5">
        <div>
          <h2 className="text-xl font-black text-zinc-950">첨부파일</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            재능을 설명하는 이미지 파일을 확인할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={loadAttachments}
          disabled={isLoading}
          className="h-10 rounded-md border border-zinc-300 px-4 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
        >
          {isLoading ? "불러오는 중" : "새로고침"}
        </button>
      </div>

      {errorMessage ? (
        <div className="mt-5">
          <ErrorState message={errorMessage} />
        </div>
      ) : null}

      {successMessage ? (
        <p className="mt-5 rounded-md bg-teal-50 p-3 text-sm font-semibold text-teal-700">
          {successMessage}
        </p>
      ) : null}

      <div className="mt-6">
        {isLoading ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center text-sm font-semibold text-zinc-600">
            첨부파일을 불러오는 중입니다.
          </div>
        ) : attachments.length === 0 ? (
          <EmptyState title="등록된 첨부파일이 없습니다." />
        ) : (
          <div className="grid gap-3">
            {attachments.map((attachment) => (
              <div
                key={attachment.attachmentId}
                className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 p-4"
              >
                <div className="min-w-0">
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-sm font-black text-teal-700 transition hover:text-teal-900"
                  >
                    첨부파일 #{attachment.attachmentId} 열기
                  </a>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {attachment.description ?? "설명이 없습니다."}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-zinc-400">
                    등록일 {formatDate(attachment.createdAt)}
                  </p>
                </div>
                {isLoggedIn ? (
                  <button
                    type="button"
                    disabled={deletingAttachmentId === attachment.attachmentId}
                    onClick={() =>
                      handleDeleteAttachment(attachment.attachmentId)
                    }
                    className="h-9 shrink-0 rounded-md border border-red-200 px-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {deletingAttachmentId === attachment.attachmentId
                      ? "삭제 중"
                      : "삭제"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoggedIn ? (
        <form
          onSubmit={handleUpload}
          className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5"
        >
          <p className="font-black text-zinc-950">첨부파일 업로드</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            PNG, JPEG, WEBP, GIF 이미지만 가능하며 최대 5MB까지 업로드할 수
            있습니다.
          </p>
          <div className="mt-4 grid gap-4">
            <label className="block text-sm font-semibold text-zinc-800">
              이미지 파일
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="mt-2 block w-full text-sm text-zinc-700 file:mr-4 file:h-10 file:rounded-md file:border-0 file:bg-zinc-950 file:px-4 file:text-sm file:font-bold file:text-white"
              />
            </label>
            <label className="block text-sm font-semibold text-zinc-800">
              설명
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={200}
                className="form-input mt-2 min-h-24 resize-none"
                placeholder="첨부파일 설명을 입력해 주세요."
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={isUploading || selectedFile === null}
            className="mt-4 h-10 rounded-md bg-zinc-950 px-5 text-sm font-bold text-white transition hover:bg-zinc-700 disabled:opacity-60"
          >
            {isUploading ? "업로드 중" : "첨부파일 등록"}
          </button>
        </form>
      ) : (
        <p className="mt-6 rounded-lg bg-zinc-50 p-4 text-sm font-semibold text-zinc-500">
          첨부파일 업로드와 삭제는 로그인 후 이용할 수 있습니다.
        </p>
      )}
    </section>
  );
}
