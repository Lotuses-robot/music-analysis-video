import React, { useState, useEffect } from "react";
import type { FC } from "react";

interface ChordPickerProps {
  value: string;
  onChange: (value: string) => void;
  currentKey?: string; // e.g., "C"
}

// Circle of Fifths ROOTS
const ROOTS_SHARP = ["C", "G", "D", "A", "E", "B", "F#", "C#", "G#", "D#", "A#", "F"];
const ROOTS_FLAT = ["C", "G", "D", "A", "E", "B", "Gb", "Db", "Ab", "Eb", "Bb", "F"];

// Relative Minor mapping for the inner ring (Conjugate)
const RELATIVE_MINOR_MAP_SHARP: Record<string, string> = {
  "C": "A", "G": "E", "D": "B", "A": "F#", "E": "C#", "B": "G#", 
  "F#": "D#", "C#": "A#", "G#": "F", "D#": "C", "A#": "G", "F": "D"
};
const RELATIVE_MINOR_MAP_FLAT: Record<string, string> = {
  "C": "A", "G": "E", "D": "B", "A": "Gb", "E": "Db", "B": "Ab", 
  "Gb": "Eb", "Db": "Bb", "Ab": "F", "Eb": "C", "Bb": "G", "F": "D"
};

const TYPES = [
  { label: "Maj", value: "" },
  { label: "Min", value: "m" },
  { label: "Dim", value: "dim" },
  { label: "Aug", value: "aug" },
  { label: "Sus2", value: "sus2" },
  { label: "Sus4", value: "sus4" },
  { label: "Power", value: "5" },
];

const INTERVALS = [
  { label: "None", value: "" },
  { label: "6", value: "6" },
  { label: "7", value: "7" },
  { label: "maj7", value: "maj7" },
  { label: "b9", value: "b9" },
  { label: "9", value: "9" },
  { label: "#9", value: "#9" },
  { label: "11", value: "11" },
  { label: "#11", value: "#11" },
  { label: "b13", value: "b13" },
  { label: "13", value: "13" },
];

// Semitones from C
const NOTE_TO_SEMITONE: Record<string, number> = {
  "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11
};

const DEGREES = ["I", "bII", "II", "bIII", "III", "IV", "#IV", "V", "bVI", "VI", "bVII", "VII"];

/**
 *
 * @param root0
 * @param root0.value
 * @param root0.onChange
 * @param root0.currentKey
 */
