import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HTML_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 6000;

class LinkPreviewError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "LinkPreviewError";
    this.status = status;
  }
}

interface PreviewMetadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  domain: string;
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
    throw new LinkPreviewError("지원하지 않는 링크 형식입니다.");
  }

  if (url.username || url.password) {
    throw new LinkPreviewError("인증 정보가 포함된 링크는 사용할 수 없습니다.");
  }

  if (isBlockedHostname(url.hostname)) {
    throw new LinkPreviewError("미리보기를 만들 수 없는 링크입니다.");
  }

  const ipType = isIP(url.hostname);
  let addresses: { address: string }[];

  try {
    addresses =
      ipType === 0
        ? await lookup(url.hostname, { all: true })
        : [{ address: url.hostname }];
  } catch {
    throw new LinkPreviewError("링크 주소를 확인하지 못했습니다.", 422);
  }

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateIpAddress(address))
  ) {
    throw new LinkPreviewError("미리보기를 만들 수 없는 링크입니다.");
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

async function fetchWithTimeout(url: URL): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "facebookexternalhit/1.1",
      },
      redirect: "manual",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function getCharset(contentType: string | null): string {
  const matchedCharset = contentType?.match(/charset=([^;]+)/i)?.[1]?.trim();

  return matchedCharset?.replace(/^["']|["']$/g, "") || "utf-8";
}

function createTextDecoder(contentType: string | null): TextDecoder {
  try {
    return new TextDecoder(getCharset(contentType));
  } catch {
    return new TextDecoder("utf-8");
  }
}

async function readLimitedText(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
    throw new LinkPreviewError("미리보기 데이터가 너무 큽니다.", 413);
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    if (value) {
      receivedBytes += value.byteLength;

      if (receivedBytes > MAX_HTML_BYTES) {
        throw new LinkPreviewError("미리보기 데이터가 너무 큽니다.", 413);
      }

      chunks.push(value);
    }
  }

  const mergedChunks = new Uint8Array(receivedBytes);
  let offset = 0;

  chunks.forEach((chunk) => {
    mergedChunks.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return createTextDecoder(response.headers.get("content-type")).decode(
    mergedChunks,
  );
}

async function fetchPreviewHtml(initialUrl: URL): Promise<{
  finalUrl: URL;
  html: string;
}> {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertSafeHttpUrl(currentUrl);

    const response = await fetchWithTimeout(currentUrl);
    const redirectLocation = getRedirectLocation(response, currentUrl);

    if (redirectLocation) {
      currentUrl = redirectLocation;
      continue;
    }

    if (!response.ok) {
      throw new LinkPreviewError("링크 정보를 불러오지 못했습니다.", 422);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase();

    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      throw new LinkPreviewError("미리보기를 만들 수 없는 콘텐츠입니다.", 422);
    }

    return {
      finalUrl: currentUrl,
      html: await readLimitedText(response),
    };
  }

  throw new LinkPreviewError("리다이렉트가 너무 많습니다.", 422);
}

function getTagAttribute(tag: string, attributeName: string): string | null {
  const pattern = new RegExp(
    `${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
    "i",
  );
  const match = tag.match(pattern);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];

  return value ? decodeHtmlEntities(value) : null;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi,
    (_, entity: string) => {
      const normalizedEntity = entity.toLowerCase();

      if (normalizedEntity.startsWith("#x")) {
        const codePoint = Number.parseInt(normalizedEntity.slice(2), 16);

        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : "";
      }

      if (normalizedEntity.startsWith("#")) {
        const codePoint = Number.parseInt(normalizedEntity.slice(1), 10);

        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : "";
      }

      const namedEntities: Record<string, string> = {
        amp: "&",
        apos: "'",
        gt: ">",
        lt: "<",
        nbsp: " ",
        quot: "\"",
      };

      return namedEntities[normalizedEntity] ?? "";
    },
  );
}

function normalizeText(value: string | null): string | null {
  const normalizedValue = value?.replace(/\s+/g, " ").trim();

  return normalizedValue ? normalizedValue : null;
}

function findMetaContent(html: string, keys: string[]): string | null {
  const normalizedKeys = keys.map((key) => key.toLowerCase());
  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => ({
    tag: match[0],
    property: getTagAttribute(match[0], "property")?.toLowerCase(),
    name: getTagAttribute(match[0], "name")?.toLowerCase(),
  }));

  for (const key of normalizedKeys) {
    const matchedTag = metaTags.find(
      ({ property, name }) => property === key || name === key,
    );

    if (!matchedTag) {
      continue;
    }

    const content = normalizeText(getTagAttribute(matchedTag.tag, "content"));

    if (content) {
      return content;
    }
  }

  return null;
}

function findTitleTag(html: string): string | null {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null;

  return normalizeText(title ? decodeHtmlEntities(title) : null);
}

function formatDomain(url: URL): string {
  return normalizeHostname(url.hostname).replace(/^www\./, "");
}

function createSafeAbsoluteUrl(rawUrl: string | null, baseUrl: URL): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl, baseUrl);
    const ipType = isIP(url.hostname);
    const isBlockedIp = ipType !== 0 && isPrivateIpAddress(url.hostname);

    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      !isBlockedHostname(url.hostname) &&
      !isBlockedIp
    ) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function parsePreviewMetadata(html: string, finalUrl: URL): PreviewMetadata {
  const title =
    findMetaContent(html, ["og:title", "twitter:title"]) ?? findTitleTag(html);
  const description = findMetaContent(html, [
    "og:description",
    "twitter:description",
    "description",
  ]);
  const siteName = findMetaContent(html, [
    "og:site_name",
    "application-name",
  ]);
  const image = createSafeAbsoluteUrl(
    findMetaContent(html, [
      "og:image",
      "og:image:url",
      "twitter:image",
      "twitter:image:src",
    ]),
    finalUrl,
  );

  return {
    url: finalUrl.toString(),
    title,
    description,
    image,
    siteName,
    domain: formatDomain(finalUrl),
  };
}

export async function GET(request: NextRequest) {
  try {
    const rawUrl = request.nextUrl.searchParams.get("url");

    if (!rawUrl) {
      throw new LinkPreviewError("링크 URL이 필요합니다.");
    }

    let initialUrl: URL;

    try {
      initialUrl = new URL(rawUrl);
    } catch {
      throw new LinkPreviewError("올바른 링크 URL이 아닙니다.");
    }

    const { finalUrl, html } = await fetchPreviewHtml(initialUrl);
    const metadata = parsePreviewMetadata(html, finalUrl);

    return NextResponse.json(metadata, {
      headers: {
        "cache-control": "public, max-age=300, s-maxage=3600",
      },
    });
  } catch (error) {
    const status = error instanceof LinkPreviewError ? error.status : 500;
    const message =
      error instanceof Error
        ? error.message
        : "링크 미리보기를 만들지 못했습니다.";

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
