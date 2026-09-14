let cachedVersion: string | undefined;
let cachedChampionMap: Map<number, { id: string; name: string }> | undefined;
let cachedItemMap: Map<number, { name: string }> | undefined;

export async function getLatestVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;
  const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  if (!res.ok) throw new Error(`Data Dragon ${res.status} - failed to fetch versions`);
  const versions: string[] = await res.json();
  cachedVersion = versions[0];
  return cachedVersion;
}

async function getChampionMap(): Promise<Map<number, { id: string; name: string }>> {
  if (cachedChampionMap) return cachedChampionMap;
  const version = await getLatestVersion();
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  );
  if (!res.ok) throw new Error(`Data Dragon ${res.status} - failed to fetch champion.json`);
  const data: { data: Record<string, { key: string; id: string; name: string }> } = await res.json();
  cachedChampionMap = new Map(
    Object.values(data.data).map((c) => [Number(c.key), { id: c.id, name: c.name }])
  );
  return cachedChampionMap;
}

export async function getChampionIconUrl(championId: number): Promise<string | undefined> {
  const version = await getLatestVersion();
  const map = await getChampionMap();
  const champ = map.get(championId);
  if (!champ) return undefined;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champ.id}.png`;
}

export async function getChampionSplashUrl(championId: number): Promise<string | undefined> {
  const map = await getChampionMap();
  const champ = map.get(championId);
  if (!champ) return undefined;
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champ.id}_0.jpg`;
}

export async function getChampionDisplayName(championId: number): Promise<string | undefined> {
  const map = await getChampionMap();
  return map.get(championId)?.name;
}

export async function getProfileIconUrl(profileIconId: number): Promise<string> {
  const version = await getLatestVersion();
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${profileIconId}.png`;
}

async function getItemMap(): Promise<Map<number, { name: string }>> {
  if (cachedItemMap) return cachedItemMap;
  const version = await getLatestVersion();
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`
  );
  if (!res.ok) throw new Error(`Data Dragon ${res.status} - failed to fetch item.json`);
  const data: { data: Record<string, { name: string }> } = await res.json();
  cachedItemMap = new Map(
    Object.entries(data.data).map(([id, item]) => [Number(id), { name: item.name }])
  );
  return cachedItemMap;
}

export async function getItemIconUrl(itemId: number): Promise<string | undefined> {
  if (!itemId) return undefined;
  const version = await getLatestVersion();
  const map = await getItemMap();
  if (!map.has(itemId)) return undefined;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`;
}

export async function getItemDisplayName(itemId: number): Promise<string | undefined> {
  if (!itemId) return undefined;
  const map = await getItemMap();
  return map.get(itemId)?.name;
}
