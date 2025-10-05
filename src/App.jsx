import React, { useState, useRef, useMemo } from 'react';
import { Upload, Download, Calendar, MapPin } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Analytics } from "@vercel/analytics/next"

/**
 * FlyerGenerator (Fully Responsive)
 * - All functionality preserved
 * - Scales properly on all screen sizes
 */

function seededRandom(seed) {
  return function () {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function generateScribbles(seed = 1, count = 30, vw = 600, vh = 140) {
  const rand = seededRandom(seed);
  const palette = [
    '#e74c3c', '#c0392b',
    '#3498db', '#2980b9',
    '#2ecc71', '#27ae60',
    '#f1c40f', '#f39c12',
    '#8e44ad', '#9b59b6',
    '#34495e', '#2c3e50',
    '#6b4226'
  ];

  const strokes = [];
  const jitter = (amount) => (rand() * amount * 2) - amount;

  for (let i = 0; i < count; i++) {
    const x0 = (0.05 + rand() * 0.9) * vw;
    const y0 = (0.25 + rand() * 0.7) * vh;

    const segments = 2 + Math.floor(rand() * 6);
    let d = `M ${x0.toFixed(1)} ${y0.toFixed(1)}`;

    let x = x0;
    let y = y0;

    const color = palette[Math.floor(rand() * palette.length)];
    const baseWidth = 1 + Math.floor(rand() * 8);
    const widthVariance = baseWidth * (0.12 + rand() * 0.5);
    const strokeWidth = Math.max(0.8, (baseWidth + jitter(widthVariance)).toFixed(1));
    const opacity = Math.max(0.25, Math.min(0.85, 0.35 + rand() * 0.45));
    const wobble = 14 + rand() * 28;
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

  const seedRef = useRef(Math.floor(Math.random() * 1e9));
  const STROKE_COUNT = 30;

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
      const currentWidth = flyerRef.current.offsetWidth;
      const currentHeight = flyerRef.current.offsetHeight;
      
      const scale = 3;
      const targetWidth = currentWidth * scale;
      const targetHeight = currentHeight * scale;

      toPng(flyerRef.current, {
        width: targetWidth,
        height: targetHeight,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${currentWidth}px`,
          height: `${currentHeight}px`,
        },
        pixelRatio: 1
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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-2 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-4 sm:mb-6 md:mb-8 text-center px-2">
          SignOut Flyer Generator
        </h1>

        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
          {/* Controls Section */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 h-fit">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-4 sm:mb-6">Customize Your Flyer</h2>

            {/* Upload */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
                <Upload className="inline w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                Upload Photo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="block w-full text-xs sm:text-sm text-gray-500 file:mr-2 sm:file:mr-4 file:py-2 sm:file:py-3 file:px-4 sm:file:px-6 file:rounded-full file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer transition"
              />
              <p className="mt-1 sm:mt-2 text-xs text-gray-500">Upload a photo</p>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
                <Calendar className="inline w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                Event Date
              </label>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <input
                  type="text"
                  value={day}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 2) setDay(value);
                  }}
                  placeholder="Day"
                  maxLength={2}
                  className="px-2 sm:px-3 py-2 sm:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center text-xs sm:text-sm text-gray-800"
                />
                <input
                  type="text"
                  value={month}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 12) setMonth(value);
                  }}
                  placeholder="Month"
                  maxLength={12}
                  className="px-2 sm:px-3 py-2 sm:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center text-xs sm:text-sm text-gray-800"
                />
                <input
                  type="text"
                  value={year}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 4) setYear(value);
                  }}
                  placeholder="Year"
                  maxLength={4}
                  className="px-2 sm:px-3 py-2 sm:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center text-xs sm:text-sm text-gray-800"
                />
              </div>
              <p className="mt-1 sm:mt-2 text-xs text-gray-500">Enter your Signout Date</p>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
                <MapPin className="inline w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                Location and Time
              </label>
              <textarea
                value={location}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 50) setLocation(value);
                }}
                placeholder="e.g. Old Pharmacy Building at 5pm"
                rows="3"
                maxLength={50}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none text-xs sm:text-sm text-gray-800"
              />
              <p className="mt-1 sm:mt-2 text-xs text-gray-500">First line is "University of Benin", your text appears as second line (max 50 characters)</p>
            </div>

            {/* Export */}
            <button
              onClick={handleExport}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-lg hover:from-blue-700 hover:to-cyan-700 transition duration-300 flex items-center justify-center gap-2 sm:gap-3 shadow-lg hover:shadow-xl transform hover:scale-105 text-sm sm:text-base"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              Download Flyer
            </button>
          </div>

          {/* Preview Section */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-4 sm:mb-6 text-center">Live Preview</h2>

            <div className="flex justify-center items-center w-full">
              <div className="w-full max-w-[400px] sm:max-w-[450px] md:max-w-[500px] mx-auto" style={{ aspectRatio: '2/3  ' }}>
                <div
                  ref={flyerRef}
                  className="relative bg-white shadow-2xl w-full h-full"
                  style={{
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
                      borderRadius: 'min(0.5em, 8px)',
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
                        <div className="text-center text-gray-400" style={{ padding: 'min(1em, 16px)' }}>
                          <Upload style={{ width: 'min(3em, 48px)', height: 'min(3em, 48px)', margin: '0 auto min(0.5em, 8px)' }} className="opacity-50" />
                          <p style={{ fontSize: 'min(0.75em, 12px)' }} className="font-medium">Your photo will appear here</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Procedural scribbles overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '69%',
                      left: 0,
                      width: '100%',
                      height: '18%',
                      pointerEvents: 'none',
                      zIndex: 5
                    }}
                  >
                    <svg
                      width="100%"
                      height="100%"
                      viewBox="0 0 600 140"
                      preserveAspectRatio="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{ display: 'block' }}
                    >
                      <defs>
                        <filter id="sBlur1" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="0.35" />
                        </filter>
                        <filter id="sBlur2" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="0.6" />
                        </filter>
                      </defs>

                      {scribblePaths.map((s, idx) => {
                        const useFilter = s.blur ? (s.blur > 0.45 ? 'url(#sBlur2)' : 'url(#sBlur1)') : null;
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
                        top: '23%',
                        right: '8%',
                        width: 'clamp(80px, 18%, 120px)',
                        aspectRatio: '1/1',
                        zIndex: 15
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 200 200" transform="rotate(300deg)">
                        <path
                          d={(() => {
                            const points = [];
                            const cx = 100, cy = 100, r = 80;
                            const wave = 8;
                            const spikes = 60;
                            const phaseShift = -Math.PI / 2;

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
                        bottom: '3%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '85%',
                        maxWidth: '90%',
                        display: 'flex',
                        justifyContent: 'center',
                        zIndex: 20
                      }}
                    >
                      <div
                        style={{
                          background: 'black',
                          borderRadius: 'clamp(12px, 1.5em, 24px)',
                          padding: 'clamp(8px, 0.8em, 12px) clamp(6px, 0.5em, 8px)',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                          width: '100%'
                        }}
                      >
                        <div className="flex items-center justify-center" style={{ marginBottom: 'clamp(4px, 0.5em, 8px)', gap: 'clamp(4px, 0.4em, 8px)' }}>
                          <MapPin style={{ width: 'clamp(12px, 0.9em, 14px)', height: 'clamp(12px, 0.9em, 14px)', color: 'white', flexShrink: 0 }} />
                          <p
                            style={{
                              fontSize: 'clamp(11px, 0.85em, 13.6px)',
                              fontWeight: '700',
                              color: 'white',
                              letterSpacing: '0.3px',
                              textAlign: 'center',
                              lineHeight: '1.3',
                              fontFamily: "Poppins, Inter, system-ui, sans-serif"
                            }}
                          >
                            University of Benin
                          </p>
                        </div>
                        <p
                          style={{
                            fontSize: 'clamp(9px, 0.7em, 11.2px)',
                            fontWeight: '400',
                            color: 'rgba(255, 255, 255, 0.88)',
                            letterSpacing: '0.2px',
                            textAlign: 'center',
                            lineHeight: '1.3',
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
    </div>
  );
}