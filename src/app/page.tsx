"use client";

import { useState, useCallback, useEffect } from "react";
import quranData from "@/data/quran.json";

const { verses } = quranData;
const TOTAL = verses.length;
const STORAGE_KEY = "q-rand:index";

export default function Home() {
  const [index, setIndex] = useState<number>(-1);

  const goRandom = useCallback(() => {
    setIndex(Math.floor(Math.random() * TOTAL));
  }, []);

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? TOTAL - 1 : i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => (i >= TOTAL - 1 ? 0 : i + 1));
  }, []);

  useEffect(() => {
    const savedIndex = window.localStorage.getItem(STORAGE_KEY);
    const parsedIndex = savedIndex === null ? NaN : Number.parseInt(savedIndex, 10);

    if (Number.isInteger(parsedIndex) && parsedIndex >= 0 && parsedIndex < TOTAL) {
      setIndex(parsedIndex);
    } else {
      setIndex(Math.floor(Math.random() * TOTAL));
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  useEffect(() => {
    if (index >= 0) {
      window.localStorage.setItem(STORAGE_KEY, String(index));
    }
  }, [index]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === " " || e.key === "r") {
        e.preventDefault();
        goRandom();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goRandom, goPrev, goNext]);

  if (index < 0) return null;

  const verse = verses[index];

  return (
    <div className="container">
      <div className="verse-info">
        <div className="surah-name">{verse.surahName}</div>
        <div className="verse-number">
          آیه {verse.ayah} از {quranData.surahs[verse.surah - 1].totalAyahs}
        </div>
      </div>

      <div className="controls">
        <button className="btn" onClick={goPrev} aria-label="Previous">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button className="btn btn-random" onClick={goRandom} aria-label="Random">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
        </button>
        <button className="btn" onClick={goNext} aria-label="Next">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div className="verse-card">
        <div className="persian-text">{verse.persian}</div>
        <div className="divider" />
        <div className="arabic-text">{verse.arabic}</div>
      </div>
    </div>
  );
}
