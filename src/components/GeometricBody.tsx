import { useState } from 'react';
import { BodyZone, BODY_ZONES } from '@/data/bodyZoneMapping';

interface GeometricBodyProps {
  zoneIntensities: Record<BodyZone, number>;
  onZoneTap?: (zone: BodyZone) => void;
  className?: string;
}

// Anatomically recognizable wireframe SVG paths for each zone
const ZONE_ORGANS: Record<BodyZone, { paths: string[]; center: { x: number; y: number }; viewLabel: string }> = {
  brain: {
    paths: [
      // Brain outline - cerebral shape
      'M160,35 C160,18 170,8 180,8 C190,8 200,18 200,35 C200,48 195,55 190,58 L170,58 C165,55 160,48 160,35 Z',
      // Brain fold lines
      'M168,20 C172,15 178,14 182,18', 'M172,28 C178,24 185,25 190,30',
      'M165,38 C170,34 180,33 188,38', 'M168,46 C175,42 185,43 192,48',
      // Brain stem
      'M175,58 L175,68', 'M185,58 L185,68',
      // Wireframe cross-hatching
      'M163,25 L197,25', 'M162,35 L198,35', 'M164,45 L196,45',
      'M170,12 L170,55', 'M180,8 L180,58', 'M190,12 L190,55',
    ],
    center: { x: 180, y: 35 },
    viewLabel: 'Cognitive',
  },
  heart: {
    paths: [
      // Heart organ shape
      'M165,100 C158,92 148,92 148,102 C148,115 165,128 180,138 C195,128 212,115 212,102 C212,92 202,92 195,100 C190,105 185,106 180,104 C175,106 170,105 165,100 Z',
      // Aorta
      'M175,100 C172,90 168,82 165,78', 'M185,100 C188,90 192,82 195,78',
      // Ventricle lines
      'M180,104 L180,130', 'M168,108 L192,108', 'M170,118 L190,118',
      // Wire mesh
      'M155,100 L205,100', 'M158,110 L202,110', 'M162,120 L198,120',
      'M165,95 L165,130', 'M175,92 L175,135', 'M185,92 L185,135', 'M195,95 L195,130',
    ],
    center: { x: 180, y: 110 },
    viewLabel: 'Cardiovascular',
  },
  arms: {
    paths: [
      // Left arm - bicep/muscle shape
      'M120,95 C114,95 108,100 108,110 L108,145 C108,150 112,155 118,155 L130,155 C136,155 140,150 140,145 L140,110 C140,100 134,95 128,95 Z',
      // Right arm
      'M220,95 C226,95 232,100 232,110 L232,145 C232,150 228,155 222,155 L210,155 C204,155 200,150 200,145 L200,110 C200,100 206,95 212,95 Z',
      // Muscle fiber lines left
      'M114,105 L134,105', 'M112,115 L136,115', 'M112,125 L136,125', 'M114,135 L134,135', 'M114,145 L134,145',
      'M120,98 L120,152', 'M128,98 L128,152',
      // Muscle fiber lines right
      'M206,105 L226,105', 'M204,115 L228,115', 'M204,125 L228,125', 'M206,135 L226,135', 'M206,145 L226,145',
      'M212,98 L212,152', 'M220,98 L220,152',
    ],
    center: { x: 124, y: 125 },
    viewLabel: 'Musculoskeletal',
  },
  core: {
    paths: [
      // Torso/abs outline
      'M152,165 L208,165 L210,200 C210,210 205,215 200,215 L160,215 C155,215 150,210 150,200 Z',
      // Ab lines (6-pack grid)
      'M180,165 L180,215', 'M166,165 L164,215', 'M194,165 L196,215',
      'M155,175 L205,175', 'M153,188 L207,188', 'M154,200 L206,200',
      // Oblique lines
      'M152,168 L160,180', 'M208,168 L200,180',
      'M150,195 L158,208', 'M210,195 L202,208',
    ],
    center: { x: 180, y: 190 },
    viewLabel: 'Metabolic',
  },
  hormonal: {
    paths: [
      // Gland/pelvis region
      'M158,220 L202,220 C206,220 210,226 210,232 L210,248 C210,254 206,258 200,258 L160,258 C154,258 150,254 150,248 L150,232 C150,226 154,220 158,220 Z',
      // Internal gland structures
      'M170,228 C170,224 175,222 180,222 C185,222 190,224 190,228 C190,232 185,234 180,234 C175,234 170,232 170,228 Z',
      // Wireframe
      'M155,230 L205,230', 'M154,240 L206,240', 'M155,250 L205,250',
      'M165,222 L163,256', 'M180,220 L180,258', 'M195,222 L197,256',
      // Hormone pulse lines
      'M160,236 C165,233 170,237 175,234 C180,231 185,235 190,232 C195,229 200,233 205,230',
    ],
    center: { x: 180, y: 239 },
    viewLabel: 'Hormonal',
  },
  legs: {
    paths: [
      // Left leg
      'M155,262 L173,262 L174,330 C174,340 172,360 168,380 C166,388 160,390 156,386 L154,380 C152,372 152,350 154,330 Z',
      // Right leg
      'M187,262 L205,262 L206,330 C206,340 208,360 204,380 C202,388 196,390 192,386 L190,380 C188,372 188,350 186,330 Z',
      // Muscle fiber lines left
      'M158,275 L170,275', 'M157,290 L171,290', 'M156,305 L172,305', 'M155,320 L173,320',
      'M156,340 L170,340', 'M158,360 L168,360',
      'M163,264 L162,385',
      // Right
      'M190,275 L202,275', 'M189,290 L203,290', 'M188,305 L204,305', 'M187,320 L205,320',
      'M188,340 L202,340', 'M190,360 L200,360',
      'M197,264 L198,385',
    ],
    center: { x: 180, y: 320 },
    viewLabel: 'Recovery',
  },
  immune: {
    paths: [
      // Thymus / lymph node cluster - abstract immune cells
      'M170,72 C166,70 162,72 162,76 C162,80 166,82 170,80 C174,78 174,74 170,72 Z',
      'M190,72 C194,70 198,72 198,76 C198,80 194,82 190,80 C186,78 186,74 190,72 Z',
      // Spleen area
      'M145,155 C141,152 138,155 138,160 C138,165 141,168 145,165 C149,162 149,158 145,155 Z',
      'M215,155 C219,152 222,155 222,160 C222,165 219,168 215,165 C211,162 211,158 215,155 Z',
      // Connection lines (lymphatic network)
      'M170,76 L165,90', 'M190,76 L195,90',
      'M145,160 L150,165', 'M215,160 L210,165',
      // Scattered immune markers
      'M148,200 L152,196 L156,200 L152,204 Z',
      'M204,200 L208,196 L212,200 L208,204 Z',
      // Lymph network connections
      'M170,80 C168,85 165,88 163,92', 'M190,80 C192,85 195,88 197,92',
      'M152,200 L155,210', 'M208,200 L205,210',
    ],
    center: { x: 180, y: 76 },
    viewLabel: 'Immune',
  },
};

