"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";

const STORAGE_KEY = "moulavi:poem-id";
const SETTINGS_KEY = "moulavi:settings";
const GANJOOR_API = "https://api.ganjoor.net/api/ganjoor";
const POET_ID = 5;

const SECTIONS = [
  { id: "all", label: "همه", catIds: [99, 101, 102, 104, 105, 106, 107, 108, 109] },
  { id: "ghazal", label: "غزلیات", catIds: [99] },
  { id: "masnavi", label: "مثنوی", catIds: [104, 105, 106, 107, 108, 109] },
  { id: "tarji", label: "ترجیعات", catIds: [101] },
  { id: "rubaiyat", label: "رباعیات", catIds: [102] },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// Cache poem ID lists per catId
const poemIdCache = new Map<number, number[]>();

async function fetchPoemIds(catId: number): Promise<number[]> {
  const cached = poemIdCache.get(catId);
  if (cached) return cached;

  const res = await fetch(`${GANJOOR_API}/cat/${catId}?poems=true`);
  if (!res.ok) return [];
  const data = await res.json();
  const poems: { id: number }[] = data?.cat?.poems ?? [];
  const ids = poems.map((p) => p.id);
  poemIdCache.set(catId, ids);
  return ids;
}

async function getRandomPoemId(sectionId: SectionId): Promise<number | null> {
  const section = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0];
  // Pick a random catId from the section
  const catId = section.catIds[Math.floor(Math.random() * section.catIds.length)];
  const ids = await fetchPoemIds(catId);
  if (!ids.length) return null;
  return ids[Math.floor(Math.random() * ids.length)];
}

interface GanjoorVerse {
  id: number;
  vOrder: number;
  coupletIndex: number;
  text: string;
  coupletSummary?: string;
}

interface GanjoorRecitation {
  id: number;
  mp3Url: string;
  audioArtist: string;
  recitationType: number;
}

interface GanjoorSection {
  ganjoorMetre?: { rhythm: string } | null;
  rhymeLetters?: string;
}

interface GanjoorPoem {
  id: number;
  title: string;
  fullTitle: string;
  fullUrl: string;
  verses: GanjoorVerse[];
  poemSummary?: string;
  recitations: GanjoorRecitation[] | null;
  sections?: GanjoorSection[];
  next?: { id: number; title: string; excerpt?: string } | null;
  previous?: { id: number; title: string; excerpt?: string } | null;
}

interface Couplet {
  index: number;
  lines: string[];
  summary?: string;
}

function groupCouplets(verses: GanjoorVerse[]): Couplet[] {
  const map = new Map<number, Couplet>();
  for (const v of verses) {
    const idx = v.coupletIndex ?? v.vOrder;
    let couplet = map.get(idx);
    if (!couplet) {
      couplet = { index: idx, lines: [], summary: undefined };
      map.set(idx, couplet);
    }
    couplet.lines.push(v.text);
    if (v.coupletSummary && !couplet.summary) {
      couplet.summary = v.coupletSummary.replace(/^هوش مصنوعی:\s*/i, "");
    }
  }
  return Array.from(map.values());
}

