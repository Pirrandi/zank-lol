// One-time (idempotent) setup script: uploads every LoL champion + item icon as a
// Discord application emoji, then writes the id/name mapping to data/discord-emojis.json
// so the app can reference them inline in embeds via <:name:id> syntax.
//
// Safe to re-run: it lists existing application emojis first and skips any name
// that's already uploaded, so a partial failure or new champions/items later just
// top up the missing ones.
//
// Usage: npx tsx scripts/upload-discord-emojis.ts

import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const API_BASE = "https://discord.com/api/v10";
const UPLOAD_DELAY_MS = 400;
const MAX_EMOJI_BYTES = 256 * 1024;
const OUTPUT_PATH = join(__dirname, "..", "data", "discord-emojis.json");

type EmojiMapFile = {
  champions: Record<string, string>;
  items: Record<string, string>;
};

function botHeaders(): HeadersInit {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");
  return { Authorization: `Bot ${token}` };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getApplicationId(): Promise<string> {
  const res = await fetch(`${API_BASE}/applications/@me`, { headers: botHeaders() });
  if (!res.ok) throw new Error(`Failed to resolve application id: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

type DiscordEmoji = { id: string; name: string };

async function listApplicationEmojis(applicationId: string): Promise<DiscordEmoji[]> {
  const res = await fetch(`${API_BASE}/applications/${applicationId}/emojis`, {
    headers: botHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to list application emojis: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.items ?? [];
}

async function uploadEmoji(
  applicationId: string,
  name: string,
  imageBuffer: Buffer,
  contentType: string
): Promise<DiscordEmoji> {
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
      console.warn(`  rate limited on "${name}", waiting ${retryAfterMs}ms (attempt ${attempt})`);
      await sleep(retryAfterMs);
      if (attempt < 6) continue;
    }
    if (!res.ok) {
      throw new Error(`Upload failed for "${name}": ${res.status} ${await res.text()}`);
    }
    return res.json();
  }
}

function sanitizeEmojiName(raw: string): string {
  // Discord app emoji names: 2-32 chars, alphanumeric + underscores only.
  let name = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  if (name.length < 2) name = name.padEnd(2, "_");
  if (name.length > 32) name = name.slice(0, 32).replace(/_+$/g, "");
  return name;
}

type ChampionEntry = { id: string; key: string; name: string };
type ItemEntry = { id: string; name: string };

async function fetchLatestVersion(): Promise<string> {
  const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  if (!res.ok) throw new Error(`Failed to fetch ddragon versions: ${res.status}`);
  const versions: string[] = await res.json();
  return versions[0];
}

async function fetchChampions(version: string): Promise<ChampionEntry[]> {
  const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
  if (!res.ok) throw new Error(`Failed to fetch champion.json: ${res.status}`);
  const data: { data: Record<string, { key: string; id: string; name: string }> } = await res.json();
  return Object.values(data.data).map((c) => ({ id: c.id, key: c.key, name: c.name }));
}

async function fetchItems(version: string): Promise<ItemEntry[]> {
  const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`);
  if (!res.ok) throw new Error(`Failed to fetch item.json: ${res.status}`);
  const data: { data: Record<string, { name: string }> } = await res.json();
  return Object.entries(data.data).map(([id, item]) => ({ id, name: item.name }));
}

async function downloadIcon(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download icon ${url}: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function loadExistingMap(): EmojiMapFile {
  if (!existsSync(OUTPUT_PATH)) return { champions: {}, items: {} };
  try {
    const raw = JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"));
    return { champions: raw.champions ?? {}, items: raw.items ?? {} };
  } catch {
    return { champions: {}, items: {} };
  }
}

function saveMap(map: EmojiMapFile): void {
  mkdirSync(join(__dirname, "..", "data"), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(map, null, 2) + "\n");
}

async function main() {
  const applicationId = await getApplicationId();
  console.log(`Application id: ${applicationId}`);

  const existingEmojis = await listApplicationEmojis(applicationId);
  const existingByName = new Map(existingEmojis.map((e) => [e.name, e]));
  console.log(`Found ${existingEmojis.length} existing application emojis.`);

  const map = loadExistingMap();

  const version = await fetchLatestVersion();
  console.log(`Data Dragon version: ${version}`);

  const champions = await fetchChampions(version);
  const items = await fetchItems(version);
  console.log(`Champions: ${champions.length}, Items: ${items.length}`);

  let championsUploaded = 0;
  let championsSkipped = 0;
  let championsFailed = 0;

  for (const champ of champions) {
    const championIdNum = Number(champ.key);
    if (map.champions[String(championIdNum)]) {
      championsSkipped++;
      continue;
    }

    const emojiName = `champ_${sanitizeEmojiName(champ.id)}`;
    const existing = existingByName.get(emojiName);
    if (existing) {
      map.champions[String(championIdNum)] = `<:${existing.name}:${existing.id}>`;
      championsSkipped++;
      continue;
    }

    try {
      const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champ.id}.png`;
      const buffer = await downloadIcon(iconUrl);
      if (buffer.byteLength > MAX_EMOJI_BYTES) {
        console.warn(`  SKIP champion ${champ.id}: icon is ${buffer.byteLength} bytes (> 256KB limit)`);
        championsFailed++;
        continue;
      }
      const uploaded = await uploadEmoji(applicationId, emojiName, buffer, "image/png");
      map.champions[String(championIdNum)] = `<:${uploaded.name}:${uploaded.id}>`;
      championsUploaded++;
      console.log(`  uploaded champion emoji: ${emojiName} (${championsUploaded + championsSkipped}/${champions.length})`);
      saveMap(map);
      await sleep(UPLOAD_DELAY_MS);
    } catch (err) {
      console.error(`  FAILED champion ${champ.id}:`, err instanceof Error ? err.message : err);
      championsFailed++;
    }
  }

  let itemsUploaded = 0;
  let itemsSkipped = 0;
  let itemsFailed = 0;

  for (const item of items) {
    if (map.items[item.id]) {
      itemsSkipped++;
      continue;
    }

    const idSuffix = `_${item.id}`;
    const namePart = sanitizeEmojiName(item.name || "item").slice(0, 32 - "item_".length - idSuffix.length);
    const emojiName = `item_${namePart}${idSuffix}`;
    const existing = existingByName.get(emojiName);
    if (existing) {
      map.items[item.id] = `<:${existing.name}:${existing.id}>`;
      itemsSkipped++;
      continue;
    }

    try {
      const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${item.id}.png`;
      const buffer = await downloadIcon(iconUrl);
      if (buffer.byteLength > MAX_EMOJI_BYTES) {
        console.warn(`  SKIP item ${item.id}: icon is ${buffer.byteLength} bytes (> 256KB limit)`);
        itemsFailed++;
        continue;
      }
      const uploaded = await uploadEmoji(applicationId, emojiName, buffer, "image/png");
      map.items[item.id] = `<:${uploaded.name}:${uploaded.id}>`;
      itemsUploaded++;
      console.log(`  uploaded item emoji: ${emojiName} (${itemsUploaded + itemsSkipped}/${items.length})`);
      saveMap(map);
      await sleep(UPLOAD_DELAY_MS);
    } catch (err) {
      console.error(`  FAILED item ${item.id}:`, err instanceof Error ? err.message : err);
      itemsFailed++;
    }
  }

  saveMap(map);

  console.log("\nDone.");
  console.log(`Champions: ${championsUploaded} uploaded, ${championsSkipped} skipped (already present), ${championsFailed} failed`);
  console.log(`Items: ${itemsUploaded} uploaded, ${itemsSkipped} skipped (already present), ${itemsFailed} failed`);
  console.log(`Mapping written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
