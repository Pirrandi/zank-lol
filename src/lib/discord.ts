async function postToDiscord(body: unknown): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (!token || !channelId) return;

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Discord API ${res.status}: ${await res.text()}`);
  }
}

export async function sendRankUpAlert(content: string): Promise<void> {
  await postToDiscord({ content });
}

export async function sendRankUpImageAlert(
  imageUrl: string,
  accentColorHex: string,
  content?: string
): Promise<void> {
  await postToDiscord({
    content,
    embeds: [
      {
        color: parseInt(accentColorHex.replace("#", ""), 16),
        image: { url: imageUrl },
      },
    ],
  });
}
