import { writeFileSync } from "fs";

const ARABIC_URL = "https://api.alquran.cloud/v1/quran/quran-uthmani";
const MAKAREM_URL = "https://api.alquran.cloud/v1/quran/fa.makarem";
const FOOLADVAND_URL = "https://api.alquran.cloud/v1/quran/fa.fooladvand";

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

async function main() {
  console.log("Downloading Arabic text...");
  const arabic = await fetchJSON(ARABIC_URL);

  console.log("Downloading Persian translation (Makarem Shirazi)...");
  const makarem = await fetchJSON(MAKAREM_URL);

  console.log("Downloading Persian translation (Fooladvand)...");
  const fooladvand = await fetchJSON(FOOLADVAND_URL);

  const arabicSurahs = arabic.data.surahs;
  const makaremSurahs = makarem.data.surahs;
  const fooladvandSurahs = fooladvand.data.surahs;

  const verses = [];

  for (let i = 0; i < arabicSurahs.length; i++) {
    const surah = arabicSurahs[i];
    const makaremSurah = makaremSurahs[i];
    const fooladvandSurah = fooladvandSurahs[i];

    for (let j = 0; j < surah.ayahs.length; j++) {
      const ay = surah.ayahs[j];
      const makaremAyah = makaremSurah.ayahs[j];
      const fooladvandAyah = fooladvandSurah.ayahs[j];

      verses.push({
        id: ay.number,
        surah: surah.number,
        surahName: surah.name,
        surahEnglish: surah.englishName,
        ayah: ay.numberInSurah,
        arabic: ay.text,
        persian: makaremAyah.text,
        translations: {
          makarem: makaremAyah.text,
          fooladvand: fooladvandAyah.text,
        },
      });
    }
  }

  console.log(`Total verses: ${verses.length}`);

  const surahs = arabicSurahs.map((s) => ({
    number: s.number,
    name: s.name,
    englishName: s.englishName,
    totalAyahs: s.ayahs.length,
  }));

  const data = { surahs, verses };

  writeFileSync(
    new URL("../src/data/quran.json", import.meta.url),
    JSON.stringify(data),
    "utf-8"
  );

  console.log("Saved to src/data/quran.json");
}

main().catch(console.error);
