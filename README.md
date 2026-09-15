# zank.lol

Un ranking privado de League of Legends para un grupo de amigos. Sincroniza rango, LP, partidas y racha de cada uno directo desde la API de Riot, y le agrega un montón de cosas para hacerlo entretenido: historial de LP, detección de partidas personalizadas entre el grupo, "muro de la vergüenza" y "muro de la fama", indicador de quién está jugando ahora mismo, un bot de Discord que avisa subidas/bajadas de rango con roasts generados por IA, y análisis diario de cada jugador.

Pensado para correr en un VPS chico junto a otros proyectos (pm2 + nginx + cron), no necesita infraestructura pesada.

## Qué hace

- **Ranking en vivo**: tabla ordenable por rango actual o por LP total ganado (para competir parejo entre distintos elos), con podio top 3, búsqueda, y toggle Solo/Dúo vs Flexible.
- **Perfil por jugador**: gráfico de LP en el tiempo, hitos de rango, historial de partidas real (campeón, KDA, con qué amigos jugó), head-to-head, y un análisis de IA generado a diario.
- **Personalizadas**: detecta automáticamente cuando dos o más del grupo terminan en equipos rivales en una partida personalizada (1v1, 3v3, lo que sea) y lo muestra en su propia sección.
- **Muro de la Vergüenza / Muro de la Fama**: rachas de derrota activas, mayor caída de LP, y del lado positivo pentakills, triples y robos de objetivos épicos.
- **Indicador "en partida"**: punto verde en vivo si alguien está jugando ranked (o personalizada) ahora mismo.
- **Bot de Discord**: avisa subidas de rango (con una tarjeta generada con el splash art del campeón usado), bajadas de rango y rachas de derrota — todo con comentarios generados por IA. Comando `/rank` para consultar a cualquiera, y `/agregar-jugador` (restringido a un rol admin) para sumar cuentas sin tocar el servidor.
- **Sync manual**: botón en la web para forzar una sincronización sin esperar el cron.

## Stack

Next.js 15 (App Router, TypeScript) + Prisma/SQLite + Recharts. Sin infra externa aparte de las APIs que consume.

## APIs externas que usa

| Servicio | Para qué | Plan gratis |
|---|---|---|
| [Riot Games API](https://developer.riotgames.com/) | Cuentas, rango, partidas, partida en vivo | Sí (dev key, se vence cada 24h — hay que regenerarla a mano) |
| [Discord](https://discord.com/developers/applications) | Bot de avisos y comandos | Sí |
| [Groq](https://console.groq.com/keys) | Roasts/análisis generados por IA | Sí |

## Variables de entorno (`.env`)

```bash
DATABASE_URL="file:./dev.db"
RIOT_API_KEY="RGAPI-..."          # developer.riotgames.com — dev key expira cada 24h
DISCORD_BOT_TOKEN="..."           # Discord Developer Portal → Bot → Reset Token
DISCORD_CHANNEL_ID="..."          # canal donde el bot postea los avisos
DISCORD_RANKUP_CHANNEL_ID="..."   # opcional — canal solo para avisos de rango (si falta, usa DISCORD_CHANNEL_ID)
DISCORD_PUBLIC_KEY="..."          # Discord Developer Portal → General Information → verify_key
GROQ_API_KEY="gsk_..."            # console.groq.com/keys
ADMIN_PASSWORD_HASH="..."         # hash del password del panel /admin — generar con: npm run hash-admin-password -- <tu-password>
SESSION_SECRET="..."              # string random largo para firmar la cookie de sesión del admin, ej: openssl rand -hex 32
```

## Setup

```bash
npm install
npx prisma db push        # crea la base SQLite
npm run add-account -- <riotIdSinNumeral> <tag>   # ej: npm run add-account -- Faker KR1
npm run build
```

### Bot de Discord

1. Creá una aplicación en el [Developer Portal](https://discord.com/developers/applications), agregale un bot y copiá el token.
2. En OAuth2 → URL Generator, marcá `bot` + `applications.commands`, con permisos de enviar/leer mensajes, e invitalo a tu server.
3. Copiá el `verify_key` de la pestaña General Information → `DISCORD_PUBLIC_KEY`.
4. Registrá los comandos (`/rank`, `/agregar-jugador`):
   ```bash
   DISCORD_APPLICATION_ID="..." DISCORD_GUILD_ID="..." npm run register-discord-command
   ```
5. Deployá la app y recién ahí, en el Developer Portal, poné la **Interactions Endpoint URL** en `https://tu-dominio/api/discord/interactions` (Discord manda un ping en vivo para verificarla, tiene que estar la app corriendo con `DISCORD_PUBLIC_KEY` puesto).

### Canales desde el panel de admin

En `/admin/settings` los canales de recaps de partida, predicciones y avisos de rango se eligen
desde un desplegable que lista en vivo los canales de texto y de anuncios donde el bot puede
postear (hace falta `DISCORD_BOT_TOKEN`; si está `DISCORD_GUILD_ID` se limita a ese servidor).
Lo que se guarde ahí tiene prioridad sobre las variables de entorno; dejando la opción "Usar
variable de entorno" se borra el valor de la base y vuelve a mandar el `.env`.

### Cron (poll cada 5 min + análisis diario)

```
*/5 * * * *  cd /ruta/al/proyecto && env $(cat .env | xargs) npx tsx scripts/poll.ts >> poll.log 2>&1
0 12 * * *   cd /ruta/al/proyecto && env $(cat .env | xargs) npx tsx scripts/analyze.ts >> analyze.log 2>&1
```

### Deploy

`npm run build && pm2 start npm --name zank-lol -- start -- -p 4200`, con nginx como reverse proxy delante (ver `deploy/` para un ejemplo de config con certbot).

## Adaptar para otro grupo / región

Está armado para un grupo de amigos jugando en LAS, pero adaptarlo es simple:

- **Región/servidor**: `platform: "la2"` está hardcodeado en `scripts/add-account.ts` y en el handler de `/agregar-jugador` (`src/app/api/discord/interactions/route.ts`). Cambialo por tu [platform routing value](https://developer.riotgames.com/docs/lol#routing-values) (`na1`, `euw1`, etc.) y el continental routing correspondiente en `src/lib/riot.ts`.
- **Rol de admin de Discord**: `ADMIN_ROLE_ID` está hardcodeado en `src/app/api/discord/interactions/route.ts`.
- **Dominio**: `SITE_URL` en `scripts/poll.ts` y `metadataBase` en `src/app/layout.tsx`.
- **Marca/branding**: "ZANK.LOL" aparece en `src/app/nav.tsx`, `src/app/page.tsx` y los assets de `src/app/icon.png` / `opengraph-image.png`.

No hay multi-tenancy — es una instancia por grupo. Para varios grupos, la forma más simple hoy es desplegar una instancia separada por cada uno.
