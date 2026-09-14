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

export async function getActiveGame(puuid: string, platform: string): Promise<{ gameQueueConfigId: number } | null> {
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
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
  challenges?: {
    epicMonsterSteals?: number;
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
