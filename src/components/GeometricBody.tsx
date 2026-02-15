import { useState } from 'react';
import { BodyZone, BODY_ZONES } from '@/data/bodyZoneMapping';

interface GeometricBodyProps {
  zoneIntensities: Record<BodyZone, number>;
  onZoneTap?: (zone: BodyZone) => void;
  className?: string;
}

// Realistic human silhouette paths for each clickable zone
const ZONE_SHAPES: Record<BodyZone, { paths: string[]; center: { x: number; y: number } }> = {
  brain: {
    paths: [
      // Realistic head/skull shape
      'M180,18 C166,18 155,30 155,48 C155,58 158,66 163,72 C165,74 168,76 170,77 L190,77 C192,76 195,74 197,72 C202,66 205,58 205,48 C205,30 194,18 180,18 Z',
    ],
    center: { x: 180, y: 48 },
  },
  heart: {
    paths: [
      // Chest/torso upper region
      'M148,110 C148,105 155,98 165,96 L195,96 C205,98 212,105 212,110 L212,145 C212,148 210,150 207,150 L153,150 C150,150 148,148 148,145 Z',
    ],
    center: { x: 180, y: 123 },
  },
  arms: {
    paths: [
      // Left arm - natural shape
      'M140,100 C132,102 125,108 122,115 L115,140 C112,150 110,162 112,172 L116,185 C118,190 122,192 126,190 L132,185 C136,180 138,170 138,160 L140,135 C142,125 143,115 142,108 Z',
      // Right arm
      'M220,100 C228,102 235,108 238,115 L245,140 C248,150 250,162 248,172 L244,185 C242,190 238,192 234,190 L228,185 C224,180 222,170 222,160 L220,135 C218,125 217,115 218,108 Z',
    ],
    center: { x: 126, y: 145 },
  },
  core: {
    paths: [
      // Abdomen/midsection
      'M153,152 L207,152 L210,175 C211,185 210,195 208,205 L205,215 L155,215 L152,205 C150,195 149,185 150,175 Z',
    ],
    center: { x: 180, y: 183 },
  },
  hormonal: {
    paths: [
      // Lower abdomen / pelvic region
      'M155,217 L205,217 L208,232 C210,242 208,250 202,256 L195,260 L165,260 L158,256 C152,250 150,242 152,232 Z',
    ],
    center: { x: 180, y: 238 },
  },
  legs: {
    paths: [
      // Left leg
      'M160,262 L177,262 L178,310 C178,330 176,350 173,370 C172,380 170,390 168,398 L165,410 C164,414 162,416 160,416 L157,414 C155,410 154,400 155,388 C156,370 156,350 155,330 L154,295 C153,280 154,270 156,264 Z',
      // Right leg
      'M183,262 L200,262 L204,264 C206,270 207,280 206,295 L205,330 C204,350 204,370 205,388 C206,400 205,410 203,414 L200,416 C198,416 196,414 195,410 L192,398 C190,390 188,380 187,370 C184,350 182,330 182,310 Z',
    ],
    center: { x: 180, y: 340 },
  },
  immune: {
    paths: [
      // Neck / lymph nodes area
      'M170,78 L190,78 L192,82 C193,86 194,90 194,94 L166,94 C166,90 167,86 168,82 Z',
      // Small lymph node markers at key locations
      'M144,108 C140,106 137,108 137,112 C137,116 140,118 144,116 C148,114 148,110 144,108 Z',
      'M216,108 C220,106 223,108 223,112 C223,116 220,118 216,116 C212,114 212,110 216,108 Z',
    ],
    center: { x: 180, y: 86 },
  },
};

// Full body silhouette outline for background context
const BODY_OUTLINE = 'M180,14 C164,14 151,28 151,48 C151,60 155,70 162,76 L164,78 C164,82 163,88 163,94 L140,100 C130,103 122,110 118,118 L110,145 C107,156 106,168 108,178 L113,192 C115,198 120,200 125,198 C125,198 130,195 134,188 C137,182 139,173 139,163 L140,142 C142,130 146,120 152,112 L152,150 L150,172 C149,184 149,196 151,208 L153,218 L150,232 C148,244 150,254 156,262 L160,266 L157,270 C154,276 153,284 153,296 L154,335 C154,355 155,375 156,392 C157,402 156,412 154,418 C153,422 154,426 157,428 L162,430 C166,430 169,426 170,420 L173,400 C176,384 178,366 179,348 L180,330 L181,348 C182,366 184,384 187,400 L190,420 C191,426 194,430 198,430 L203,428 C206,426 207,422 206,418 C204,412 203,402 204,392 C205,375 206,355 206,335 L207,296 C207,284 206,276 203,270 L200,266 L204,262 C210,254 212,244 210,232 L207,218 L209,208 C211,196 211,184 210,172 L208,150 L208,112 C214,120 218,130 220,142 L221,163 C221,173 223,182 226,188 C230,195 235,198 235,198 C240,200 245,198 247,192 L252,178 C254,168 253,156 250,145 L242,118 C238,110 230,103 220,100 L197,94 C197,88 196,82 196,78 L198,76 C205,70 209,60 209,48 C209,28 196,14 180,14 Z';

