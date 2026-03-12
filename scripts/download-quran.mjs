import { writeFileSync } from "fs";

const ARABIC_URL = "https://api.alquran.cloud/v1/quran/quran-uthmani";
const PERSIAN_URL = "https://api.alquran.cloud/v1/quran/fa.makarem";

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

async function main() {
  console.log("Downloading Arabic text...");
  const arabic = await fetchJSON(ARABIC_URL);

  console.log("Downloading Persian translation (Makarem Shirazi)...");
  const persian = await fetchJSON(PERSIAN_URL);

  const arabicSurahs = arabic.data.surahs;
  const persianSurahs = persian.data.surahs;

  const verses = [];

  for (let i = 0; i < arabicSurahs.length; i++) {
    const surah = arabicSurahs[i];
    const persianSurah = persianSurahs[i];

    for (let j = 0; j < surah.ayahs.length; j++) {
      const ay = surah.ayahs[j];
      const pAy = persianSurah.ayahs[j];

      verses.push({
        id: ay.number,
        surah: surah.number,
        surahName: surah.name,
        surahEnglish: surah.englishName,
        ayah: ay.numberInSurah,
        arabic: ay.text,
        persian: pAy.text,
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
