let cachedFont: ArrayBuffer | undefined;

export async function loadArchivoFont(): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;
  const cssUrl = "https://fonts.googleapis.com/css2?family=Archivo:wght@800&text=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%23%C1%C9%CD%D3%DA%D1%C7%E1%E9%ED%F3%FA%F1%E7.%2F%C2%B7";
  const css = await (
    await fetch(cssUrl, {
      headers: {
        "User-Agent": "Mozilla/4.0 (compatible; MSIE 9.0; Windows NT 5.1; Trident/5.0)",
      },
    })
  ).text();
  const match = css.match(/src: url\(([^)]+)\) format\('(woff|opentype|truetype)'\)/);
  if (!match) throw new Error("Could not resolve Archivo font source");
  const fontRes = await fetch(match[1]);
  cachedFont = await fontRes.arrayBuffer();
  return cachedFont;
}
