import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../errors/AppError";

const WP_STATUSES = ["draft", "publish", "pending", "private"] as const;
export type WpPostStatus = (typeof WP_STATUSES)[number];

export function isWpPostStatus(s: string): s is WpPostStatus {
  return (WP_STATUSES as readonly string[]).includes(s);
}

export function normalizeWpBaseUrl(raw: string): string {
  let u = raw.trim();
  if (!u) throw new AppError(400, "WordPress site URL is required");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/+$/, "");
}

/**
 * WordPress shows application passwords with spaces for readability; those spaces are NOT part of the secret.
 * Users often paste including spaces → invalid password.
 */
export function normalizeWpApplicationPassword(raw: string): string {
  return raw.replace(/\s+/g, "");
}

function basicAuthHeader(user: string, pass: string): { Authorization: string } {
  const token = Buffer.from(`${user}:${pass}`, "utf8").toString("base64");
  return { Authorization: `Basic ${token}` };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function looksLikeHtmlResponse(s: string): boolean {
  const t = s.trim().slice(0, 800).toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || /^[\s\n]*</.test(t);
}

/** Never append raw HTML to user-facing errors. */
function wordPressErrorDetail(body: string): string {
  const t = body.trim();
  if (!t) return "";
  if (looksLikeHtmlResponse(t)) {
    return " Server returned an HTML page instead of JSON — /wp-json may be blocked, REST limited by a security plugin, or the host strips Authorization. Try ?rest_route= (handled automatically) or allow HTTP_AUTHORIZATION on nginx/php-fpm.";
  }
  try {
    const j = JSON.parse(t) as { message?: string; code?: string };
    if (j.message) return ` ${j.message}`;
    if (j.code) return ` (${j.code})`;
  } catch {
    if (t.length < 180) return ` ${t}`;
  }
  return "";
}

/** WordPress often returns this when Basic auth never reached PHP (nginx strips Authorization). */
function wordPressNotLoggedInHint(body: string): string {
  const t = body.toLowerCase();
  if (
    t.includes("not currently logged in") ||
    t.includes("rest_not_logged_in") ||
    t.includes('"code":"rest_not_logged_in"')
  ) {
    return " If username + Application Password are correct, the server may be dropping the Authorization header: nginx → fastcgi_param HTTP_AUTHORIZATION $http_authorization; (or SetEnvIf for Apache). Some hosts also need wp-config.php to copy REDIRECT_HTTP_AUTHORIZATION into HTTP_AUTHORIZATION.";
  }
  return "";
}

/** Coerce Prisma JSON / API values to positive integer IDs. */
export function coerceWpIdArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x > 0);
}

type WpAuth = { root: string; auth: { Authorization: string } };

async function getWpClient(websiteId: string): Promise<WpAuth> {
  const w = await prisma.website.findUnique({ where: { id: websiteId } });
  if (!w) throw new AppError(404, "Website not found");
  const base = w.wpSiteUrl?.trim();
  const user = w.wpUsername?.trim();
  const pass = normalizeWpApplicationPassword(w.wpApplicationPassword ?? "");
  if (!base || !user || !pass) {
    throw new AppError(400, "Configure WordPress URL, username, and application password first.");
  }
  const root = normalizeWpBaseUrl(base);
  return { root, auth: basicAuthHeader(user, pass) };
}

export type WpTestOverrides = {
  wpSiteUrl?: string;
  wpUsername?: string;
  wpApplicationPassword?: string;
};

/** Merge DB + optional form overrides (test can use unsaved URL/user/password). */
async function resolveWpCredentialsForTest(websiteId: string, override?: WpTestOverrides): Promise<WpAuth> {
  const w = await prisma.website.findUnique({ where: { id: websiteId } });
  if (!w) throw new AppError(404, "Website not found");

  const base =
    override?.wpSiteUrl !== undefined && override.wpSiteUrl.trim() !== ""
      ? override.wpSiteUrl.trim()
      : (w.wpSiteUrl?.trim() ?? "");
  const user =
    override?.wpUsername !== undefined && override.wpUsername.trim() !== ""
      ? override.wpUsername.trim()
      : (w.wpUsername?.trim() ?? "");
  const passRaw =
    override?.wpApplicationPassword !== undefined &&
    normalizeWpApplicationPassword(override.wpApplicationPassword) !== ""
      ? override.wpApplicationPassword
      : (w.wpApplicationPassword ?? "");
  const pass = normalizeWpApplicationPassword(passRaw);

  if (!base || !user || !pass) {
    throw new AppError(400, "Configure WordPress URL, username, and application password first.");
  }
  const root = normalizeWpBaseUrl(base);
  return { root, auth: basicAuthHeader(user, pass) };
}

