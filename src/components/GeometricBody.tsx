import { useState } from 'react';
import { BodyZone, BODY_ZONES } from '@/data/bodyZoneMapping';

interface GeometricBodyProps {
  zoneIntensities: Record<BodyZone, number>;
  onZoneTap?: (zone: BodyZone) => void;
  className?: string;
}

interface ZoneConfig {
  zone: BodyZone;
  path: string;
  labelPos: { x: number; y: number };
}

// SVG paths for each body zone – simplified wireframe human silhouette
const ZONE_PATHS: ZoneConfig[] = [
  {
    zone: 'brain',
    path: 'M148,28 C148,14 162,4 180,4 C198,4 212,14 212,28 L212,52 C212,62 202,70 190,72 L170,72 C158,70 148,62 148,52 Z',
    labelPos: { x: 180, y: 40 },
  },
  {
    zone: 'heart',
    path: 'M152,90 L208,90 C214,90 218,96 218,102 L218,140 C218,148 214,154 208,154 L152,154 C146,154 142,148 142,140 L142,102 C142,96 146,90 152,90 Z',
    labelPos: { x: 180, y: 122 },
  },
  {
    zone: 'arms',
    path: 'M130,92 L142,92 L142,154 L138,154 L128,200 C126,208 120,212 114,210 L106,206 C102,204 100,198 102,192 L118,142 L118,100 C118,96 122,92 130,92 Z M228,92 L218,92 L218,154 L222,154 L232,200 C234,208 240,212 246,210 L254,206 C258,204 260,198 258,192 L242,142 L242,100 C242,96 238,92 228,92 Z',
    labelPos: { x: 108, y: 150 },
  },
  {
    zone: 'core',
    path: 'M150,156 L210,156 L210,200 C210,206 206,210 200,210 L160,210 C154,210 150,206 150,200 Z',
    labelPos: { x: 180, y: 183 },
  },
  {
    zone: 'hormonal',
    path: 'M154,212 L206,212 L210,240 C210,246 206,250 200,250 L160,250 C154,250 150,246 150,240 Z',
    labelPos: { x: 180, y: 231 },
  },
  {
    zone: 'legs',
    path: 'M152,252 L174,252 L172,330 C172,340 168,370 164,390 C162,398 156,400 152,398 L148,394 C144,390 144,380 146,370 L152,310 Z M208,252 L186,252 L188,330 C188,340 192,370 196,390 C198,398 204,400 208,398 L212,394 C216,390 216,380 214,370 L208,310 Z',
    labelPos: { x: 180, y: 320 },
  },
  {
    zone: 'immune',
    path: 'M194,80 C200,78 208,80 210,86 L212,90 L208,90 L196,88 C192,86 192,82 194,80 Z M166,80 C160,78 152,80 150,86 L148,90 L152,90 L164,88 C168,86 168,82 166,80 Z',
    labelPos: { x: 180, y: 84 },
  },
];

// Wireframe grid lines for the body outline (decorative mesh effect)
const WIREFRAME_LINES = [
  // Horizontal scan lines
  'M140,100 L220,100', 'M138,120 L222,120', 'M140,140 L220,140',
  'M142,160 L218,160', 'M148,180 L212,180', 'M150,200 L210,200',
  'M152,220 L208,220', 'M154,240 L206,240', 'M152,260 L208,260',
  'M150,280 L210,280', 'M148,300 L212,300', 'M146,320 L214,320',
  'M148,340 L212,340', 'M150,360 L210,360', 'M152,380 L208,380',
  // Vertical structural lines
  'M180,4 L180,400', 'M160,72 L154,400', 'M200,72 L206,400',
  'M170,72 L165,250', 'M190,72 L195,250',
  // Neck
  'M170,72 L170,90', 'M190,72 L190,90',
  // Shoulder connections
  'M142,92 L118,100', 'M218,92 L242,100',
];

// Floating particles for ambient effect
const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  cx: 80 + Math.random() * 200,
  cy: 20 + Math.random() * 380,
  r: 1 + Math.random() * 1.5,
  delay: Math.random() * 4,
}));