const GeometricBody = ({ zoneIntensities, onZoneTap, className = '' }: GeometricBodyProps) => {
  const [hoveredZone, setHoveredZone] = useState<BodyZone | null>(null);

  return (
    <div className={`w-full h-full flex items-center justify-center ${className}`}>
      <svg
        viewBox="95 5 170 435"
        className="w-full h-full max-h-[440px]"
        style={{ filter: 'drop-shadow(0 0 20px hsla(190, 100%, 50%, 0.08))' }}
      >
        <defs>
          {/* Zone glow filters */}
          {Object.entries(BODY_ZONES).map(([zone, info]) => (
            <filter key={zone} id={`glow-${zone}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feFlood floodColor={info.color} floodOpacity="0.6" result="color" />
              <feComposite in2="blur" operator="in" result="shadow" />
              <feMerge>
                <feMergeNode in="shadow" />
                <feMergeNode in="shadow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}

          {/* Subtle body ambient gradient */}
          <radialGradient id="ambientGlow" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="hsl(200, 80%, 50%)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>

          {/* Clip for inner effects */}
          <clipPath id="bodyClip">
            <path d={BODY_OUTLINE} />
          </clipPath>
        </defs>

        {/* Ambient background glow */}
        <ellipse cx="180" cy="220" rx="90" ry="220" fill="url(#ambientGlow)" />

        {/* Body silhouette - subtle fill with soft edge */}
        <path
          d={BODY_OUTLINE}
          fill="hsl(220, 30%, 12%)"
          fillOpacity="0.5"
          stroke="hsl(200, 40%, 40%)"
          strokeWidth="0.8"
          strokeOpacity="0.25"
        />

        {/* Internal anatomy hint lines (very subtle) */}
        <g clipPath="url(#bodyClip)" opacity="0.06" stroke="hsl(200, 60%, 60%)" strokeWidth="0.4" fill="none">
          {/* Spine */}
          <path d="M180,78 L180,260" />
          {/* Ribs */}
          <path d="M160,110 C170,108 190,108 200,110" />
          <path d="M158,120 C168,117 192,117 202,120" />
          <path d="M156,130 C168,127 192,127 204,130" />
          <path d="M155,140 C168,137 192,137 205,140" />
          {/* Pelvis hint */}
          <path d="M158,230 C165,225 195,225 202,230" />
          <path d="M160,240 C170,250 190,250 200,240" />
        </g>

        {/* Interactive zone overlays */}
        {Object.entries(ZONE_SHAPES).map(([zoneKey, shape]) => {
          const zone = zoneKey as BodyZone;
          const intensity = zoneIntensities[zone];
          const info = BODY_ZONES[zone];
          const isHovered = hoveredZone === zone;
          const isActive = intensity > 0.1;

          const fillOpacity = isHovered
            ? 0.3 + intensity * 0.15
            : isActive
              ? 0.08 + intensity * 0.18
              : 0.03;

          const strokeOpacity = isHovered ? 0.8 : isActive ? 0.2 + intensity * 0.4 : 0.08;
          const strokeWidth = isHovered ? 1.5 : isActive ? 0.8 : 0.4;
          const useGlow = isHovered || intensity > 0.5;

          return (
            <g
              key={zone}
              style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
              onClick={() => onZoneTap?.(zone)}
              onPointerEnter={() => setHoveredZone(zone)}
              onPointerLeave={() => setHoveredZone(null)}
            >
              {shape.paths.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill={info.color}
                  fillOpacity={fillOpacity}
                  stroke={info.color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={strokeOpacity}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  style={{
                    transition: 'all 0.3s ease',
                    filter: useGlow ? `url(#glow-${zone})` : 'none',
                  }}
                />
              ))}

              {/* Pulse animation for active zones */}
              {isActive && (
                <circle
                  cx={shape.center.x}
                  cy={shape.center.y}
                  r="2"
                  fill={info.color}
                  opacity="0"
                >
                  <animate
                    attributeName="r"
                    values="2;10;2"
                    dur={`${3 - intensity}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values={`${intensity * 0.3};0;${intensity * 0.3}`}
                    dur={`${3 - intensity}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          );
        })}

        {/* Hover tooltip */}
        {hoveredZone && (() => {
          const shape = ZONE_SHAPES[hoveredZone];
          const info = BODY_ZONES[hoveredZone];
          const intensity = zoneIntensities[hoveredZone];
          const tooltipY = Math.max(shape.center.y - 20, 12);
          const tooltipX = shape.center.x > 190 ? shape.center.x - 55 : shape.center.x < 170 ? shape.center.x - 10 : shape.center.x - 30;

          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={tooltipX}
                y={tooltipY - 8}
                width="68"
                height="16"
                rx="4"
                fill="hsl(220, 30%, 8%)"
                fillOpacity="0.95"
                stroke={info.color}
                strokeWidth="0.6"
                strokeOpacity="0.5"
              />
              <text
                x={tooltipX + 34}
                y={tooltipY + 3}
                textAnchor="middle"
                fill={info.color}
                fontSize="7"
                fontFamily="'Inter', sans-serif"
                fontWeight="600"
              >
                {info.label} {Math.round(intensity * 100)}%
              </text>
            </g>
          );
        })()}

        {/* Subtle scanning line */}
        <line
          x1="105" y1="0" x2="255" y2="0"
          stroke="hsl(200, 80%, 60%)"
          strokeWidth="0.3"
          opacity="0.08"
          clipPath="url(#bodyClip)"
        >
          <animate attributeName="y1" values="5;440;5" dur="10s" repeatCount="indefinite" />
          <animate attributeName="y2" values="5;440;5" dur="10s" repeatCount="indefinite" />
        </line>
      </svg>
    </div>
  );
};

export default GeometricBody;