/** e.g. path `/wp/v2/users/me` — some hosts return 404 on `/wp-json`; fallback to `?rest_route=`. */
async function wpFetch(
  root: string,
  auth: { Authorization: string },
  path: string,
  init?: RequestInit
): Promise<Response> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const primary = `${root}/wp-json${p}`;
  const alt = `${root}/?rest_route=${encodeURIComponent(p)}`;
  let res = await fetch(primary, { ...init, headers: { ...auth, ...init?.headers } });
  if (res.status === 404) {
    res = await fetch(alt, { ...init, headers: { ...auth, ...init?.headers } });
  } else if (res.status === 403) {
    const t = await res.clone().text();
    if (looksLikeHtmlResponse(t)) {
      res = await fetch(alt, { ...init, headers: { ...auth, ...init?.headers } });
    }
  }
  return res;
}

async function wpFetchGet(
  root: string,
  auth: { Authorization: string },
  path: string,
  query: Record<string, string | number | boolean>
): Promise<Response> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) qs.set(k, String(v));
  const qStr = qs.toString();
  const pathWithQuery = `${path.startsWith("/") ? path : `/${path}`}${qStr ? `?${qStr}` : ""}`;
  const primary = `${root}/wp-json${pathWithQuery}`;
  const basePath = path.startsWith("/") ? path : `/${path}`;
  const alt = `${root}/?rest_route=${encodeURIComponent(basePath)}${qStr ? `&${qStr}` : ""}`;
  let res = await fetch(primary, { headers: { ...auth } });
  if (res.status === 404) {
    res = await fetch(alt, { headers: { ...auth } });
  } else if (res.status === 403) {
    const t = await res.clone().text();
    if (looksLikeHtmlResponse(t)) {
      res = await fetch(alt, { headers: { ...auth } });
    }
  }
  return res;
}

async function fetchImageBuffer(url: string): Promise<{ buf: Buffer; contentType: string; ext: string } | null> {
  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > 12 * 1024 * 1024) return null;
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : contentType.includes("gif")
        ? "gif"
        : "jpg";
  return { buf, contentType, ext };
}

/** Upload remote image to WordPress media library; returns attachment id or null. */
async function uploadMediaFromUrl(
  root: string,
  auth: { Authorization: string },
  imageUrl: string
): Promise<number | null> {
  const fetched = await fetchImageBuffer(imageUrl);
  if (!fetched) return null;
  const filename = `zettaword-cover-${Date.now()}.${fetched.ext}`;
  const path = "/wp/v2/media";
  let res = await fetch(`${root}/wp-json${path}`, {
    method: "POST",
    headers: {
      ...auth,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": fetched.contentType,
    },
    body: fetched.buf,
  });
  if (res.status === 404) {
    const alt = `${root}/?rest_route=${encodeURIComponent(path)}`;
    res = await fetch(alt, {
      method: "POST",
      headers: {
        ...auth,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": fetched.contentType,
      },
      body: fetched.buf,
    });
  }
  if (!res.ok) return null;
  const media = (await res.json()) as { id?: number };
  return typeof media.id === "number" ? media.id : null;
}

