import React, { useState, useRef, useMemo } from 'react';
import { Upload, Download, Calendar, MapPin } from 'lucide-react';
import { toPng } from 'html-to-image';

/**
 * FlyerGenerator (fixed)
 * - Preserves your UI & layout
 * - Reduced scribbles count and positioned them at the very bottom (less clutter)
 * - Fixed syntax errors (fontFamily quoting) and kept export using html-to-image
 */

function seededRandom(seed) {
  // Simple LCG for deterministic randomness if seeded
  return function () {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function generateScribbles(seed = 1, count = 30, vw = 600, vh = 140) {
  const rand = seededRandom(seed);
  const palette = [
    '#e74c3c', '#c0392b', // reds
    '#3498db', '#2980b9', // blues
    '#2ecc71', '#27ae60', // greens
    '#f1c40f', '#f39c12', // yellows/orange
    '#8e44ad', '#9b59b6', // purple
    '#34495e', '#2c3e50', // darks
    '#6b4226' // brownish
  ];

  const strokes = [];

  // Utility to jitter a value
  const jitter = (amount) => (rand() * amount * 2) - amount;

  for (let i = 0; i < count; i++) {
    // Bias strokes toward bottom area by shifting y0 range lower (vh is the band height)
    const x0 = (0.05 + rand() * 0.9) * vw;
    const y0 = (0.25 + rand() * 0.7) * vh;

    const segments = 2 + Math.floor(rand() * 6); // fewer segments for simpler strokes
    let d = `M ${x0.toFixed(1)} ${y0.toFixed(1)}`;

    let x = x0;
    let y = y0;

    // stroke style variations
    const color = palette[Math.floor(rand() * palette.length)];
    const baseWidth = 1 + Math.floor(rand() * 8); // slightly smaller widths
    const widthVariance = baseWidth * (0.12 + rand() * 0.5);
    const strokeWidth = Math.max(0.8, (baseWidth + jitter(widthVariance)).toFixed(1));
    // reduce opacity baseline so overall is less busy
    const opacity = Math.max(0.25, Math.min(0.85, 0.35 + rand() * 0.45));
    const wobble = 14 + rand() * 28; // control point spread

    // small chance for loopy stroke style
    const loopy = rand() < 0.2;

    for (let s = 0; s < segments; s++) {
      const cx = x + jitter(wobble);
      const cy = y + jitter(wobble * 0.9);

      const nx = Math.max(0, Math.min(vw, x + (rand() * vw * 0.12) - vw * 0.06 + jitter(30)));
      const ny = Math.max(0, Math.min(vh, y + (rand() * vh * 0.12) - vh * 0.06 + jitter(30)));

      if (loopy && rand() < 0.35) {
        const midx = (x + nx) / 2 + jitter(12);
        const midy = (y + ny) / 2 + jitter(12);
        d += ` Q ${cx.toFixed(1)} ${cy.toFixed(1)}, ${midx.toFixed(1)} ${midy.toFixed(1)}`;
        d += ` Q ${(midx + jitter(10)).toFixed(1)} ${(midy + jitter(10)).toFixed(1)}, ${nx.toFixed(1)} ${ny.toFixed(1)}`;
      } else {
        d += ` Q ${cx.toFixed(1)} ${cy.toFixed(1)}, ${nx.toFixed(1)} ${ny.toFixed(1)}`;
      }

      x = nx;
      y = ny;
    }

    // small quick attached strokes sometimes
    const extra = rand() < 0.18;
    if (extra) {
      const exSegments = 1 + Math.floor(rand() * 2);
      let exStartX = x + jitter(6);
      let exStartY = y + jitter(6);
      d += ` M ${exStartX.toFixed(1)} ${exStartY.toFixed(1)}`;
      for (let k = 0; k < exSegments; k++) {
        const exNx = Math.max(0, Math.min(vw, exStartX + jitter(40)));
        const exNy = Math.max(0, Math.min(vh, exStartY + jitter(40)));
        d += ` Q ${(exStartX + jitter(12)).toFixed(1)} ${(exStartY + jitter(12)).toFixed(1)}, ${exNx.toFixed(1)} ${exNy.toFixed(1)}`;
        exStartX = exNx;
        exStartY = exNy;
      }
    }

    strokes.push({
      d,
      stroke: color,
      strokeWidth,
      opacity: +opacity.toFixed(2),
      strokeDasharray: rand() < 0.06 ? `${2 + Math.floor(rand() * 6)} ${3 + Math.floor(rand() * 8)}` : null,
      blur: rand() < 0.08 ? 0.25 + rand() * 0.6 : 0
    });
  }

  // Add 1-2 heavier dark "pen signature" strokes but keep them subtle
  const heavyCount = Math.max(1, Math.floor(rand() * 2));
  for (let p = 0; p < heavyCount; p++) {
    const sx = 0.12 * vw + rand() * vw * 0.5;
    const sy = 0.55 * vh + rand() * vh * 0.35;
    const ex = 0.82 * vw - rand() * vw * 0.08;
    const ey = 0.75 * vh + rand() * vh * 0.12;
    const controlOffset = 60 + rand() * 100;
    const dSig = `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${(sx + controlOffset).toFixed(1)} ${(sy - controlOffset / 2).toFixed(1)}, ${((sx + ex) / 2).toFixed(1)} ${((sy + ey) / 2).toFixed(1)} T ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    strokes.push({
      d: dSig,
      stroke: '#2b2b2b',
      strokeWidth: 8 + Math.floor(rand() * 8),
      opacity: 0.7 - rand() * 0.15,
      strokeDasharray: null,
      blur: 0.05 + rand() * 0.25
    });
  }

  return strokes;
}

export default function FlyerGenerator() {
  const [photo, setPhoto] = useState(null);
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [location, setLocation] = useState('');
  const flyerRef = useRef(null);

  // stable seed so scribbles don't re-render every frame; change if you want a new set
  const seedRef = useRef(Math.floor(Math.random() * 1e9));
  // REDUCED stroke count (you requested fewer scribbles)
  const STROKE_COUNT = 30;

  // prepare scribble data once per mount (useMemo)
  // NOTE: we generate for a smaller vertical region (vh small) because overlay will be a bottom strip
  const scribblePaths = useMemo(() => {
    return generateScribbles(seedRef.current, STROKE_COUNT, 600, 140);
  }, [STROKE_COUNT]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleExport = async () => {
    if (flyerRef.current) {
      const targetWidth = 600;
      const targetHeight = 900;

      toPng(flyerRef.current, {
        width: targetWidth,
        height: targetHeight,
        style: {
          width: `${targetWidth}px`,
          height: `${targetHeight}px`,
        },
        pixelRatio: 3
      })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = 'signout-flyer-hd.png';
          link.href = dataUrl;
          link.click();
        })
        .catch((error) => {
          console.error('Export failed:', error);
        });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-8 text-center">
          SignOut Flyer Generator
        </h1>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Controls Section */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 space-y-6 h-fit">
            <h2 className="text-2xl font-semibold text-gray-700 mb-6">Customize Your Flyer</h2>

            {/* Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <Upload className="inline w-5 h-5 mr-2" />
                Upload Photo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer transition"
              />
              <p className="mt-2 text-xs text-gray-500">Upload a photo</p>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <Calendar className="inline w-5 h-5 mr-2" />
                Event Date
              </label>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  placeholder="Day (26)"
                  className="px-3 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center text-gray-800"
                />
                <input
                  type="text"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  placeholder="Month (Sept.)"
                  className="px-3 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center text-gray-800"
                />
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="Year (2025)"
                  className="px-3 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center text-gray-800"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">Enter your Signout Date</p>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <MapPin className="inline w-5 h-5 mr-2" />
                Location
              </label>
              <textarea
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Old Pharmacy Building at 5pm"
                rows="3"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none text-gray-800"
              />
              <p className="mt-2 text-xs text-gray-500">First line is "University of Benin", your text appears as second line</p>
            </div>

            {/* Export */}
            <button
              onClick={handleExport}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-4 px-6 rounded-lg hover:from-blue-700 hover:to-cyan-700 transition duration-300 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Download className="w-5 h-5" />
              Download Flyer
            </button>
          </div>

          {/* Preview Section */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
            <h2 className="text-2xl font-semibold text-gray-700 mb-6 text-center">Live Preview</h2>

            <div className="flex justify-center overflow-auto">
              <div
                ref={flyerRef}
                className="relative bg-white shadow-2xl"
                style={{
                  width: '600px',
                  height: '1000px',
                  overflow: 'hidden',
                }}
              >
                {/* Background template */}
                <img
                  src="/flyer-template.png"
                  alt="template"
                  crossOrigin="anonymous"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none',
                    userSelect: 'none'
                  }}
                />

                {/* Photo Box with fade */}
                <div
                  className="absolute"
                  style={{
                    top: '27%',
                    left: '15.7%',
                    width: '70.2%',
                    height: '52.5%',
                    overflow: 'hidden',
                    borderRadius: '.5em',
                    position: 'relative',
                    zIndex: 1
                  }}
                >
                  {photo ? (
                    <div className="w-full h-full relative">
                      <img
                        src={photo}
                        alt="Uploaded"
                        crossOrigin="anonymous"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          objectPosition: 'center'
                        }}
                      />
                      {/* Fade overlay */}
                      <div
                        className="absolute inset-0"
                        style={{
                          background: 'linear-gradient(to bottom, rgba(0,0,0,0) 75%, white 100%)',
                          pointerEvents: 'none'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white bg-opacity-80">
                      <div className="text-center text-gray-400">
                        <Upload className="w-16 h-16 mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium">Your photo will appear here</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* --- Procedural scribbles overlay (reduced & shifted down) --- */}
                <div
                  style={{
                    position: 'absolute',
                    top: '69%',      // moved down so scribbles only appear at very bottom
                    left: 0,
                    width: '100%',
                    height: '18%',   // narrow bottom band
                    pointerEvents: 'none',
                    zIndex: 5
                  }}
                >
                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 600 140"   // viewBox matches smaller band height
                    preserveAspectRatio="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ display: 'block' }}
                  >
                    <defs>
                      {/* subtle blur filters for some strokes */}
                      <filter id="sBlur1" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="0.35" />
                      </filter>
                      <filter id="sBlur2" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="0.6" />
                      </filter>
                    </defs>

                    {scribblePaths.map((s, idx) => {
                      // assign some strokes to the blur filters randomly for softness
                      const useFilter = s.blur ? (s.blur > 0.45 ? 'url(#sBlur2)' : 'url(#sBlur1)') : null;
                      // lower overall opacity to reduce clutter
                      const renderOpacity = Math.min(1, (s.opacity || 0.6) * 0.7);
                      return (
                        <path
                          key={idx}
                          d={s.d}
                          stroke={s.stroke}
                          strokeWidth={s.strokeWidth}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                          opacity={renderOpacity}
                          strokeDasharray={s.strokeDasharray || undefined}
                          style={{
                            filter: useFilter,
                            mixBlendMode: 'normal'
                          }}
                        />
                      );
                    })}
                  </svg>
                </div>

                {/* Date Badge - SVG Circle */}
                {(day || month || year) && (
                  <div
                    className="absolute"
                    style={{
                      top: '25%',
                      right: '2%',
                      width: '9em',
                      zIndex: 15
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 200 200" transform="rotate(300deg)" >
<path
    d={(() => {
      const points = [];
      const cx = 100, cy = 100, r = 80;
      const wave = 8;         // amplitude of the wave
      const spikes = 60;      // number of bumps
      const phaseShift = -Math.PI / 2; // shift by -90° so wave starts at the top

      for (let i = 0; i <= spikes; i++) {
        const angle = (i / spikes) * Math.PI * 2 + phaseShift;
        const radius = r + wave * Math.sin(angle * 6);
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
      }

      return points.join(' ') + ' Z';
    })()}
    fill="black"
  />

                      <text
                        x="100"
                        y="95"
                        textAnchor="middle"
                        fontFamily="Poppins, Inter, system-ui, sans-serif"
                        fontSize="52"
                        fill="#ffffff"
                        fontWeight="800"
                      >
                        {day}
                      </text>
                      <text
                        x="100"
                        y="120"
                        textAnchor="middle"
                        fontFamily="Poppins, Inter, system-ui, sans-serif"
                        fontSize="16"
                        fill="#ffffff"
                        fontWeight="400"
                      >
                        {month}
                      </text>
                      <text
                        x="100"
                        y="145"
                        textAnchor="middle"
                        fontFamily="Poppins, Inter, system-ui, sans-serif"
                        fontSize="18"
                        fill="#ffffff"
                        fontWeight="600"
                      >
                        {year}
                      </text>
                    </svg>
                  </div>
                )}

                {/* Location Box - Black Rounded Rectangle */}
                {location && location.trim() !== '' && (
                  <div
                    className="absolute"
                    style={{
                      bottom: '35px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '80%',
                      display: 'flex',
                      justifyContent: 'center',
                      zIndex: 20
                    }}
                  >
                    <div
                      style={{
                        background: 'black',
                        borderRadius: '28px',
                        padding: '1em .5em',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                        width: '100%'
                      }}
                    >
                      {/* Hardcoded First Line */}
                      <div className="flex items-center justify-center gap-2" style={{ marginBottom: '10px' }}>
                        <MapPin style={{ width: '18px', height: '18px', color: 'white' }} />
                        <p
                          style={{
                            fontSize: '1em',
                            fontWeight: '700',
                            color: 'white',
                            letterSpacing: '0.3px',
                            textAlign: 'center',
                            lineHeight: '1.5',
                            fontFamily: "Poppins, Inter, system-ui, sans-serif"
                          }}
                        >
                          University of Benin
                        </p>
                      </div>
                      {/* User Input Second Line */}
                      <p
                        style={{
                          fontSize: '13px',
                          fontWeight: '400',
                          color: 'rgba(255, 255, 255, 0.88)',
                          letterSpacing: '0.3px',
                          textAlign: 'center',
                          lineHeight: '1.5',
                          fontFamily: "Poppins, Inter, system-ui, sans-serif"
                        }}
                      >
                        {location}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
