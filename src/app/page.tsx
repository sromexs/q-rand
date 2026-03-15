"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import quranData from "@/data/quran.json";

const { verses } = quranData;
const TOTAL = verses.length;
const STORAGE_KEY = "q-rand:index";
const AUDIO_SETTINGS_KEY = "q-rand:audio-settings";
const DEFAULT_HIGHLIGHT_OFFSET = 0.24;

type AudioTranslationId = "makarem_kabiri_16kbps" | "fooladvand_hedayatfar_40kbps";
type PlaybackMode = "idle" | "playing";
type TranslationKey = "makarem" | "fooladvand";

const SPEED_OPTIONS = [1, 1.25, 1.5, 2] as const;
type PlaybackSpeed = (typeof SPEED_OPTIONS)[number];

const AUDIO_TRANSLATIONS = [
  {
    id: "makarem_kabiri_16kbps" as const,
    label: "مکارم",
    description: "نسخه سبک‌تر",
    textKey: "makarem" as const,
    remoteBaseUrl: "https://everyayah.com/data/translations/Makarem_Kabiri_16Kbps",
  },
  {
    id: "fooladvand_hedayatfar_40kbps" as const,
    label: "فولادوند",
    description: "کیفیت بالاتر",
    textKey: "fooladvand" as const,
    remoteBaseUrl: "https://everyayah.com/data/translations/Fooladvand_Hedayatfar_40Kbps",
  },
];

function getAyahCode(surah: number, ayah: number) {
  return `${String(surah).padStart(3, "0")}${String(ayah).padStart(3, "0")}`;
}

