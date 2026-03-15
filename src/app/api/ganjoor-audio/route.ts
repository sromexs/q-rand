export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url || !url.startsWith("https://i.ganjoor.net/")) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(url, { cache: "no-store" });

  if (!upstream.ok) {
    return new Response("Upstream audio unavailable", { status: 502 });
  }

  const audioBuffer = await upstream.arrayBuffer();

  return new Response(audioBuffer, {
    headers: {
      "Content-Length": String(audioBuffer.byteLength),
      "Content-Type": upstream.headers.get("Content-Type") ?? "audio/mpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
