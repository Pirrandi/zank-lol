import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const API_BASE = "https://discord.com/api/v10";
const MAX_EMOJI_BYTES = 256 * 1024;
const DATA_PATH = join(process.cwd(), "data", "discord-emojis.json");

type EmojiMapFile = {
  champions: Record<string, string>;
  items: Record<string, string>;
  profileIcons: Record<string, string>;
};

function botHeaders(): HeadersInit {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");
  return { Authorization: `Bot ${token}` };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeEmojiName(raw: string): string {
  let name = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  if (name.length < 2) name = name.padEnd(2, "_");
  if (name.length > 32) name = name.slice(0, 32).replace(/_+$/g, "");
  return name;
}

export function loadEmojiMap(): EmojiMapFile {
  if (!existsSync(DATA_PATH)) return { champions: {}, items: {}, profileIcons: {} };
  try {
    const raw = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
    return { champions: raw.champions ?? {}, items: raw.items ?? {}, profileIcons: raw.profileIcons ?? {} };
  } catch {
    return { champions: {}, items: {}, profileIcons: {} };
  }
}

export function saveEmojiMap(map: EmojiMapFile): void {
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(DATA_PATH, JSON.stringify(map, null, 2) + "\n");
}

async function getApplicationId(): Promise<string> {
  const res = await fetch(`${API_BASE}/applications/@me`, { headers: botHeaders() });
  if (!res.ok) throw new Error(`Failed to resolve application id: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

async function uploadEmojiRaw(
  applicationId: string,
  name: string,
  imageBuffer: Buffer,
  contentType: string
): Promise<{ id: string; name: string }> {
  const dataUri = `data:${contentType};base64,${imageBuffer.toString("base64")}`;
  let attempt = 0;
  for (;;) {
    attempt++;
    const res = await fetch(`${API_BASE}/applications/${applicationId}/emojis`, {
      method: "POST",
      headers: { ...botHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ name, image: dataUri }),
    });
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      const retryAfterMs = Math.ceil((body.retry_after ?? 1) * 1000) + 250;
      await sleep(retryAfterMs);
      if (attempt < 6) continue;
    }
    if (!res.ok) throw new Error(`Emoji upload failed for "${name}": ${res.status} ${await res.text()}`);
    return res.json();
  }
}

const EMOJI_SIZE = 128;

async function cropToCircle(sourceBuffer: Buffer): Promise<Buffer> {
  const circleMask = Buffer.from(
    `<svg width="${EMOJI_SIZE}" height="${EMOJI_SIZE}"><circle cx="${EMOJI_SIZE / 2}" cy="${EMOJI_SIZE / 2}" r="${EMOJI_SIZE / 2}" fill="#fff"/></svg>`
  );
  const resized = await sharp(sourceBuffer).resize(EMOJI_SIZE, EMOJI_SIZE).png().toBuffer();
  return sharp(resized)
    .composite([{ input: circleMask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

/**
 * Uploads a single profile-icon PNG (cropped to a circle with transparent corners) as a
 * Discord application emoji and persists it to data/discord-emojis.json, keyed by
 * profileIconId. Safe to call repeatedly — reloads the map each time so it never clobbers
 * concurrent writes from the champion/item uploader.
 */
export async function uploadProfileIconEmoji(profileIconId: number, iconUrl: string): Promise<string | undefined> {
  const res = await fetch(iconUrl);
  if (!res.ok) return undefined;
  const rawBuffer = Buffer.from(await res.arrayBuffer());
  const buffer = await cropToCircle(rawBuffer);
  if (buffer.byteLength > MAX_EMOJI_BYTES) return undefined;

  const applicationId = await getApplicationId();
  const emojiName = `picon_${sanitizeEmojiName(String(profileIconId))}`;
  const uploaded = await uploadEmojiRaw(applicationId, emojiName, buffer, "image/png");
  const emojiString = `<:${uploaded.name}:${uploaded.id}>`;

  const map = loadEmojiMap();
  map.profileIcons[String(profileIconId)] = emojiString;
  saveEmojiMap(map);

  return emojiString;
}