export default function Home() {
  const [index, setIndex] = useState<number>(-1);
  const [selectedTranslationId, setSelectedTranslationId] =
    useState<AudioTranslationId>("makarem_kabiri_16kbps");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAutoAdvanceEnabled, setIsAutoAdvanceEnabled] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [highlightOffset, setHighlightOffset] = useState(DEFAULT_HIGHLIGHT_OFFSET);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("idle");
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioError, setAudioError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const settingsSheetRef = useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const playbackModeRef = useRef<PlaybackMode>("idle");
  const objectUrlRef = useRef<string | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);

  const selectedTranslation = useMemo(
    () =>
      AUDIO_TRANSLATIONS.find((translation) => translation.id === selectedTranslationId) ??
      AUDIO_TRANSLATIONS[0],
    [selectedTranslationId],
  );
  const verse = index >= 0 ? verses[index] : null;
  const persianText =
    verse?.translations[
      selectedTranslation.textKey as TranslationKey
    ] ?? verse?.persian ?? "";
  const translationWords = useMemo(
    () => persianText.split(/\s+/).filter(Boolean),
    [persianText],
  );

  const goRandom = useCallback(() => {
    setIndex(Math.floor(Math.random() * TOTAL));
  }, []);

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? TOTAL - 1 : i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => (i >= TOTAL - 1 ? 0 : i + 1));
  }, []);

  const togglePlayback = useCallback(
    () => {
      setAudioError("");
      setPlaybackMode((currentMode) => (currentMode === "playing" ? "idle" : "playing"));
    },
    [],
  );

  useEffect(() => {
    const savedIndex = window.localStorage.getItem(STORAGE_KEY);
    const parsedIndex = savedIndex === null ? NaN : Number.parseInt(savedIndex, 10);
    const savedAudioSettings = window.localStorage.getItem(AUDIO_SETTINGS_KEY);

    if (Number.isInteger(parsedIndex) && parsedIndex >= 0 && parsedIndex < TOTAL) {
      setIndex(parsedIndex);
    } else {
      setIndex(Math.floor(Math.random() * TOTAL));
    }

    if (savedAudioSettings) {
      try {
        const parsedSettings = JSON.parse(savedAudioSettings) as {
          translationId?: AudioTranslationId;
          autoAdvanceEnabled?: boolean;
          playbackSpeed?: number;
          highlightOffset?: number;
        };

        if (
          parsedSettings.translationId &&
          AUDIO_TRANSLATIONS.some((translation) => translation.id === parsedSettings.translationId)
        ) {
          setSelectedTranslationId(parsedSettings.translationId);
        }

        if (typeof parsedSettings.autoAdvanceEnabled === "boolean") {
          setIsAutoAdvanceEnabled(parsedSettings.autoAdvanceEnabled);
        }

        if (
          typeof parsedSettings.playbackSpeed === "number" &&
          SPEED_OPTIONS.includes(parsedSettings.playbackSpeed as PlaybackSpeed)
        ) {
          setPlaybackSpeed(parsedSettings.playbackSpeed as PlaybackSpeed);
        }

        if (
          typeof parsedSettings.highlightOffset === "number" &&
          parsedSettings.highlightOffset >= -0.26 &&
          parsedSettings.highlightOffset <= 0.74
        ) {
          setHighlightOffset(parsedSettings.highlightOffset);
        }
      } catch {
        window.localStorage.removeItem(AUDIO_SETTINGS_KEY);
      }
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });
    }

    if ("caches" in window) {
      void window.caches.keys().then((cacheNames) => {
        cacheNames.forEach((cacheName) => {
          void window.caches.delete(cacheName);
        });
      });
    }
  }, []);

  useEffect(() => {
    if (index >= 0) {
      window.localStorage.setItem(STORAGE_KEY, String(index));
    }
  }, [index]);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (!target) {
        return;
      }

      if (settingsSheetRef.current?.contains(target)) {
        return;
      }

      if (settingsButtonRef.current?.contains(target)) {
        return;
      }

      setIsSettingsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isSettingsOpen]);

  useEffect(() => {
    window.localStorage.setItem(
      AUDIO_SETTINGS_KEY,
      JSON.stringify({
        translationId: selectedTranslationId,
        autoAdvanceEnabled: isAutoAdvanceEnabled,
        playbackSpeed,
        highlightOffset,
      }),
    );
  }, [isAutoAdvanceEnabled, highlightOffset, playbackSpeed, selectedTranslationId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === " " || e.key === "r") {
        e.preventDefault();
        goRandom();
      } else if (e.key === "p") {
        e.preventDefault();
        togglePlayback();
      } else if (e.key === "a") {
        e.preventDefault();
        setIsAutoAdvanceEnabled((enabled) => !enabled);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goRandom, goPrev, goNext, togglePlayback]);

  useEffect(() => {
    playbackModeRef.current = playbackMode;
  }, [playbackMode]);

  const clearAudioSource = useCallback(() => {
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (playbackMode !== "idle" || !audioRef.current) {
      return;
    }

    const audio = audioRef.current;
    clearAudioSource();
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    setIsAudioLoading(false);
    setAudioProgress(0);
  }, [clearAudioSource, playbackMode]);

  useEffect(() => {
    if (index < 0 || playbackMode === "idle" || !audioRef.current) {
      return;
    }

    const verse = verses[index];
    const ayahCode = getAyahCode(verse.surah, verse.ayah);
    const audio = audioRef.current;
    const controller = new AbortController();

    clearAudioSource();
    fetchAbortRef.current = controller;
    setIsAudioLoading(true);
    setAudioProgress(0);
    setAudioError("");

    void (async () => {
      try {
        const response = await fetch(
          `/api/audio/${selectedTranslation.id}/${ayahCode}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("Audio request failed");
        }

        const blob = await response.blob();

        if (controller.signal.aborted) {
          return;
        }

        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        fetchAbortRef.current = null;
        audio.src = objectUrl;
        audio.load();

        await audio.play();
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setIsAudioLoading(false);
        setAudioError(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "برای پخش صوت، یک بار روی دکمه پخش بزنید."
            : "پخش صوت انجام نشد.",
        );
        setPlaybackMode("idle");
      }
    })();

    return () => {
      controller.abort();
    };
  }, [clearAudioSource, index, playbackMode, selectedTranslation.id]);

  useEffect(() => clearAudioSource, [clearAudioSource]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    let rafId = 0;

    const getProgress = () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      if (!Number.isFinite(duration) || duration <= 0) {
        return 0;
      }

      const scaledLead = highlightOffset * (audio.playbackRate || 1);
      return Math.min(1, (audio.currentTime + scaledLead) / duration);
    };

    const tick = () => {
      setAudioProgress(getProgress());
      rafId = requestAnimationFrame(tick);
    };

    const handlePlaying = () => {
      setIsAudioLoading(false);
      setAudioError("");
      audio.playbackRate = playbackSpeed;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    };

    const stopRaf = () => {
      cancelAnimationFrame(rafId);
    };

    const handleEnded = () => {
      stopRaf();
      setIsAudioLoading(false);
      setAudioProgress(1);

      if (playbackModeRef.current === "playing" && isAutoAdvanceEnabled) {
        setIndex((currentIndex) => (currentIndex >= TOTAL - 1 ? 0 : currentIndex + 1));
      } else {
        setPlaybackMode("idle");
      }
    };

    const handleError = () => {
      stopRaf();
      setIsAudioLoading(false);
      setAudioError("پخش صوت انجام نشد.");
      setPlaybackMode("idle");
    };

    const handlePause = () => {
      stopRaf();
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
  }, [highlightOffset, index, isAutoAdvanceEnabled, playbackSpeed]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const isPlaying = playbackMode === "playing";
  const highlightedWordCount = isPlaying
    ? Math.min(
        translationWords.length,
        Math.max(1, Math.ceil(audioProgress * translationWords.length)),
      )
    : 0;

  const highlightedSegments = useMemo(() => {
    let seenWords = 0;

    return persianText.split(/(\s+)/).filter(Boolean).map((segment, segmentIndex) => {
      if (/^\s+$/.test(segment)) {
        return {
          key: `${segmentIndex}-space`,
          text: segment,
          highlighted: false,
        };
      }

      seenWords += 1;

      return {
        key: `${segmentIndex}-${segment}`,
        text: segment,
        highlighted: seenWords <= highlightedWordCount,
      };
    });
  }, [highlightedWordCount, persianText]);

  if (!verse) return null;

  return (
    <div className="container">
      <audio ref={audioRef} preload="none" />

      <div className="verse-info">
        <div className="surah-name">{verse.surahName}</div>
        <div className="verse-number">
          آیه {verse.ayah} از {quranData.surahs[verse.surah - 1].totalAyahs}
        </div>
      </div>

      {isSettingsOpen ? (
        <div ref={settingsSheetRef} className="settings-sheet">
          <div className="settings-sheet-header">
            <div className="settings-title">تنظیمات صوت</div>
            <button
              className="settings-close"
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              aria-label="Close settings"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <div className="settings-options">
            {AUDIO_TRANSLATIONS.map((translation) => (
              <button
                key={translation.id}
                className={`settings-option${
                  translation.id === selectedTranslationId ? " settings-option-active" : ""
                }`}
                type="button"
                onClick={() => {
                  setSelectedTranslationId(translation.id);
                  setAudioError("");
                }}
              >
                <span>{translation.label}</span>
                <small>{translation.description}</small>
              </button>
            ))}
          </div>

          <button
            className={`settings-switch${isAutoAdvanceEnabled ? " settings-switch-active" : ""}`}
            type="button"
            onClick={() => setIsAutoAdvanceEnabled((enabled) => !enabled)}
          >
            <span>رفتن خودکار به آیه بعد</span>
            <span className="settings-switch-state">
              {isAutoAdvanceEnabled ? "روشن" : "خاموش"}
            </span>
          </button>

          <div className="speed-control">
            <span className="speed-label">سرعت پخش</span>
            <div className="speed-options">
              {SPEED_OPTIONS.map((speed) => (
                <button
                  key={speed}
                  className={`speed-btn${speed === playbackSpeed ? " speed-btn-active" : ""}`}
                  type="button"
                  onClick={() => setPlaybackSpeed(speed)}
                >
                  {`${speed}x`}
                </button>
              ))}
            </div>
          </div>

          <div className="sync-control">
            <div className="sync-header">
              <span className="sync-label">هماهنگی هایلایت</span>
              <div className="sync-header-right">
                <span className="sync-value">{highlightOffset > 0 ? "+" : ""}{highlightOffset.toFixed(2)}s</span>
                <button
                  className="sync-reset"
                  type="button"
                  onClick={() => setHighlightOffset(DEFAULT_HIGHLIGHT_OFFSET)}
                >
                  بازنشانی
                </button>
              </div>
            </div>
            <div className="sync-slider-row">
              <span className="sync-end-label">عقب‌تر</span>
              <input
                className="sync-slider"
                type="range"
                min={-0.26}
                max={0.74}
                step={0.01}
                value={highlightOffset}
                onChange={(e) => setHighlightOffset(Number(e.target.value))}
              />
              <span className="sync-end-label">جلوتر</span>
            </div>
          </div>

          <div className="settings-note">
            هر آیه قبل از پخش کامل دانلود می‌شود.
          </div>
        </div>
      ) : null}

      <div className="audio-status" aria-live="polite">
        <span>{selectedTranslation.label}</span>
        <span>
          {isPlaying
            ? isAudioLoading
              ? "در حال بارگذاری صوت"
              : isAutoAdvanceEnabled
                ? "پخش با رفتن خودکار"
                : "در حال پخش"
            : isAutoAdvanceEnabled
              ? "رفتن خودکار روشن است"
              : "آماده پخش"}
        </span>
      </div>
      {audioError ? <div className="audio-error">{audioError}</div> : null}

      <div className="controls">
        <button className="btn" onClick={goPrev} aria-label="Previous">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button
          className={`btn${isPlaying ? " btn-active" : ""}`}
          onClick={togglePlayback}
          aria-label="Play translation once"
          title="پخش ترجمه صوتی"
        >
          {isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>
        <button className="btn btn-random" onClick={goRandom} aria-label="Random">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
        </button>
        <button
          ref={settingsButtonRef}
          className={`btn${isSettingsOpen ? " btn-active" : ""}`}
          onClick={() => setIsSettingsOpen((open) => !open)}
          aria-label="Audio settings"
          title="تنظیمات صوت"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button className="btn" onClick={goNext} aria-label="Next">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div className="verse-card">
        <div className={`persian-text${isPlaying ? " persian-text-playing" : ""}`}>
          {highlightedSegments.map((segment) => (
            <span
              key={segment.key}
              className={segment.highlighted ? "persian-word-highlighted" : "persian-word"}
            >
              {segment.text}
            </span>
          ))}
        </div>
        <div className="divider" />
        <div className="arabic-text">{verse.arabic}</div>
      </div>
    </div>
  );
}
