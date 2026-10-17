import React, { useEffect, useState, useMemo } from 'react';

interface NasubiClockProps {
  numeralStyle?: 'arabic' | 'roman' | 'minimal';
  showDigital?: boolean;
}

export const NasubiClock: React.FC<NasubiClockProps> = ({
  numeralStyle = 'arabic',
  showDigital = true,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    let animFrame: number;
    const update = () => {
      setNow(new Date());
      animFrame = requestAnimationFrame(update);
    };
    animFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animFrame);
  }, []);

  // Compute Japan Standard Time (UTC+9)
  const jst = useMemo(() => {
    // Current UTC time in ms
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    // JST is UTC + 9 hours
    const jstMs = utcMs + 9 * 3600000;
    const d = new Date(jstMs);

    const ms = d.getMilliseconds();
    const sec = d.getSeconds() + ms / 1000;
    const min = d.getMinutes() + sec / 60;
    const hour = (d.getHours() % 12) + min / 60;

    return {
      date: d,
      hour,
      min,
      sec,
      hours24: d.getHours(),
      minutes: d.getMinutes(),
      seconds: Math.floor(sec),
    };
  }, [now]);

  // Rotations (degrees)
  const hourDeg = (jst.hour / 12) * 360;
  const minDeg = (jst.min / 60) * 360;
  const secDeg = (jst.sec / 60) * 360;

  // Format strings for Japanese display
  const dateString = useMemo(() => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const y = jst.date.getFullYear();
    const m = jst.date.getMonth() + 1;
    const d = jst.date.getDate();
    const dayName = days[jst.date.getDay()];
    return `${y}年${m}月${d}日 (${dayName})`;
  }, [jst.date]);

  const digitalTime = useMemo(() => {
    const hh = String(jst.hours24).padStart(2, '0');
    const mm = String(jst.minutes).padStart(2, '0');
    const ss = String(jst.seconds).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }, [jst.hours24, jst.minutes, jst.seconds]);

  // Numerals array
  const numerals = useMemo(() => {
    if (numeralStyle === 'roman') {
      return ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    }
    if (numeralStyle === 'arabic') {
      return ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
    }
    return ['', '', '', '3', '', '', '6', '', '', '9', '', ''];
  }, [numeralStyle]);

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full p-2 select-none">
      {/* Clock container */}
      <div className="relative w-auto h-full max-w-full max-h-[min(42vh,360px)] md:max-h-[min(85vh,480px)] aspect-square flex items-center justify-center">
        {/* Glow ambient circle */}
        <div className="absolute inset-0 rounded-full bg-purple-950/20 backdrop-blur-md border border-purple-500/20 shadow-2xl shadow-purple-900/30" />

        {/* SVG Clock Dial and Eggplant Hands */}
        <svg
          viewBox="0 0 400 400"
          className="w-full h-full drop-shadow-xl overflow-visible"
        >
          <defs>
            {/* Eggplant Body Gradient - Deep purple with rich sheen */}
            <linearGradient id="eggplantBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4c1d95" />
              <stop offset="35%" stopColor="#2e1065" />
              <stop offset="70%" stopColor="#1e0a38" />
              <stop offset="100%" stopColor="#0d0417" />
            </linearGradient>

            {/* Eggplant Highlight / Glossy Shine */}
            <linearGradient id="eggplantShine" x1="0%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#c084fc" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#a855f7" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#581c87" stopOpacity="0" />
            </linearGradient>

            {/* Eggplant Calyx (ヘタ) Green Gradient */}
            <linearGradient id="calyxGrad" x1="0%" y1="0%" x2="100%" y2="80%">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="30%" stopColor="#22c55e" />
              <stop offset="70%" stopColor="#15803d" />
              <stop offset="100%" stopColor="#14532d" />
            </linearGradient>

            {/* Second Hand Needle Eggplant Gradient */}
            <linearGradient id="secEggplantGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="30%" stopColor="#c026d3" />
              <stop offset="100%" stopColor="#7e22ce" />
            </linearGradient>

            {/* Golden Pivot Center */}
            <radialGradient id="pivotGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="45%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#854d0e" />
            </radialGradient>

            {/* Outer dial ring gradient */}
            <linearGradient id="dialRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
              <stop offset="50%" stopColor="rgba(168,85,247,0.15)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
            </linearGradient>

            {/* Shadow filter for 3D realism */}
            <filter id="handShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="3" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity="0.6" />
            </filter>
            <filter id="secondShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="2" dy="3" stdDeviation="2" floodColor="#000000" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Clock Dial Background Face */}
          <circle
            cx="200"
            cy="200"
            r="186"
            fill="rgba(15, 12, 28, 0.72)"
            stroke="url(#dialRimGrad)"
            strokeWidth="3"
          />
          <circle
            cx="200"
            cy="200"
            r="174"
            fill="none"
            stroke="rgba(168, 85, 247, 0.18)"
            strokeWidth="1.5"
            strokeDasharray="2 6"
          />

          {/* Minute tick marks (60 ticks) */}
          {Array.from({ length: 60 }).map((_, i) => {
            const isHourTick = i % 5 === 0;
            const angle = (i * 6 * Math.PI) / 180;
            const outerR = 172;
            const innerR = isHourTick ? 156 : 164;
            const x1 = 200 + outerR * Math.sin(angle);
            const y1 = 200 - outerR * Math.cos(angle);
            const x2 = 200 + innerR * Math.sin(angle);
            const y2 = 200 - innerR * Math.cos(angle);

            return (
              <line
                key={`tick-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isHourTick ? 'rgba(233, 213, 255, 0.95)' : 'rgba(192, 132, 252, 0.35)'}
                strokeWidth={isHourTick ? 3 : 1.2}
                strokeLinecap="round"
              />
            );
          })}

          {/* Clock Numerals (1 to 12) */}
          {numerals.map((num, i) => {
            if (!num) return null;
            const angle = (i * 30 * Math.PI) / 180;
            const r = 138;
            const x = 200 + r * Math.sin(angle);
            const y = 200 - r * Math.cos(angle);

            return (
              <text
                key={`num-${i}`}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(243, 232, 255, 0.95)"
                fontSize={num.length > 2 ? '17' : '22'}
                fontWeight={i % 3 === 0 ? '700' : '600'}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                className="select-none tracking-tight"
                style={{
                  filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.8))',
                }}
              >
                {num}
              </text>
            );
          })}


          {/* ========================================================== */}
          {/* HOUR HAND: Plump Japanese Eggplant pointing upward at 0° */}
          {/* ========================================================== */}
          <g
            transform={`rotate(${hourDeg} 200 200)`}
            filter="url(#handShadow)"
          >
            {/* Eggplant Body (Shaped curved eggplant tapering to a pointing tip) */}
            <path
              d="
                M 197 195
                C 188 185, 182 165, 184 140
                C 186 115, 192 95, 200 85
                C 208 95, 214 115, 216 140
                C 218 165, 212 185, 203 195
                Z
              "
              fill="url(#eggplantBodyGrad)"
              stroke="#581c87"
              strokeWidth="0.8"
            />
            {/* Glossy Eggplant Sheen Highlight */}
            <path
              d="
                M 192 170
                C 188 155, 189 125, 196 100
                C 197 100, 199 105, 195 130
                C 193 148, 194 165, 192 170
                Z
              "
              fill="url(#eggplantShine)"
            />
            {/* Eggplant Green Calyx (ヘタ) at base & center hub */}
            <path
              d="
                M 191 192
                C 186 182, 182 176, 178 174
                C 183 178, 189 180, 192 183
                C 191 174, 192 168, 196 162
                C 197 172, 198 178, 200 182
                C 202 178, 203 172, 204 162
                C 208 168, 209 174, 208 183
                C 211 180, 217 178, 222 174
                C 218 176, 214 182, 209 192
                Z
              "
              fill="url(#calyxGrad)"
            />
            {/* Stem tip pointing back into center */}
            <path
              d="M 197 195 Q 200 205 200 208 Q 200 205 203 195 Z"
              fill="#15803d"
            />
            {/* Pointer tip dot to accurately read hour */}
            <circle cx="200" cy="85" r="2.5" fill="#facc15" />
          </g>

          {/* ========================================================== */}
          {/* MINUTE HAND: Longer, Slender Elegant Eggplant pointing to rim */}
          {/* ========================================================== */}
          <g
            transform={`rotate(${minDeg} 200 200)`}
            filter="url(#handShadow)"
          >
            {/* Slender Eggplant Body */}
            <path
              d="
                M 197.5 198
                C 189 185, 185 150, 187 110
                C 188 80, 194 55, 200 42
                C 206 55, 212 80, 213 110
                C 215 150, 211 185, 202.5 198
                Z
              "
              fill="url(#eggplantBodyGrad)"
              stroke="#6b21a8"
              strokeWidth="0.8"
            />
            {/* Glossy long reflection */}
            <path
              d="
                M 193 160
                C 189 135, 191 95, 197 55
                C 198 56, 200 65, 196 95
                C 194 125, 195 150, 193 160
                Z
              "
              fill="url(#eggplantShine)"
            />
            {/* Elegant Calyx (ヘタ) with sharp jagged leaves */}
            <path
              d="
                M 192 195
                C 185 186, 178 180, 172 178
                C 178 181, 187 184, 190 188
                C 188 178, 189 168, 194 158
                C 196 170, 198 178, 200 183
                C 202 178, 204 170, 206 158
                C 211 168, 212 178, 210 188
                C 213 184, 222 181, 228 178
                C 222 180, 215 186, 208 195
                Z
              "
              fill="url(#calyxGrad)"
            />
            {/* Fine pointer tip for exact minute reading */}
            <polygon points="199,42 201,42 200,34" fill="#facc15" />
          </g>

          {/* ========================================================== */}
          {/* SECOND HAND: Needle-thin vibrant mini eggplant / chili-nasu */}
          {/* ========================================================== */}
          <g
            transform={`rotate(${secDeg} 200 200)`}
            filter="url(#secondShadow)"
          >
            {/* Counterweight Eggplant Tail */}
            <circle cx="200" cy="235" r="9" fill="url(#secEggplantGrad)" />
            <circle cx="200" cy="235" r="5" fill="#f43f5e" />
            <line x1="200" y1="200" x2="200" y2="246" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />

            {/* Needle shaft */}
            <line x1="200" y1="200" x2="200" y2="28" stroke="#f43f5e" strokeWidth="1.8" strokeLinecap="round" />

            {/* Mini cute eggplant bead on second hand at radius ~130 */}
            <path
              d="
                M 197 125
                C 194 118, 195 105, 200 98
                C 205 105, 206 118, 203 125
                Z
              "
              fill="#c026d3"
            />
            {/* Mini calyx on second eggplant */}
            <path
              d="M 197 125 L 200 128 L 203 125 Z"
              fill="#22c55e"
            />

            {/* Glowing gold needle tip */}
            <circle cx="200" cy="28" r="2.8" fill="#facc15" />
          </g>

          {/* ========================================================== */}
          {/* CENTER PIVOT HUB: Golden metallic boss with purple jewel */}
          {/* ========================================================== */}
          <circle cx="200" cy="200" r="11" fill="url(#pivotGrad)" stroke="#713f12" strokeWidth="1" />
          <circle cx="200" cy="200" r="5.5" fill="#3b0764" />
          <circle cx="198.5" cy="198.5" r="1.8" fill="#e9d5ff" />
        </svg>
      </div>

      {/* Digital JST Display Underneath */}
      {showDigital && (
        <div className="mt-2 text-center select-none flex flex-col items-center">
          <div className="text-2xl md:text-3xl font-mono font-bold tracking-widest text-white drop-shadow-md">
            {digitalTime}
            <span className="text-xs ml-2 font-sans font-medium text-purple-300/80 px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-400/20">
              JST
            </span>
          </div>
          <div className="text-xs md:text-sm text-purple-200/80 tracking-wider font-medium mt-0.5 drop-shadow">
            {dateString}
          </div>
        </div>
      )}
    </div>
  );
};
