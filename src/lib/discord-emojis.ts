import emojiMap from "../../data/discord-emojis.json";
import { uploadProfileIconEmoji } from "./discord-emoji-upload";
import { getProfileIconUrl } from "./ddragon";

type EmojiMap = {
  champions: Record<string, string>;
  items: Record<string, string>;
  profileIcons?: Record<string, string>;
};

const map = emojiMap as EmojiMap;

export function getChampionEmoji(championId: number): string | undefined {
  return map.champions[String(championId)];
}

export function getItemEmoji(itemId: number): string | undefined {
  return map.items[String(itemId)];
}

/**
 * Returns the cached emoji for a profile icon, uploading it on the fly the first time a
 * given icon id is seen (e.g. a player changed their profile picture). Never throws — a
 * failed upload just means the recap card renders without that player's icon.
 */
export async function getOrUploadPlayerEmoji(profileIconId: number | null | undefined): Promise<string | undefined> {
  if (profileIconId === null || profileIconId === undefined) return undefined;
  const cached = map.profileIcons?.[String(profileIconId)];
  if (cached) return cached;

  try {
    const iconUrl = await getProfileIconUrl(profileIconId);
    return await uploadProfileIconEmoji(profileIconId, iconUrl);
  } catch (err) {
    console.error(`Failed to upload profile icon emoji for iconId=${profileIconId}:`, err);
    return undefined;
  }
}
