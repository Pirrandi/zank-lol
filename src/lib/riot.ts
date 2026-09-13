export type RiotAccount = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

export type LeagueEntry = {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
};

function riotHeaders(): HeadersInit {
  return { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" };
}

export async function getAccountByRiotId(
  gameName: string,
  tagLine: string
): Promise<RiotAccount> {
  const url = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const res = await fetch(url, { headers: riotHeaders() });
  if (!res.ok) {
    throw new Error(
      `Riot API ${res.status} - ${res.status === 401 ? "key likely expired" : "failed to fetch account"} (${gameName}#${tagLine})`
    );
  }
  return res.json();
}

export async function getRankedEntries(
  puuid: string,
  platform: string
): Promise<LeagueEntry[]> {
  const url = `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
  const res = await fetch(url, { headers: riotHeaders() });
  if (!res.ok) {
    throw new Error(
      `Riot API ${res.status} - ${res.status === 401 ? "key likely expired" : "failed to fetch ranked entries"} (puuid=${puuid})`
    );
  }
  return res.json();
}