export default function MoulaviPage() {
  const [poem, setPoem] = useState<GanjoorPoem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [showMeaning, setShowMeaning] = useState(true);
  const [playbackMode, setPlaybackMode] = useState<"idle" | "playing">("idle");
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [audioProgress, setAudioProgress] = useState(0);
  const [selectedRecitationIdx, setSelectedRecitationIdx] = useState(0);
  const [isAutoAdvance, setIsAutoAdvance] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<SectionId>("all");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const poemFetchAbortRef = useRef<AbortController | null>(null);
  const settingsSheetRef = useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const isAutoAdvanceRef = useRef(false);
  const autoPlayAfterLoadRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    isAutoAdvanceRef.current = isAutoAdvance;
  }, [isAutoAdvance]);

  const readings = useMemo(() => {
    if (!poem?.recitations?.length) return [];
    return poem.recitations.filter((r) => r.recitationType === 0);
  }, [poem]);

  const recitation = readings[selectedRecitationIdx] ?? readings[0] ?? null;

  const couplets = useMemo(
    () => (poem ? groupCouplets(poem.verses) : []),
    [poem],
  );

  const cleanSummary = useMemo(() => {
    if (!poem?.poemSummary) return "";
    return poem.poemSummary.replace(/^هوش مصنوعی:\s*/i, "");
  }, [poem]);

  const metre = useMemo(() => {
    if (!poem?.sections?.length) return "";
    return poem.sections[0]?.ganjoorMetre?.rhythm ?? "";
  }, [poem]);

  const categoryLabel = useMemo(() => {
    if (!poem?.fullTitle) return "";
    const parts = poem.fullTitle.split("»").map((s) => s.trim());
    return parts.slice(1, -1).join(" » ");
  }, [poem]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    setPlaybackMode("idle");
    setIsAudioLoading(false);
    setAudioProgress(0);
  }, []);

  const loadPoem = useCallback(
    async (mode: "random" | "id", id?: number) => {
      poemFetchAbortRef.current?.abort();
      const controller = new AbortController();
      poemFetchAbortRef.current = controller;

      stopAudio();
      setIsLoading(true);
      setFetchError("");
      setAudioError("");
      setSelectedRecitationIdx(0);

      try {
        let poemId = id;

        if (mode === "random" || !poemId) {
          const randomId = await getRandomPoemId(selectedSection);
          if (!randomId) throw new Error("خطا در دریافت شعر");
          poemId = randomId;
          if (controller.signal.aborted) return;
        }

        const detailRes = await fetch(
          `${GANJOOR_API}/poem/${poemId}?recitations=true`,
          { signal: controller.signal },
        );
        if (!detailRes.ok) throw new Error("خطا در دریافت جزئیات شعر");
        const detailData: GanjoorPoem = await detailRes.json();

        if (controller.signal.aborted) return;

        setPoem(detailData);
        window.localStorage.setItem(STORAGE_KEY, String(detailData.id));

        // Auto-play after loading if triggered by auto-advance
        if (autoPlayAfterLoadRef.current) {
          autoPlayAfterLoadRef.current = false;
          // Check if the new poem has recitations
          const hasReading = detailData.recitations?.some(
            (r) => r.recitationType === 0,
          );
          if (hasReading) {
            setPlaybackMode("playing");
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        autoPlayAfterLoadRef.current = false;
        setFetchError(
          err instanceof Error ? err.message : "خطا در دریافت شعر",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [selectedSection, stopAudio],
  );

  const goRandom = useCallback(() => loadPoem("random"), [loadPoem]);
  const goNext = useCallback(() => {
    if (poem?.next) loadPoem("id", poem.next.id);
  }, [loadPoem, poem]);
  const goPrev = useCallback(() => {
    if (poem?.previous) loadPoem("id", poem.previous.id);
  }, [loadPoem, poem]);

  // Auto-advance next with auto-play
  const advanceAndPlay = useCallback(() => {
    if (poem?.next) {
      autoPlayAfterLoadRef.current = true;
      loadPoem("id", poem.next.id);
    }
  }, [loadPoem, poem]);

  // Initial load + settings
  useEffect(() => {
    const savedId = window.localStorage.getItem(STORAGE_KEY);
    const parsedId = savedId ? Number.parseInt(savedId, 10) : NaN;

    const savedSettings = window.localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        const s = JSON.parse(savedSettings) as {
          autoAdvance?: boolean;
          showMeaning?: boolean;
          section?: string;
        };
        if (typeof s.autoAdvance === "boolean") setIsAutoAdvance(s.autoAdvance);
        if (typeof s.showMeaning === "boolean") setShowMeaning(s.showMeaning);
        if (s.section && SECTIONS.some((sec) => sec.id === s.section)) {
          setSelectedSection(s.section as SectionId);
        }
      } catch {
        window.localStorage.removeItem(SETTINGS_KEY);
      }
    }

    if (Number.isInteger(parsedId) && parsedId > 0) {
      void loadPoem("id", parsedId);
    } else {
      void loadPoem("random");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist settings
  useEffect(() => {
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ autoAdvance: isAutoAdvance, showMeaning, section: selectedSection }),
    );
  }, [isAutoAdvance, selectedSection, showMeaning]);

  // Close settings on outside click
  useEffect(() => {
    if (!isSettingsOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (settingsSheetRef.current?.contains(target)) return;
      if (settingsButtonRef.current?.contains(target)) return;
      setIsSettingsOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isSettingsOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === " " || e.key === "r") {
        e.preventDefault();
        goRandom();
      } else if (e.key === "p") {
        e.preventDefault();
        if (recitation) {
          setPlaybackMode((m) => (m === "playing" ? "idle" : "playing"));
        }
      } else if (e.key === "m") {
        e.preventDefault();
        setShowMeaning((s) => !s);
      } else if (e.key === "a") {
        e.preventDefault();
        setIsAutoAdvance((a) => !a);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goRandom, goPrev, goNext, recitation]);

  // Audio idle handler
  useEffect(() => {
    if (playbackMode !== "idle" || !audioRef.current) return;
    stopAudio();
  }, [playbackMode, stopAudio]);

  // Audio play handler
  useEffect(() => {
    if (playbackMode !== "playing" || !recitation || !audioRef.current) return;

    const audio = audioRef.current;
    setIsAudioLoading(true);
    setAudioProgress(0);
    setAudioError("");

    audio.src = recitation.mp3Url;
    audio.load();
    audio.play().catch((err) => {
      setIsAudioLoading(false);
      setAudioError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "برای پخش صوت، روی دکمه پخش بزنید."
          : "پخش صوت انجام نشد.",
      );
      setPlaybackMode("idle");
    });
  }, [playbackMode, recitation]);

  // Audio events with rAF
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let rafId = 0;

    const tick = () => {
      const duration =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : 0;
      setAudioProgress(
        duration > 0 ? Math.min(1, audio.currentTime / duration) : 0,
      );
      rafId = requestAnimationFrame(tick);
    };

    const handlePlaying = () => {
      setIsAudioLoading(false);
      setAudioError("");
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    };

    const handlePause = () => cancelAnimationFrame(rafId);

    const handleEnded = () => {
      cancelAnimationFrame(rafId);
      setIsAudioLoading(false);
      setAudioProgress(1);

      if (isAutoAdvanceRef.current) {
        // Will be handled by advanceAndPlay via state
        setPlaybackMode("idle");
        // Trigger auto-advance
        setTimeout(() => {
          const advanceEvent = new CustomEvent("mv-auto-advance");
          window.dispatchEvent(advanceEvent);
        }, 300);
      } else {
        setPlaybackMode("idle");
      }
    };

    const handleError = () => {
      cancelAnimationFrame(rafId);
      setIsAudioLoading(false);
      setAudioError("پخش صوت انجام نشد.");
      setPlaybackMode("idle");
    };

    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      cancelAnimationFrame(rafId);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  // Listen for auto-advance event
  useEffect(() => {
    const handler = () => advanceAndPlay();
    window.addEventListener("mv-auto-advance", handler);
    return () => window.removeEventListener("mv-auto-advance", handler);
  }, [advanceAndPlay]);

  const isPlaying = playbackMode === "playing";

  return (
    <div className="container">
      <audio ref={audioRef} preload="none" />

      {isLoading ? (
        <div className="mv-loading">در حال دریافت شعر...</div>
      ) : fetchError ? (
        <div className="mv-error-page">
          <div className="audio-error">{fetchError}</div>
          <button className="mv-retry" type="button" onClick={goRandom}>
            تلاش دوباره
          </button>
        </div>
      ) : poem ? (
        <>
          <div className="verse-info">
            <div className="surah-name">{poem.title}</div>
            <div className="verse-number">{categoryLabel}</div>
            {metre ? <div className="mv-metre">{metre}</div> : null}
          </div>

          {recitation ? (
            <div className="audio-status" aria-live="polite">
              <span>{recitation.audioArtist}</span>
              <span>
                {isPlaying
                  ? isAudioLoading
                    ? "در حال بارگذاری صوت"
                    : isAutoAdvance
                      ? "پخش با رفتن خودکار"
                      : "در حال پخش"
                  : isAutoAdvance
                    ? "رفتن خودکار روشن است"
                    : "آماده پخش"}
              </span>
            </div>
          ) : null}
          {audioError ? <div className="audio-error">{audioError}</div> : null}

          {isPlaying && !isAudioLoading ? (
            <div
              className="mv-progress-bar"
              onClick={(e) => {
                const audio = audioRef.current;
                if (!audio || !Number.isFinite(audio.duration)) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(
                  0,
                  Math.min(1, (e.clientX - rect.left) / rect.width),
                );
                audio.currentTime = ratio * audio.duration;
              }}
            >
              <div className="mv-progress-track">
                <div
                  className="mv-progress-fill"
                  style={{ width: `${audioProgress * 100}%` }}
                />
              </div>
            </div>
          ) : null}

          {readings.length > 1 ? (
            <div className="mv-reciter-picker">
              {readings.map((r, i) => (
                <button
                  key={r.id}
                  className={`speed-btn${i === selectedRecitationIdx ? " speed-btn-active" : ""}`}
                  type="button"
                  onClick={() => {
                    stopAudio();
                    setSelectedRecitationIdx(i);
                  }}
                >
                  {r.audioArtist}
                </button>
              ))}
            </div>
          ) : null}

          {isSettingsOpen ? (
            <div ref={settingsSheetRef} className="settings-sheet">
              <div className="settings-sheet-header">
                <div className="settings-title">تنظیمات</div>
                <button
                  className="settings-close"
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  aria-label="Close settings"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              <button
                className={`settings-switch${isAutoAdvance ? " settings-switch-active" : ""}`}
                type="button"
                onClick={() => setIsAutoAdvance((a) => !a)}
              >
                <span>رفتن خودکار به شعر بعد و پخش</span>
                <span className="settings-switch-state">
                  {isAutoAdvance ? "روشن" : "خاموش"}
                </span>
              </button>

              <button
                className={`settings-switch${showMeaning ? " settings-switch-active" : ""}`}
                type="button"
                onClick={() => setShowMeaning((s) => !s)}
              >
                <span>نمایش معنی ابیات</span>
                <span className="settings-switch-state">
                  {showMeaning ? "روشن" : "خاموش"}
                </span>
              </button>

              <div className="settings-title" style={{ marginTop: 4 }}>
                بخش
              </div>
              <div className="mv-section-picker">
                {SECTIONS.map((sec) => (
                  <button
                    key={sec.id}
                    className={`speed-btn${sec.id === selectedSection ? " speed-btn-active" : ""}`}
                    type="button"
                    onClick={() => setSelectedSection(sec.id)}
                  >
                    {sec.label}
                  </button>
                ))}
              </div>

            </div>
          ) : null}

          <div className="verse-card mv-card">
            {couplets.map((couplet) => (
              <div key={couplet.index} className="mv-couplet">
                {couplet.lines.map((line, i) => (
                  <div key={i} className="mv-hemistich">
                    {line}
                  </div>
                ))}
                {showMeaning && couplet.summary ? (
                  <div className="mv-couplet-meaning">{couplet.summary}</div>
                ) : null}
              </div>
            ))}

            {showMeaning && cleanSummary ? (
              <>
                <div className="divider" />
                <div className="mv-summary">{cleanSummary}</div>
              </>
            ) : null}

            <a
              className="mv-ganjoor-link"
              href={`https://ganjoor.net${poem.fullUrl}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              مشاهده در گنجور
            </a>
          </div>
        </>
      ) : null}

      <div className="controls">
        <button
          className="btn"
          onClick={goPrev}
          disabled={!poem?.previous}
          aria-label="Previous"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {recitation ? (
          <button
            className={`btn${isPlaying ? " btn-active" : ""}`}
            onClick={() =>
              setPlaybackMode((m) => (m === "playing" ? "idle" : "playing"))
            }
            aria-label="Play"
          >
            {isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
        ) : null}
        <button className="btn btn-random" onClick={goRandom} aria-label="Random">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
        </button>
        <button
          ref={settingsButtonRef}
          className={`btn${isSettingsOpen ? " btn-active" : ""}`}
          onClick={() => setIsSettingsOpen((o) => !o)}
          aria-label="Settings"
          title="تنظیمات"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button
          className="btn"
          onClick={goNext}
          disabled={!poem?.next}
          aria-label="Next"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  );
}