export async function testWordPressConnection(websiteId: string, override?: WpTestOverrides) {
  let root: string;
  let auth: { Authorization: string };
  try {
    const c = await resolveWpCredentialsForTest(websiteId, override);
    root = c.root;
    auth = c.auth;
  } catch (e) {
    if (e instanceof AppError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new AppError(502, `Failed to load WordPress settings: ${msg}`);
  }

  const usersPath = "/wp/v2/users/me";
  let res: Response;
  try {
    res = await wpFetch(root, auth, usersPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AppError(
      502,
      `Network error calling WordPress (${root}). Check URL, firewall, and that the server allows outbound HTTPS. ${msg}`
    );
  }

  if (res.status === 401 || res.status === 403) {
    let body = await res.text();
    if (looksLikeHtmlResponse(body)) {
      const altUrl = `${root}/?rest_route=${encodeURIComponent(usersPath)}`;
      const res2 = await fetch(altUrl, { headers: { ...auth } });
      if (res2.ok) {
        const me2 = (await res2.json()) as { name?: string; slug?: string };
        return {
          ok: true as const,
          message: `Connected as ${me2.name ?? me2.slug ?? "user"}.`,
        };
      }
      body = await res2.text();
      res = res2;
    }
    if (res.status === 401 || res.status === 403) {
      const wpMsg = wordPressErrorDetail(body);
      const notLoggedInHint = wordPressNotLoggedInHint(body);
      throw new AppError(
        401,
        `WordPress rejected the request or credentials.${wpMsg}${notLoggedInHint} Use the profile Username (not Display name), a new Application Password, and a user that can edit posts. On nginx/php-fpm, ensure the Authorization header is passed to PHP (HTTP_AUTHORIZATION).`
      );
    }
  }

  if (!res.ok) {
    const text = await res.text();
    const hint = looksLikeHtmlResponse(text) ? wordPressErrorDetail(text) : text.slice(0, 240);
    throw new AppError(502, `WordPress API error (${res.status}): ${hint}`);
  }
  const me = (await res.json()) as { name?: string; slug?: string };
  return {
    ok: true as const,
    message: `Connected as ${me.name ?? me.slug ?? "user"}.`,
  };
}

export type WpTermItem = { id: number; name: string; slug: string };

/** List categories or tags from the connected WordPress site (paginated). */
export async function listWordPressTerms(websiteId: string, taxonomy: "categories" | "tags"): Promise<WpTermItem[]> {
  const { root, auth } = await getWpClient(websiteId);
  const out: WpTermItem[] = [];
  let page = 1;
  const perPage = 100;
  while (page <= 20) {
    const res = await wpFetchGet(root, auth, `/wp/v2/${taxonomy}`, {
      per_page: perPage,
      page,
      hide_empty: false,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new AppError(502, `WordPress ${taxonomy} list failed (${res.status}): ${text.slice(0, 240)}`);
    }
    const batch = (await res.json()) as { id: number; name: string; slug: string }[];
    for (const row of batch) {
      out.push({ id: row.id, name: String(row.name), slug: row.slug });
    }
    const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "1", 10);
    if (page >= totalPages || batch.length === 0) break;
    page += 1;
  }
  return out;
}

export async function publishArticleToWordpress(
  articleId: string,
  opts?: { status?: string; wpCategoryIds?: number[]; wpTagIds?: number[] }
) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      plannedTopic: { include: { monthlyPlan: { include: { website: true } } } },
    },
  });
  if (!article) throw new AppError(404, "Article not found");

  const website = article.plannedTopic.monthlyPlan.website;
  const { root, auth } = await getWpClient(website.id);

  const rawStatus = opts?.status ?? website.wpDefaultStatus ?? "draft";
  const status = isWpPostStatus(rawStatus) ? rawStatus : "draft";

  const title = (article.metaTitle ?? article.plannedTopic.proposedTitle).trim() || "Untitled";
  const slug = article.slug?.trim() || undefined;
  const excerpt = (article.excerpt ?? article.metaDescription ?? "").trim();

  let content = article.body ?? "";
  let featuredMedia: number | undefined;

  if (article.coverImageUrl?.trim()) {
    const mediaId = await uploadMediaFromUrl(root, auth, article.coverImageUrl.trim());
    if (mediaId != null) {
      featuredMedia = mediaId;
    } else {
      const safeSrc = escapeHtml(article.coverImageUrl.trim());
      content =
        `<figure class="wp-block-image"><img src="${safeSrc}" alt="" /></figure>\n` + content;
    }
  }

  const categoryIds =
    opts?.wpCategoryIds !== undefined ? coerceWpIdArray(opts.wpCategoryIds) : coerceWpIdArray(article.wpCategoryIds);
  const tagIds = opts?.wpTagIds !== undefined ? coerceWpIdArray(opts.wpTagIds) : coerceWpIdArray(article.wpTagIds);

  const payload: Record<string, unknown> = {
    title,
    content,
    status,
    excerpt,
  };
  if (slug) payload.slug = slug;
  if (featuredMedia != null) payload.featured_media = featuredMedia;
  if (categoryIds.length) payload.categories = categoryIds;
  if (tagIds.length) payload.tags = tagIds;

  const existingId = article.wpPostId;
  const postsPath = existingId ? `/wp/v2/posts/${existingId}` : "/wp/v2/posts";
  const method = existingId ? "PUT" : "POST";

  const res = await wpFetch(root, auth, postsPath, {
    method,
    headers: {
      ...auth,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 404 && existingId) {
    throw new AppError(
      404,
      "This article was linked to a WordPress post that no longer exists. Clear wp post id in DB or restore the post on WordPress."
    );
  }

  if (!res.ok) {
    const text = await res.text();
    throw new AppError(502, `WordPress publish failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const post = (await res.json()) as { id: number; link: string };

  await prisma.article.update({
    where: { id: articleId },
    data: {
      wpPostId: post.id,
      wpPostUrl: post.link,
      wpLastPushedAt: new Date(),
      ...(opts?.wpCategoryIds !== undefined ? { wpCategoryIds: categoryIds as Prisma.InputJsonValue } : {}),
      ...(opts?.wpTagIds !== undefined ? { wpTagIds: tagIds as Prisma.InputJsonValue } : {}),
    },
  });

  return { wordpress: { id: post.id, link: post.link, status } };
}