// Body silhouette outline for context
const BODY_SILHOUETTE = [
  // Head outline
  'M170,8 C162,8 156,18 156,32 C156,48 162,56 168,60 L168,68 L192,68 L192,60 C198,56 204,48 204,32 C204,18 198,8 190,8 Z',
  // Neck
  'M172,68 L172,82 L188,82 L188,68',
  // Shoulders & torso
  'M172,82 L140,90 L108,95 L106,155 L140,160 L148,165 L148,260 L155,262',
  'M188,82 L220,90 L232,95 L234,155 L220,160 L212,165 L212,260 L205,262',
  // Legs
  'M155,262 L152,385 L170,388',
  'M205,262 L208,385 L190,388',
];

// Animated pulse dots along the silhouette
const PULSE_DOTS = [
  { cx: 180, cy: 8, delay: 0 },
  { cx: 140, cy: 90, delay: 0.5 },
  { cx: 232, cy: 90, delay: 1 },
  { cx: 180, cy: 165, delay: 1.5 },
  { cx: 163, cy: 320, delay: 2 },
  { cx: 197, cy: 320, delay: 2.5 },
];

const GeometricBody = ({ zoneIntensities, onZoneTap, className = '' }: GeometricBodyProps) => {
  const [hoveredZone, setHoveredZone] = useState<BodyZone | null>(null);

  return (
    <div className={`w-full h-full flex items-center justify-center ${className}`}>
      <svg
        viewBox="90 -5 180 410"
        className="w-full h-full max-h-[440px]"
        style={{ filter: 'drop-shadow(0 0 15px hsla(190, 100%, 50%, 0.1))' }}
      >
        <defs>
          {Object.entries(BODY_ZONES).map(([zone, info]) => (
            <filter key={zone} id={`organ-glow-${zone}`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feFlood floodColor={info.color} floodOpacity="0.7" result="color" />
              <feComposite in2="blur" operator="in" result="shadow" />
              <feMerge>
                <feMergeNode in="shadow" />
                <feMergeNode in="shadow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
          <radialGradient id="bodyGlow" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="hsl(190, 100%, 50%)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient glow */}
        <ellipse cx="180" cy="200" rx="100" ry="200" fill="url(#bodyGlow)" />

        {/* Body silhouette - dim wireframe outline */}
        <g fill="none" stroke="hsl(190, 60%, 35%)" strokeWidth="0.6" opacity="0.2">
          {BODY_SILHOUETTE.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>

        {/* Organ zones */}
        {Object.entries(ZONE_ORGANS).map(([zoneKey, organ]) => {
          const zone = zoneKey as BodyZone;
          const intensity = zoneIntensities[zone];
          const info = BODY_ZONES[zone];
          const isHovered = hoveredZone === zone;
          const isActive = intensity > 0.1;

          // Dim when inactive, bright when active, brightest on hover
          const baseStrokeOpacity = isActive ? 0.25 + intensity * 0.55 : 0.08;
          const baseFillOpacity = isActive ? 0.05 + intensity * 0.15 : 0.02;
          const strokeWidth = isHovered ? 1.4 : isActive ? 0.8 + intensity * 0.4 : 0.4;
          const useGlow = isHovered || intensity > 0.5;

          return (
            <g
              key={zone}
              style={{ cursor: 'pointer', transition: 'opacity 0.3s ease' }}
              onClick={() => onZoneTap?.(zone)}
              onPointerEnter={() => setHoveredZone(zone)}
              onPointerLeave={() => setHoveredZone(null)}
            >
              {organ.paths.map((d, i) => {
                const isOutline = i === 0 || (zone === 'arms' && i <= 1);
                return (
                  <path
                    key={i}
                    d={d}
                    fill={isOutline ? info.color : 'none'}
                    fillOpacity={isHovered ? Math.max(baseFillOpacity + 0.12, 0.2) : baseFillOpacity}
                    stroke={info.color}
                    strokeWidth={isOutline ? strokeWidth : strokeWidth * 0.6}
                    strokeOpacity={isHovered ? 0.95 : baseStrokeOpacity}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{
                      transition: 'all 0.3s ease',
                      filter: useGlow && isOutline ? `url(#organ-glow-${zone})` : 'none',
                    }}
                  />
                );
              })}

              {/* Intensity pulse for active zones */}
              {isActive && (
                <circle
                  cx={organ.center.x}
                  cy={organ.center.y}
                  r="3"
                  fill={info.color}
                  opacity="0"
                >
                  <animate
                    attributeName="r"
                    values="2;8;2"
                    dur={`${2.5 - intensity}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values={`${intensity * 0.4};0;${intensity * 0.4}`}
                    dur={`${2.5 - intensity}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          );
        })}

        {/* Hover tooltip */}
        {hoveredZone && (() => {
          const organ = ZONE_ORGANS[hoveredZone];
          const info = BODY_ZONES[hoveredZone];
          const intensity = zoneIntensities[hoveredZone];
          const tooltipY = Math.max(organ.center.y - 18, 5);
          const tooltipX = organ.center.x > 180 ? organ.center.x - 50 : organ.center.x + 10;

          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={tooltipX - 4}
                y={tooltipY - 8}
                width="76"
                height="18"
                rx="3"
                fill="hsl(220, 30%, 10%)"
                fillOpacity="0.92"
                stroke={info.color}
                strokeWidth="0.5"
                strokeOpacity="0.6"
              />
              <text
                x={tooltipX + 34}
                y={tooltipY + 5}
                textAnchor="middle"
                fill={info.color}
                fontSize="7.5"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="600"
              >
                {info.label} {Math.round(intensity * 100)}%
              </text>
            </g>
          );
        })()}

        {/* Ambient pulse dots */}
        {PULSE_DOTS.map((dot, i) => (
          <circle key={i} cx={dot.cx} cy={dot.cy} r="1.2" fill="hsl(190, 100%, 60%)" opacity="0">
            <animate attributeName="opacity" values="0;0.4;0" dur="4s" begin={`${dot.delay}s`} repeatCount="indefinite" />
          </circle>
        ))}

        {/* Scanning line */}
        <line x1="110" y1="0" x2="250" y2="0" stroke="hsl(190, 100%, 60%)" strokeWidth="0.4" opacity="0.1">
          <animate attributeName="y1" values="-5;400;-5" dur="8s" repeatCount="indefinite" />
          <animate attributeName="y2" values="-5;400;-5" dur="8s" repeatCount="indefinite" />
        </line>
      </svg>
    </div>
  );
};

export default GeometricBody;
