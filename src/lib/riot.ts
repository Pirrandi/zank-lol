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

export async function getSummonerByPuuid(
  puuid: string,
  platform: string
): Promise<{ profileIconId: number; summonerLevel: number }> {
  const url = `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  const res = await fetch(url, { headers: riotHeaders() });
  if (!res.ok) {
    throw new Error(
      `Riot API ${res.status} - ${res.status === 401 ? "key likely expired" : "failed to fetch summoner"} (puuid=${puuid})`
    );
  }
  return res.json();
}

export type ActiveGame = {
  gameId: number;
  gameQueueConfigId: number;
  participants: { puuid: string; championId: number; teamId: number }[];
};

export async function getActiveGame(puuid: string, platform: string): Promise<ActiveGame | null> {
  const url = `https://${platform}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`;
  const res = await fetch(url, { headers: riotHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `Riot API ${res.status} - ${res.status === 401 ? "key likely expired" : "failed to fetch active game"} (puuid=${puuid})`
    );
  }
  return res.json();
}

export type MatchParticipant = {
  puuid: string;
  championName: string;
  championId: number;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  teamId: number;
  teamPosition: string;
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  totalDamageDealtToChampions: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  challenges?: {
    epicMonsterSteals?: number;
    killParticipation?: number;
  };
};

export type MatchDetail = {
  info: {
    participants: MatchParticipant[];
    queueId: number;
    gameCreation: number;
    gameDuration: number;
  };
};

export async function getMatchIds(
  puuid: string,
  continentalRoute: string,
  count: number,
  queueId?: number
): Promise<string[]> {
  const queueParam = queueId !== undefined ? `&queue=${queueId}` : "";
  const url = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}${queueParam}`;
  const res = await fetch(url, { headers: riotHeaders() });
  if (!res.ok) {
    throw new Error(
      `Riot API ${res.status} - ${res.status === 401 ? "key likely expired" : "failed to fetch match ids"} (puuid=${puuid})`
    );
  }
  return res.json();
}

export async function getMatchDetail(
  matchId: string,
  continentalRoute: string
): Promise<MatchDetail> {
  const url = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
  const res = await fetch(url, { headers: riotHeaders() });
  if (!res.ok) {
    throw new Error(
      `Riot API ${res.status} - ${res.status === 401 ? "key likely expired" : "failed to fetch match detail"} (matchId=${matchId})`
    );
  }
  return res.json();
}

export type ChampionMastery = {
  championId: number;
  championLevel: number;
  championPoints: number;
};

export async function getChampionMasteries(
  puuid: string,
  platform: string,
  count = 1
): Promise<ChampionMastery[]> {
  const url = `https://${platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`;
  const res = await fetch(url, { headers: riotHeaders() });
  if (!res.ok) {
    throw new Error(
      `Riot API ${res.status} - ${res.status === 401 ? "key likely expired" : "failed to fetch champion masteries"} (puuid=${puuid})`
    );
  }
  return res.json();
}

// Riot platform routing values -> League of Graphs region slugs. LoG does not publish this
// mapping officially; these follow the same conventions used across third-party LoL sites.
const LEAGUE_OF_GRAPHS_REGION_SLUGS: Record<string, string> = {
  na1: "na",
  euw1: "euw",
  eun1: "eune",
  kr: "kr",
  jp1: "jp",
  br1: "br",
  la1: "lan",
  la2: "las",
  oc1: "oce",
  tr1: "tr",
  ru: "ru",
  ph2: "ph",
  sg2: "sg",
  th2: "th",
  tw2: "tw",
  vn2: "vn",
};

export function getLeagueOfGraphsUrl(gameName: string, tagLine: string, platform: string): string {
  const region = LEAGUE_OF_GRAPHS_REGION_SLUGS[platform.toLowerCase()] ?? platform.toLowerCase();
  const slug = `${encodeURIComponent(gameName)}-${encodeURIComponent(tagLine)}`;
  return `https://www.leagueofgraphs.com/summoner/${region}/${slug}`;
}
