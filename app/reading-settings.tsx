"use client";

import { useEffect, useId, useRef, useState } from "react";

type Appearance = "system" | "light" | "dark" | "sepia";
type TextScale = "small" | "normal" | "large";

type ReadingPreferences = {
  appearance: Appearance;
  readingMode: boolean;
  textScale: TextScale;
  reduceMotion: boolean;
};

type ReadingPreferencesApi = {
  read: () => ReadingPreferences;
  write: (value: ReadingPreferences) => ReadingPreferences;
};

declare global {
  interface Window {
    TJDFTReadingPreferences?: ReadingPreferencesApi;
  }
}

const DEFAULTS: ReadingPreferences = {
  appearance: "light",
  readingMode: false,
  textScale: "normal",
  reduceMotion: false,
};

function normalize(value: Partial<ReadingPreferences> | null | undefined): ReadingPreferences {
  return {
    appearance: value?.appearance === "system" || value?.appearance === "dark" || value?.appearance === "sepia" ? value.appearance : "light",
    readingMode: value?.readingMode === true,
    textScale: value?.textScale === "small" || value?.textScale === "large" ? value.textScale : "normal",
    reduceMotion: value?.reduceMotion === true,
  };
}

function readFallback() {
  try {
    const raw = window.localStorage.getItem("tjdft-dashboard:reading-preferences:v1");
    return normalize(raw ? JSON.parse(raw) : DEFAULTS);
  } catch {
    return { ...DEFAULTS };
  }
}

export default function ReadingSettings() {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const panelId = `tjdft-reading-settings-${reactId}`;
  const hostRef = useRef<HTMLDivElement>(null);
  const [preferences, setPreferences] = useState<ReadingPreferences>(DEFAULTS);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setPreferences(normalize(window.TJDFTReadingPreferences?.read() ?? readFallback()));
    const handleChange = () => sync();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "tjdft-dashboard:reading-preferences:v1") sync();
    };
    sync();
    window.addEventListener("tjdft-reading-preferences-change", handleChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("tjdft-reading-preferences-change", handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !hostRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [open]);

  const update = (patch: Partial<ReadingPreferences>) => {
    const next = normalize({ ...preferences, ...patch });
    const stored = window.TJDFTReadingPreferences?.write(next);
    if (!stored) {
      try {
        window.localStorage.setItem("tjdft-dashboard:reading-preferences:v1", JSON.stringify(next));
      } catch {
        // O navegador pode bloquear storage; a preferência ainda vale nesta renderização.
      }
    }
    setPreferences(normalize(stored ?? next));
  };

  return (
    <div className="reading-settings-host" data-reading-settings ref={hostRef}>
      <button
        type="button"
        className="reading-settings-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        title="Abrir configurações de conforto"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="reading-settings-trigger-icon" aria-hidden="true">◐</span>
        <span className="reading-settings-trigger-text">Conforto</span>
      </button>
      <div className="reading-settings-panel" id={panelId} hidden={!open}>
        <div className="reading-settings-heading"><strong>Conforto de leitura</strong><small>Salvo neste aparelho</small></div>
        <label className="reading-settings-field"><span>Aparência</span><select value={preferences.appearance} onChange={(event) => update({ appearance: event.target.value as Appearance })} aria-label="Escolher aparência"><option value="system">Sistema</option><option value="light">Clara</option><option value="dark">Escura</option><option value="sepia">Conforto (sépia)</option></select></label>
        <label className="reading-settings-field"><span>Tamanho do texto</span><select value={preferences.textScale} onChange={(event) => update({ textScale: event.target.value as TextScale })} aria-label="Escolher tamanho do texto"><option value="small">Menor</option><option value="normal">Normal</option><option value="large">Maior</option></select></label>
        <label className="reading-settings-check"><input type="checkbox" checked={preferences.readingMode} onChange={(event) => update({ readingMode: event.target.checked })} /><span>Modo leitura <small>menos distrações</small></span></label>
        <label className="reading-settings-check"><input type="checkbox" checked={preferences.reduceMotion} onChange={(event) => update({ reduceMotion: event.target.checked })} /><span>Reduzir animações <small>mais estabilidade visual</small></span></label>
        <button type="button" className="reading-settings-reset" onClick={() => update(DEFAULTS)}>Restaurar padrão</button>
      </div>
    </div>
  );
}