export const ChordPicker: FC<ChordPickerProps> = ({ value, onChange, currentKey = "C" }) => {
  const [root, setRoot] = useState("C");
  const [type, setType] = useState("");
  const [interval, setInterval] = useState("");
  const [bass, setBass] = useState("");
  const [useFlats, setUseFlats] = useState(false);

  // Auto-detect enharmonic preference based on currentKey
  useEffect(() => {
    const flatKeys = ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"];
    const shouldBeFlats = flatKeys.includes(currentKey);
    setUseFlats(prev => (prev !== shouldBeFlats ? shouldBeFlats : prev));
  }, [currentKey]);

  // Parse initial value
  useEffect(() => {
    if (!value) return;
    
    let remaining = value;
    let b = "";
    if (value.includes("/")) {
      [remaining, b] = value.split("/");
    }
    
    // Check if initial value uses flats
    const hasFlats = value.includes("b");
    
    setBass(prev => (prev !== b ? b : prev));
    if (hasFlats) setUseFlats(true);

    const allRoots = ["C#", "D#", "F#", "G#", "A#", "Db", "Eb", "Gb", "Ab", "Bb", "C", "D", "E", "F", "G", "A", "B"];
    let foundRoot = "C";
    for (const r of allRoots) {
      if (remaining.startsWith(r)) {
        foundRoot = r;
        remaining = remaining.substring(r.length);
        break;
      }
    }
    setRoot(foundRoot);

    let foundType = "";
    const sortedTypes = [...TYPES].filter(t => t.value !== "").sort((a, b) => b.value.length - a.value.length);
    for (const t of sortedTypes) {
      if (remaining.startsWith(t.value)) {
        foundType = t.value;
        remaining = remaining.substring(t.value.length);
        break;
      }
    }
    setType(foundType);
    setInterval(remaining);
  }, [value]);

  const updateChord = (newRoot: string, newType: string, newInterval: string, newBass: string) => {
    let result = `${newRoot}${newType}${newInterval}`;
    if (newBass && newBass !== newRoot) {
      result += `/${newBass}`;
    }
    onChange(result);
  };

  const currentRoots = useFlats ? ROOTS_FLAT : ROOTS_SHARP;
  const currentMinorMap = useFlats ? RELATIVE_MINOR_MAP_FLAT : RELATIVE_MINOR_MAP_SHARP;

  // Calculate degree relative to currentKey
  const getDegree = (r: string, isMinor: boolean) => {
    const keySemi = NOTE_TO_SEMITONE[currentKey] || 0;
    const rootSemi = NOTE_TO_SEMITONE[r] || 0;
    const diff = (rootSemi - keySemi + 12) % 12;
    const degree = DEGREES[diff];
    return isMinor ? degree.toLowerCase() : degree;
  };

  return (
    <div className="chord-picker">
      <div className="chord-picker-layout">
        {/* Left Column: Types */}
        <div className="chord-picker-column type-column">
          <label className="picker-section-label">和弦类型</label>
          <div className="type-grid">
            {TYPES.map(t => (
              <button 
                key={t.value} 
                className={`type-btn-studio ${type === t.value ? "active" : ""}`}
                onClick={() => { setType(t.value); updateChord(root, t.value, interval, bass); }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button 
            className="type-btn-studio" 
            style={{ marginTop: "auto", background: "#444" }}
            onClick={() => setUseFlats(!useFlats)}
          >
            切换 {useFlats ? "#" : "b"}
          </button>
        </div>

        {/* Middle: Dual Ring (SVG) */}
        <div className="chord-picker-main">
          <div className="chord-ring-svg-wrapper">
            <svg viewBox="0 0 300 300" className="chord-ring-svg">
              <circle cx="150" cy="150" r="140" fill="#252525" />
              
              {/* Outer Ring: Major Roots */}
              {currentRoots.map((r, i) => {
                const angle = i * 30 - 90;
                const startAngle = (angle - 15) * Math.PI / 180;
                const endAngle = (angle + 15) * Math.PI / 180;
                const isActive = root === r && type !== "m";
                
                return (
                  <g key={`outer-${r}`} onClick={() => { setRoot(r); setType(""); updateChord(r, "", interval, bass); }} style={{ cursor: "pointer" }}>
                    <path
                      d={`M ${150 + Math.cos(startAngle) * 100} ${150 + Math.sin(startAngle) * 100} L ${150 + Math.cos(startAngle) * 140} ${150 + Math.sin(startAngle) * 140} A 140 140 0 0 1 ${150 + Math.cos(endAngle) * 140} ${150 + Math.sin(endAngle) * 140} L ${150 + Math.cos(endAngle) * 100} ${150 + Math.sin(endAngle) * 100} A 100 100 0 0 0 ${150 + Math.cos(startAngle) * 100} ${150 + Math.sin(startAngle) * 100} Z`}
                      fill={isActive ? "var(--accent)" : "transparent"}
                      className="ring-segment-path"
                    />
                    <text
                      x={150 + Math.cos(angle * Math.PI / 180) * 120}
                      y={150 + Math.sin(angle * Math.PI / 180) * 120}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={isActive ? "#000" : "#fff"}
                      fontSize="14"
                      fontWeight="700"
                    >
                      {r}
                    </text>
                  </g>
                );
              })}

              {/* Inner Ring: Minor Roots (Conjugate) */}
              {currentRoots.map((majorRoot, i) => {
                const minorRoot = currentMinorMap[majorRoot] || majorRoot;
                const angle = i * 30 - 90;
                const startAngle = (angle - 15) * Math.PI / 180;
                const endAngle = (angle + 15) * Math.PI / 180;
                const isActive = root === minorRoot && type === "m";
                
                return (
                  <g key={`inner-${minorRoot}`} onClick={() => { setRoot(minorRoot); setType("m"); updateChord(minorRoot, "m", interval, bass); }} style={{ cursor: "pointer" }}>
                    <path
                      d={`M ${150 + Math.cos(startAngle) * 60} ${150 + Math.sin(startAngle) * 60} L ${150 + Math.cos(startAngle) * 98} ${150 + Math.sin(startAngle) * 98} A 98 98 0 0 1 ${150 + Math.cos(endAngle) * 98} ${150 + Math.sin(endAngle) * 98} L ${150 + Math.cos(endAngle) * 60} ${150 + Math.sin(endAngle) * 60} A 60 60 0 0 0 ${150 + Math.cos(startAngle) * 60} ${150 + Math.sin(startAngle) * 60} Z`}
                      fill={isActive ? "var(--accent)" : "rgba(255,255,255,0.05)"}
                      stroke="#111"
                      strokeWidth="1"
                      className="ring-segment-path"
                    />
                    <text
                      x={150 + Math.cos(angle * Math.PI / 180) * 78}
                      y={150 + Math.sin(angle * Math.PI / 180) * 78}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={isActive ? "#000" : "#888"}
                      fontSize="11"
                      fontWeight="600"
                    >
                      {minorRoot}m
                    </text>
                  </g>
                );
              })}

              {/* Center Circle */}
              <circle cx="150" cy="150" r="55" fill="#151515" stroke="#333" strokeWidth="2" />
              <text x="150" y="145" textAnchor="middle" dominantBaseline="middle" fill="var(--accent)" fontSize="22" fontWeight="900">
                {value || "—"}
              </text>
              <text x="150" y="170" textAnchor="middle" dominantBaseline="middle" fill="#666" fontSize="14" fontWeight="700">
                {root ? getDegree(root, type === "m") : ""}
              </text>
            </svg>
          </div>
        </div>

        {/* Right Column: Intervals & Bass */}
        <div className="chord-picker-column intervals-column">
          <div className="picker-sub-section">
            <label className="picker-section-label">音程 (Intervals)</label>
            <div className="interval-grid-studio">
              {INTERVALS.map(inv => (
                <button 
                  key={inv.value} 
                  className={`interval-btn-studio ${interval === inv.value ? "active" : ""}`}
                  onClick={() => { setInterval(inv.value); updateChord(root, type, inv.value, bass); }}
                >
                  {inv.label}
                </button>
              ))}
            </div>
          </div>

          <div className="picker-sub-section">
            <label className="picker-section-label">低音 (Bass Override)</label>
            <div className="bass-selector-studio">
              <select 
                className="studio-select"
                value={bass} 
                onChange={(e) => { setBass(e.target.value); updateChord(root, type, interval, e.target.value); }}
              >
                <option value="">跟随根音</option>
                {currentRoots.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
