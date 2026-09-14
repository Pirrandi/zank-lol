const MODEL = "openai/gpt-oss-20b";

export async function generateRoast(prompt: string): Promise<string | undefined> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return undefined;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 1.0,
        max_tokens: 400,
        reasoning_effort: "low",
      }),
    });

    if (!res.ok) return undefined;

    const data = await res.json();
    const raw: string | undefined = data.choices?.[0]?.message?.content;
    if (!raw) return undefined;

    const line = raw
      .split("\n")
      .map((l: string) => l.trim())
      .find((l: string) => l.length > 0);

    const cleaned = line?.replace(/^["'*]+|["'*]+$/g, "").trim();
    if (!cleaned || cleaned.split(/\s+/).length < 4) return undefined;
    return cleaned;
  } catch {
    return undefined;
  }
}
