import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 6000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

class LinkPreviewImageError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "LinkPreviewImageError";
    this.status = status;
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/\.$/, "").toLowerCase();
}

function isBlockedHostname(hostname: string): boolean {
  const normalizedHostname = normalizeHostname(hostname);

  return (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    normalizedHostname.endsWith(".local")
  );
}

function parseIPv4Parts(address: string): number[] | null {
  const parts = address.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }

  return parts;
}

function isPrivateIPv4(address: string): boolean {
  const parts = parseIPv4Parts(address);

  if (parts === null) {
    return true;
  }

  const [first, second] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

function isPrivateIPv6(address: string): boolean {
  const normalizedAddress = address.toLowerCase();
  const mappedIPv4 = normalizedAddress.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);

  if (mappedIPv4?.[1]) {
    return isPrivateIPv4(mappedIPv4[1]);
  }

  const firstHextet = Number.parseInt(normalizedAddress.split(":")[0] ?? "", 16);

  return (
    normalizedAddress === "::" ||
    normalizedAddress === "::1" ||
    normalizedAddress.startsWith("ff") ||
    normalizedAddress.startsWith("fc") ||
    normalizedAddress.startsWith("fd") ||
    (Number.isInteger(firstHextet) && (firstHextet & 0xffc0) === 0xfe80)
  );
}

function isPrivateIpAddress(address: string): boolean {
  const ipType = isIP(address);

  if (ipType === 4) {
    return isPrivateIPv4(address);
  }

  if (ipType === 6) {
    return isPrivateIPv6(address);
  }

  return true;
}

async function assertSafeHttpUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new LinkPreviewImageError("지원하지 않는 이미지 링크입니다.");
  }

  if (url.username || url.password) {
    throw new LinkPreviewImageError(
      "인증 정보가 포함된 이미지는 사용할 수 없습니다.",
    );
  }

  if (isBlockedHostname(url.hostname)) {
    throw new LinkPreviewImageError("미리보기 이미지를 불러올 수 없습니다.");
  }

  const ipType = isIP(url.hostname);
  let addresses: { address: string }[];

  try {
    addresses =
      ipType === 0
        ? await lookup(url.hostname, { all: true })
        : [{ address: url.hostname }];
  } catch {
    throw new LinkPreviewImageError("이미지 주소를 확인하지 못했습니다.", 422);
  }

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateIpAddress(address))
  ) {
    throw new LinkPreviewImageError("미리보기 이미지를 불러올 수 없습니다.");
  }
}

function getRedirectLocation(response: Response, currentUrl: URL): URL | null {
  if (response.status < 300 || response.status >= 400) {
    return null;
  }

  const location = response.headers.get("location");

  if (!location) {
    return null;
  }

  return new URL(location, currentUrl);
}

async function fetchImage(url: URL): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (compatible; BatonLinkPreview/1.0; +https://baton.local)",
      },
      redirect: "manual",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchPreviewImage(initialUrl: URL): Promise<Response> {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertSafeHttpUrl(currentUrl);

    const response = await fetchImage(currentUrl);
    const redirectLocation = getRedirectLocation(response, currentUrl);

    if (redirectLocation) {
      currentUrl = redirectLocation;
      continue;
    }

    if (!response.ok) {
      throw new LinkPreviewImageError(
        "미리보기 이미지를 불러오지 못했습니다.",
        422,
      );
    }

    return response;
  }

  throw new LinkPreviewImageError("이미지 리다이렉트가 너무 많습니다.", 422);
}

function assertImageResponse(response: Response): string {
  const contentType = response.headers.get("content-type")?.toLowerCase();

  if (!contentType?.startsWith("image/")) {
    throw new LinkPreviewImageError("이미지 콘텐츠가 아닙니다.", 422);
  }

  const contentLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    throw new LinkPreviewImageError("미리보기 이미지가 너무 큽니다.", 413);
  }

  return contentType;
}

export async function GET(request: NextRequest) {
  try {
    const rawUrl = request.nextUrl.searchParams.get("url");

    if (!rawUrl) {
      throw new LinkPreviewImageError("이미지 URL이 필요합니다.");
    }

    let initialUrl: URL;

    try {
      initialUrl = new URL(rawUrl);
    } catch {
      throw new LinkPreviewImageError("올바른 이미지 URL이 아닙니다.");
    }

    const response = await fetchPreviewImage(initialUrl);
    const contentType = assertImageResponse(response);
    const imageBuffer = await response.arrayBuffer();

    if (imageBuffer.byteLength > MAX_IMAGE_BYTES) {
      throw new LinkPreviewImageError("미리보기 이미지가 너무 큽니다.", 413);
    }

    return new NextResponse(imageBuffer, {
      headers: {
        "cache-control": "public, max-age=86400, s-maxage=604800",
        "content-type": contentType,
      },
    });
  } catch (error) {
    const status =
      error instanceof LinkPreviewImageError ? error.status : 500;
    const message =
      error instanceof Error
        ? error.message
        : "미리보기 이미지를 불러오지 못했습니다.";

    return NextResponse.json(
      { message },
      {
        status,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }
}
