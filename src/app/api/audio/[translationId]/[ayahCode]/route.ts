const AUDIO_BASE_URLS: Record<string, string> = {
  makarem_kabiri_16kbps: "https://everyayah.com/data/translations/Makarem_Kabiri_16Kbps",
  fooladvand_hedayatfar_40kbps:
    "https://everyayah.com/data/translations/Fooladvand_Hedayatfar_40Kbps",
};

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    translationId: string;
    ayahCode: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { translationId, ayahCode } = await context.params;
  const baseUrl = AUDIO_BASE_URLS[translationId];

  if (!baseUrl || !/^\d{6}$/.test(ayahCode)) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(`${baseUrl}/${ayahCode}.mp3`, {
    cache: "force-cache",
  });

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