const GeometricBody = ({ zoneIntensities, onZoneTap, className = '' }: GeometricBodyProps) => {
  const [hoveredZone, setHoveredZone] = useState<BodyZone | null>(null);

  return (
    <div className={`w-full h-full flex items-center justify-center ${className}`}>
      <svg
        viewBox="60 -10 240 430"
        className="w-full h-full max-h-[420px]"
        style={{ filter: 'drop-shadow(0 0 20px hsla(190, 100%, 50%, 0.15))' }}
      >
        <defs>
          {/* Glow filters for each zone */}
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
          {/* Ambient glow */}
          <radialGradient id="bodyAmbient" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="hsl(190, 100%, 50%)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background ambient glow */}
        <ellipse cx="180" cy="200" rx="120" ry="200" fill="url(#bodyAmbient)" />

        {/* Wireframe mesh lines */}
        <g opacity="0.12" stroke="hsl(190, 80%, 60%)" strokeWidth="0.5" fill="none">
          {WIREFRAME_LINES.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>

        {/* Floating particles */}
        {PARTICLES.map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            fill="hsl(190, 100%, 60%)"
            opacity="0.3"
          >
            <animate
              attributeName="opacity"
              values="0.1;0.5;0.1"
              dur={`${3 + p.delay}s`}
              repeatCount="indefinite"
              begin={`${p.delay}s`}
            />
          </circle>
        ))}

        {/* Body zone regions */}
        {ZONE_PATHS.map(({ zone, path }) => {
          const intensity = zoneIntensities[zone];
          const info = BODY_ZONES[zone];
          const isHovered = hoveredZone === zone;
          const isActive = intensity > 0.1;
          const baseOpacity = isActive ? 0.15 + intensity * 0.35 : 0.05;
          const strokeOpacity = isActive ? 0.3 + intensity * 0.5 : 0.1;

          return (
            <g key={zone}>
              {/* Fill area */}
              <path
                d={path}
                fill={info.color}
                fillOpacity={isHovered ? Math.max(baseOpacity + 0.15, 0.4) : baseOpacity}
                stroke={info.color}
                strokeWidth={isHovered ? 1.5 : 0.8}
                strokeOpacity={isHovered ? 0.9 : strokeOpacity}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  filter: isHovered || intensity > 0.5 ? `url(#glow-${zone})` : 'none',
                }}
                onClick={() => onZoneTap?.(zone)}
                onPointerEnter={() => setHoveredZone(zone)}
                onPointerLeave={() => setHoveredZone(null)}
              />
              {/* Wireframe overlay on the zone */}
              <path
                d={path}
                fill="none"
                stroke={info.color}
                strokeWidth="0.3"
                strokeOpacity={isActive ? 0.2 + intensity * 0.2 : 0.05}
                strokeDasharray="3 5"
                style={{ pointerEvents: 'none' }}
              />
            </g>
          );
        })}

        {/* Zone labels on hover */}
        {hoveredZone && (() => {
          const config = ZONE_PATHS.find(z => z.zone === hoveredZone);
          if (!config) return null;
          const info = BODY_ZONES[hoveredZone];
          const intensity = zoneIntensities[hoveredZone];
          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={config.labelPos.x - 36}
                y={config.labelPos.y - 10}
                width="72"
                height="20"
                rx="4"
                fill="hsl(220, 25%, 12%)"
                fillOpacity="0.9"
                stroke={info.color}
                strokeWidth="0.5"
                strokeOpacity="0.5"
              />
              <text
                x={config.labelPos.x}
                y={config.labelPos.y + 3}
                textAnchor="middle"
                fill={info.color}
                fontSize="8"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="500"
              >
                {info.label} {Math.round(intensity * 100)}%
              </text>
            </g>
          );
        })()}

        {/* Scan line animation */}
        <line
          x1="100" y1="0" x2="260" y2="0"
          stroke="hsl(190, 100%, 60%)"
          strokeWidth="0.5"
          opacity="0.15"
        >
          <animate attributeName="y1" values="-10;410;-10" dur="6s" repeatCount="indefinite" />
          <animate attributeName="y2" values="-10;410;-10" dur="6s" repeatCount="indefinite" />
        </line>
      </svg>
    </div>
  );
};

export default GeometricBody;
