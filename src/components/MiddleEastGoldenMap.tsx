import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  LiveCountryTelemetry,
  SURROUNDING_CONTEXT_POLYGONS,
  UserGeoLocationState
} from '../data/middleEastGeo';
import { HudSectionHeader } from './HudWidgets';
import {
  Compass,
  Layers,
  LocateFixed,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

interface MiddleEastGoldenMapProps {
  countries: LiveCountryTelemetry[];
  selectedCode: string;
  onSelectCountry: (code: string) => void;
  userLocation: UserGeoLocationState;
  onRequestLiveGps: () => void;
  onPickMapCoordinates?: (lat: number, lng: number) => void;
  isLocatingGps: boolean;
  subRegionFilter: string;
  bottomCounters: {
    col1Label: string;
    col1Value: string;
    col1Unit?: string;
    col2Label: string;
    col2Value: string;
    col2Unit?: string;
    col3Label: string;
    col3Value: string;
    col3Unit?: string;
  };
}

// Cosine-corrected geographic projection fitting all 15 Middle East countries (24°E..63.3°E, 12.3°N..42.1°N)
const LNG_MIN = 24.0;
const LAT_MAX = 42.6;
const PX_PER_LAT = 17.6;
const PX_PER_LNG = PX_PER_LAT * Math.cos((27 * Math.PI) / 180);
const X_OFFSET = 85.0;
const Y_OFFSET = 18.0;
const SVG_WIDTH = 860;
const SVG_HEIGHT = 600;

function projectPoint(lng: number, lat: number): [number, number] {
  const x = (lng - LNG_MIN) * PX_PER_LNG + X_OFFSET;
  const y = (LAT_MAX - lat) * PX_PER_LAT + Y_OFFSET;
  return [Number(x.toFixed(1)), Number(y.toFixed(1))];
}

function ringsToSvgPath(rings: [number, number][][]): string {
  return rings
    .map(
      (ring) =>
        ring
          .map(([lng, lat], i) => {
            const [x, y] = projectPoint(lng, lat);
            return `${i === 0 ? 'M' : 'L'}${x},${y}`;
          })
          .join(' ') + ' Z'
    )
    .join(' ');
}

export const MiddleEastGoldenMap: React.FC<MiddleEastGoldenMapProps> = ({
  countries,
  selectedCode,
  onSelectCountry,
  userLocation,
  onRequestLiveGps,
  onPickMapCoordinates,
  isLocatingGps,
  subRegionFilter,
  bottomCounters
}) => {
  const uid = useId().replace(/:/g, '');
  const [mapMode, setMapMode] = useState<'hud-svg' | 'leaflet-live'>('hud-svg');
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  // Interactive SVG Pan & Zoom state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0
  });
  const dragMovedRef = useRef<boolean>(false);

  const leafletContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const filteredCountries = useMemo(() => {
    if (subRegionFilter === 'ALL') return countries;
    return countries.filter((c) => c.subRegionAr === subRegionFilter);
  }, [countries, subRegionFilter]);

  const top5Countries = useMemo(() => {
    return [...filteredCountries].sort((a, b) => a.rank - b.rank).slice(0, 5);
  }, [filteredCountries]);

  const activeCountry = useMemo(
    () =>
      countries.find((c) => c.code === hoveredCode) ||
      countries.find((c) => c.code === selectedCode) ||
      countries[0],
    [countries, selectedCode, hoveredCode]
  );

  const selectedCountry = useMemo(
    () => countries.find((c) => c.code === selectedCode) || countries[0],
    [countries, selectedCode]
  );

  const originPoint = useMemo(() => {
    if (selectedCountry) {
      return projectPoint(
        selectedCountry.capitalCoords.lng,
        selectedCountry.capitalCoords.lat
      );
    }
    return projectPoint(46.6753, 24.7136);
  }, [selectedCountry]);

  const currentViewBox = useMemo(() => {
    const w = SVG_WIDTH / zoom;
    const h = SVG_HEIGHT / zoom;
    const cx = SVG_WIDTH / 2 - pan.x;
    const cy = SVG_HEIGHT / 2 - pan.y;
    const vx = cx - w / 2;
    const vy = cy - h / 2;
    return `${vx.toFixed(1)} ${vy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
  }, [zoom, pan]);

  const [leafletZoom, setLeafletZoom] = useState<number>(5);

  const handleZoomIn = () => {
    if (mapMode === 'leaflet-live' && leafletMapRef.current) {
      leafletMapRef.current.zoomIn();
      return;
    }
    setZoom((z) => Math.min(4.2, Number((z * 1.35).toFixed(2))));
  };

  const handleZoomOut = () => {
    if (mapMode === 'leaflet-live' && leafletMapRef.current) {
      leafletMapRef.current.zoomOut();
      return;
    }
    setZoom((z) => {
      const next = Math.max(1, Number((z / 1.35).toFixed(2)));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetView = () => {
    if (mapMode === 'leaflet-live' && leafletMapRef.current && selectedCountry) {
      leafletMapRef.current.flyTo(
        [selectedCountry.capitalCoords.lat, selectedCountry.capitalCoords.lng],
        5,
        { duration: 0.8 }
      );
      return;
    }
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const zoomProgressSteps = useMemo(() => {
    const ratio =
      mapMode === 'hud-svg'
        ? Math.min(1, Math.max(0, (zoom - 1) / 3.2))
        : Math.min(1, Math.max(0, (leafletZoom - 4) / 10));
    const activeCount = Math.max(1, Math.round(ratio * 4) + 1);
    return [5, 4, 3, 2, 1].map((step) => step <= activeCount);
  }, [mapMode, zoom, leafletZoom]);

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(4.2, Number((z * 1.18).toFixed(2))));
    } else {
      setZoom((z) => {
        const next = Math.max(1, Number((z / 1.18).toFixed(2)));
        if (next === 1) setPan({ x: 0, y: 0 });
        return next;
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.hypot(dx, dy) > 5) {
      dragMovedRef.current = true;
    }
    if (zoom > 1) {
      setPan({
        x: Math.max(-300, Math.min(300, dragStartRef.current.panX + dx / zoom)),
        y: Math.max(-240, Math.min(240, dragStartRef.current.panY + dy / zoom))
      });
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handleCountryClick = (code: string) => {
    if (dragMovedRef.current) return;
    onSelectCountry(code);
  };

  // Initialize and sync Leaflet map
  useEffect(() => {
    if (mapMode !== 'leaflet-live' || !leafletContainerRef.current) return;

    if (!leafletMapRef.current) {
      const map = L.map(leafletContainerRef.current, {
        center: [
          selectedCountry?.capitalCoords.lat || 24.7136,
          selectedCountry?.capitalCoords.lng || 46.6753
        ],
        zoom: 5,
        zoomControl: false,
        attributionControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      map.on('zoomend', () => {
        setLeafletZoom(map.getZoom());
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        if (onPickMapCoordinates) {
          onPickMapCoordinates(e.latlng.lat, e.latlng.lng);
        }
      });

      markersLayerRef.current = L.layerGroup().addTo(map);
      leafletMapRef.current = map;
    }

    const map = leafletMapRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    countries.forEach((c) => {
      const isSelected = c.code === selectedCode;
      const latLngRings = c.polygons.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng] as [number, number])
      );

      const poly = L.polygon(latLngRings, {
        color: isSelected ? '#fff2c4' : '#e5a039',
        weight: isSelected ? 2.6 : 1.2,
        fillColor: isSelected ? '#f5b851' : '#7a4b13',
        fillOpacity: isSelected ? 0.42 : 0.18
      });

      poly.on('click', () => onSelectCountry(c.code));
      poly.addTo(layerGroup);

      const isTop5 = c.rank <= 5;
      const badgeHtml = isTop5
        ? `<div style="width:28px;height:32px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#ffebb8 0%,#c7801e 100%);clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);color:#1c1103;font-weight:800;font-size:13px;box-shadow:0 0 14px #f5b851;">${c.rank}</div>`
        : `<div style="padding:1px 6px;background:rgba(18,13,7,0.92);border:1px solid #e5a039;color:#ffe2a8;font-size:10px;font-weight:700;white-space:nowrap;border-radius:2px;">${c.shortNameAr}</div>`;

      const icon = L.divIcon({
        className: 'custom-gold-hex-icon',
        html: badgeHtml,
        iconSize: isTop5 ? [28, 32] : [54, 18],
        iconAnchor: isTop5 ? [14, 16] : [27, 9]
      });
      const marker = L.marker([c.capitalCoords.lat, c.capitalCoords.lng], { icon });
      marker.on('click', () => onSelectCountry(c.code));
      marker.addTo(layerGroup);
    });

    const userIcon = L.divIcon({
      className: 'user-live-gps-pin',
      html: `<div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:0;border-radius:9999px;background:rgba(245,184,81,0.38);border:1.5px solid #ffd584;"></div>
        <div style="width:9px;height:9px;border-radius:9999px;background:#fff4d4;border:2px solid #d97706;box-shadow:0 0 12px #f5b851;"></div>
      </div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(
      layerGroup
    );

    setTimeout(() => {
      map.invalidateSize();
    }, 60);
  }, [
    mapMode,
    countries,
    selectedCode,
    selectedCountry,
    userLocation,
    onSelectCountry,
    onPickMapCoordinates
  ]);

  useEffect(() => {
    if (mapMode === 'leaflet-live' && leafletMapRef.current && selectedCountry) {
      const targetZoom =
        selectedCountry.areaKm2 < 25000
          ? 8
          : selectedCountry.areaKm2 < 120000
            ? 6
            : 5;
      leafletMapRef.current.flyTo(
        [selectedCountry.capitalCoords.lat, selectedCountry.capitalCoords.lng],
        targetZoom,
        { duration: 0.9 }
      );
    }
  }, [selectedCode, mapMode, selectedCountry]);

  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col justify-between select-none">
      {/* Top Row: Section Bar `《 机构排行TOP5` + Quiet Compact Controls */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-2">
        <div className="w-full sm:w-[340px]">
          <HudSectionHeader title="تصنيف المراكز الإقليمية الخمسة" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={onRequestLiveGps}
            disabled={isLocatingGps}
            className="px-2.5 py-1 bg-[#140e07]/85 hover:bg-[#24190c] border border-[#e5a039]/45 text-[#ffd98a] flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            title="تحديد موقعك الجغرافي المباشر"
          >
            <LocateFixed
              className={`w-3 h-3 text-[#f5b851] ${isLocatingGps ? 'animate-spin' : ''}`}
            />
            <span>موقعك: {userLocation.cityAr}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setMapMode((m) => (m === 'hud-svg' ? 'leaflet-live' : 'hud-svg'))
            }
            className="px-2.5 py-1 bg-[#140e07]/85 hover:bg-[#24190c] border border-[#e5a039]/45 text-[#c8a870] hover:text-[#ffe2a8] flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
          >
            {mapMode === 'hud-svg' ? (
              <>
                <Compass className="w-3 h-3 text-[#f5b851]" />
                <span>خريطة الشوارع التفاعلية</span>
              </>
            ) : (
              <>
                <Layers className="w-3 h-3 text-[#f5b851]" />
                <span>الخريطة الذهبية</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Seamless Borderless Map Stage */}
      <div className="relative flex-1 min-h-[390px] sm:min-h-[450px] w-full flex items-center justify-center overflow-hidden">
        {/* Custom Stylized Golden Sci-Fi HUD Zoom Control Overlay on Bottom-Left Corner */}
        <div
          className="absolute bottom-3 left-3 z-30 flex flex-col items-center p-1.5 w-11"
          role="group"
          aria-label="أدوات تكبير وتصغير الخريطة"
        >
          {/* Chamfered Golden Sci-Fi Frame SVG Backdrop */}
          <svg
            viewBox="0 0 44 156"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          >
            <defs>
              <linearGradient
                id={`zoom-hud-bg-${uid}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#1b1309" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#0e0a05" stopOpacity="0.93" />
                <stop offset="100%" stopColor="#23170a" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient
                id={`zoom-hud-stroke-${uid}`}
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#ffe5a3" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#c68225" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#f5b851" stopOpacity="0.95" />
              </linearGradient>
            </defs>
            {/* Outer Chamfered Enclosure */}
            <polygon
              points="8,1 36,1 43,8 43,148 36,155 8,155 1,148 1,8"
              fill={`url(#zoom-hud-bg-${uid})`}
              stroke={`url(#zoom-hud-stroke-${uid})`}
              strokeWidth="1.4"
            />
            {/* Glowing Corner Bracket Accents */}
            <polyline
              points="1,16 1,8 8,1 16,1"
              fill="none"
              stroke="#fff2c6"
              strokeWidth="2"
            />
            <polyline
              points="28,1 36,1 43,8 43,16"
              fill="none"
              stroke="#fff2c6"
              strokeWidth="2"
            />
            <polyline
              points="1,140 1,148 8,155 16,155"
              fill="none"
              stroke="#fff2c6"
              strokeWidth="2"
            />
            <polyline
              points="28,155 36,155 43,148 43,140"
              fill="none"
              stroke="#fff2c6"
              strokeWidth="2"
            />
          </svg>

          {/* Zoom In Button (+) */}
          <button
            type="button"
            onClick={handleZoomIn}
            className="relative z-10 w-8 h-7 flex items-center justify-center bg-gradient-to-b from-[#33220e] to-[#170f06] hover:from-[#573915] hover:to-[#2b1c0b] active:scale-95 border border-[#e5a039]/60 text-[#ffe6a8] hover:text-[#ffffff] shadow-[0_0_8px_rgba(229,160,57,0.25)] transition-all cursor-pointer"
            title="تكبير الخريطة (+)"
            aria-label="تكبير الخريطة"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Live Zoom Scale Readout & Segmented Golden HUD Ladder */}
          <div className="relative z-10 my-1.5 w-8 py-1 flex flex-col items-center gap-1 border-y border-[#e5a039]/30">
            <span className="font-mono-tabular text-[9.5px] font-bold text-[#ffd884] tracking-tighter leading-none">
              {mapMode === 'hud-svg' ? `${zoom.toFixed(1)}x` : `Z${leafletZoom}`}
            </span>
            <div className="flex flex-col gap-[2.5px] w-4 py-0.5">
              {zoomProgressSteps.map((isActive, idx) => (
                <span
                  key={idx}
                  className={`h-[2.5px] w-full transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#ffe7a3] via-[#f5b851] to-[#c68225] shadow-[0_0_5px_rgba(245,184,81,0.75)]'
                      : 'bg-[#2c1e0e]'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Zoom Out Button (-) */}
          <button
            type="button"
            onClick={handleZoomOut}
            className="relative z-10 w-8 h-7 flex items-center justify-center bg-gradient-to-b from-[#33220e] to-[#170f06] hover:from-[#573915] hover:to-[#2b1c0b] active:scale-95 border border-[#e5a039]/60 text-[#ffe6a8] hover:text-[#ffffff] shadow-[0_0_8px_rgba(229,160,57,0.25)] transition-all cursor-pointer"
            title="تصغير الخريطة (-)"
            aria-label="تصغير الخريطة"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Reset / Recenter Map Button */}
          <button
            type="button"
            onClick={handleResetView}
            className={`relative z-10 mt-1.5 w-8 h-6 flex items-center justify-center border transition-all cursor-pointer ${
              zoom > 1 || mapMode === 'leaflet-live'
                ? 'bg-gradient-to-b from-[#c68225]/40 to-[#523209]/60 hover:from-[#e5a039]/60 hover:to-[#7a4b10]/80 border-[#ffd884]/75 text-[#fff4d4] shadow-[0_0_8px_rgba(245,184,81,0.4)]'
                : 'bg-[#150f07]/80 hover:bg-[#261b0e] border-[#e5a039]/35 text-[#bfa06a]'
            }`}
            title="إعادة ضبط تمركز الخريطة"
            aria-label="إعادة ضبط تمركز الخريطة"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {mapMode === 'hud-svg' ? (
          <svg
            viewBox={currentViewBox}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className={`w-full h-full max-h-[550px] ${
              zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            role="img"
            aria-label="خريطة الشرق الأوسط الذهبية"
          >
            <defs>
              <clipPath id={`me-clip-${uid}`}>
                <rect x="-140" y="-100" width={SVG_WIDTH + 280} height={SVG_HEIGHT + 200} />
              </clipPath>

              {/* UNION PERIMETER FIERY GOLDEN GLOW FILTER */}
              <filter
                id={`me-perimeter-glow-${uid}`}
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feMorphology
                  operator="dilate"
                  radius="2.2"
                  in="SourceAlpha"
                  result="dilated"
                />
                <feGaussianBlur stdDeviation="11" in="dilated" result="outerBlur" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0.96
                          0 0 0 0 0.54
                          0 0 0 0 0.06
                          0 0 0 0.96 0"
                  in="outerBlur"
                  result="outerAmber"
                />
                <feGaussianBlur stdDeviation="3.5" in="dilated" result="midBlur" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 1.0
                          0 0 0 0 0.82
                          0 0 0 0 0.34
                          0 0 0 1.0 0"
                  in="midBlur"
                  result="midGold"
                />
                <feMerge>
                  <feMergeNode in="outerAmber" />
                  <feMergeNode in="midGold" />
                </feMerge>
              </filter>

              {/* Fine Horizontal Bronze-Gold Scanlines Fill */}
              <pattern
                id={`me-scanlines-${uid}`}
                width="10"
                height="3.2"
                patternUnits="userSpaceOnUse"
              >
                <rect width="10" height="3.2" fill="#26190a" fillOpacity="1" />
                <line
                  x1="0"
                  y1="1.1"
                  x2="10"
                  y2="1.1"
                  stroke="#a8742c"
                  strokeWidth="1.05"
                  strokeOpacity="0.74"
                />
                <line
                  x1="0"
                  y1="2.5"
                  x2="10"
                  y2="2.5"
                  stroke="#573912"
                  strokeWidth="0.7"
                  strokeOpacity="0.62"
                />
              </pattern>

              {/* Active / Hovered Country Brighter Golden Scanlines */}
              <pattern
                id={`me-scanlines-bright-${uid}`}
                width="10"
                height="3.2"
                patternUnits="userSpaceOnUse"
              >
                <rect width="10" height="3.2" fill="#5e3e14" fillOpacity="1" />
                <line
                  x1="0"
                  y1="1.1"
                  x2="10"
                  y2="1.1"
                  stroke="#ffe299"
                  strokeWidth="1.35"
                  strokeOpacity="0.94"
                />
                <line
                  x1="0"
                  y1="2.5"
                  x2="10"
                  y2="2.5"
                  stroke="#a86b19"
                  strokeWidth="0.85"
                  strokeOpacity="0.8"
                />
              </pattern>

              {/* Soft Radial Vignette Mask for Surrounding Background Continents */}
              <radialGradient id={`bg-vignette-grad-${uid}`} cx="50%" cy="48%" r="54%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                <stop offset="65%" stopColor="#ffffff" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </radialGradient>
              <mask id={`bg-vignette-mask-${uid}`}>
                <rect
                  x="-140"
                  y="-100"
                  width={SVG_WIDTH + 280}
                  height={SVG_HEIGHT + 200}
                  fill={`url(#bg-vignette-grad-${uid})`}
                />
              </mask>

              {/* Warm Center Radial Illumination */}
              <radialGradient id={`me-spotlight-${uid}`} cx="50%" cy="48%" r="45%">
                <stop offset="0%" stopColor="#ffd479" stopOpacity="0.24" />
                <stop offset="55%" stopColor="#c88020" stopOpacity="0.09" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </radialGradient>

              {/* 3D Golden Hexagon Badge Gradient (`1`..`5`) */}
              <linearGradient id={`badge-face-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fff4d4" />
                <stop offset="52%" stopColor="#e8b35f" />
                <stop offset="100%" stopColor="#b57822" />
              </linearGradient>

              {/* Glowing Pedestal Light Reflection */}
              <linearGradient id={`badge-beam-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fff3cf" stopOpacity="0.88" />
                <stop offset="50%" stopColor="#e5a540" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#e5a540" stopOpacity="0" />
              </linearGradient>
            </defs>

            <g clipPath={`url(#me-clip-${uid})`}>
              {/* 1. Smoky Dark Grayscale Terrain Background (Surrounding Continents) */}
              <g
                mask={`url(#bg-vignette-mask-${uid})`}
                opacity="0.76"
                className="pointer-events-none"
              >
                {SURROUNDING_CONTEXT_POLYGONS.map((bg) => (
                  <path
                    key={bg.iso3}
                    d={ringsToSvgPath(bg.polygons)}
                    fill="#161513"
                    stroke="#26231f"
                    strokeWidth="0.75"
                  />
                ))}
              </g>

              {/* 2A. FIERY GOLDEN OUTER PERIMETER HALO around active Middle East Countries */}
              <g filter={`url(#me-perimeter-glow-${uid})`} className="pointer-events-none">
                {filteredCountries.map((country) => (
                  <path
                    key={`halo-${country.code}`}
                    d={ringsToSvgPath(country.polygons)}
                    fill="#d98719"
                    stroke="#f5a623"
                    strokeWidth="2.8"
                    strokeLinejoin="round"
                  />
                ))}
              </g>

              {/* 2B. SHARP BLAZING GOLDEN OUTER SILHOUETTE RIM (interior strokes hidden by Layer 3 opaque fills) */}
              <g className="pointer-events-none">
                {filteredCountries.map((country) => (
                  <path
                    key={`rim-${country.code}`}
                    d={ringsToSvgPath(country.polygons)}
                    fill="#26190a"
                    stroke="#ffe69c"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                ))}
              </g>

              {/* 3. All 15 Interactive Middle East Countries with Scanlines & Crisp 1px Internal Borders */}
              <g>
                {countries.map((country) => {
                  const isSelected = country.code === selectedCode;
                  const isHovered = country.code === hoveredCode;
                  const inSubRegion =
                    subRegionFilter === 'ALL' || country.subRegionAr === subRegionFilter;
                  const pathD = ringsToSvgPath(country.polygons);

                  return (
                    <path
                      key={country.code}
                      d={pathD}
                      fill={
                        isSelected || isHovered
                          ? `url(#me-scanlines-bright-${uid})`
                          : `url(#me-scanlines-${uid})`
                      }
                      fillOpacity={inSubRegion || isSelected || isHovered ? 1 : 0.45}
                      stroke={
                        isSelected
                          ? '#ffffff'
                          : isHovered
                            ? '#ffe8a8'
                            : inSubRegion
                              ? '#d49b46'
                              : '#7a541e'
                      }
                      strokeWidth={isSelected ? '1.9' : isHovered ? '1.4' : '0.95'}
                      strokeLinejoin="round"
                      className="cursor-pointer transition-opacity"
                      onClick={() => handleCountryClick(country.code)}
                      onMouseEnter={() => setHoveredCode(country.code)}
                      onMouseLeave={() => setHoveredCode(null)}
                    />
                  );
                })}
              </g>

              {/* 4. Soft Radial Center Spotlight */}
              <ellipse
                cx={SVG_WIDTH * 0.48}
                cy={SVG_HEIGHT * 0.48}
                rx="250"
                ry="190"
                fill={`url(#me-spotlight-${uid})`}
                className="pointer-events-none"
              />

              {/* 5. Curved Glowing Flight Arcs (`辐射地区飞线`) across the Middle East */}
              <g className="pointer-events-none">
                {top5Countries.map((target) => {
                  const [x1, y1] = originPoint;
                  const [x2, y2] = projectPoint(
                    target.capitalCoords.lng,
                    target.capitalCoords.lat
                  );
                  const dist = Math.hypot(x2 - x1, y2 - y1);
                  if (dist < 14) return null;

                  const midX = (x1 + x2) / 2;
                  const midY = Math.min(y1, y2) - Math.max(36, dist * 0.25);
                  const arcD = `M ${x1},${y1} Q ${midX},${midY} ${x2},${y2}`;

                  return (
                    <g key={`flight-${target.code}`}>
                      <path
                        d={arcD}
                        fill="none"
                        stroke="#ffd984"
                        strokeWidth="2.0"
                        strokeOpacity="0.28"
                      />
                      <path
                        d={arcD}
                        fill="none"
                        stroke="#fff0c4"
                        strokeWidth="1.15"
                        strokeOpacity="0.82"
                      />
                      <path
                        d={arcD}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.65"
                        className="animate-flight-arc"
                      />
                    </g>
                  );
                })}
              </g>

              {/* 6. Clean Unboxed Country Labels + Invisible Click Zones */}
              <g>
                {countries.map((country) => {
                  const isSelected = country.code === selectedCode;
                  const isHovered = country.code === hoveredCode;
                  const isTop5 = top5Countries.some((t) => t.code === country.code);

                  const [cx, cy] = projectPoint(
                    country.capitalCoords.lng,
                    country.capitalCoords.lat
                  );
                  const [lx, ly] = projectPoint(
                    country.labelCoords.lng,
                    country.labelCoords.lat
                  );
                  const dx = country.labelOffset?.dx || 0;
                  const dy = country.labelOffset?.dy || 0;
                  const finalLx = lx + dx;
                  const finalLy =
                    ly + dy + (isTop5 && dx === 0 && dy === 0 ? 17 : 0);

                  return (
                    <g
                      key={`lbl-${country.code}`}
                      className="cursor-pointer"
                      onClick={() => handleCountryClick(country.code)}
                      onMouseEnter={() => setHoveredCode(country.code)}
                      onMouseLeave={() => setHoveredCode(null)}
                    >
                      {(country.code === 'BH' || country.code === 'QA') && (
                        <circle cx={cx} cy={cy} r="7" fill="transparent" />
                      )}

                      {(dx !== 0 || dy !== 0) && (
                        <>
                          <rect
                            x={finalLx - 17}
                            y={finalLy - 10}
                            width="34"
                            height="13"
                            fill="transparent"
                          />
                          <line
                            x1={cx}
                            y1={cy}
                            x2={finalLx}
                            y2={finalLy - 4}
                            stroke={isSelected ? '#ffffff' : '#ffd584'}
                            strokeWidth="0.8"
                            strokeDasharray="2 1.5"
                            opacity="0.75"
                          />
                        </>
                      )}

                      {!isTop5 && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isSelected || isHovered ? 4.0 : 2.4}
                          fill={isSelected ? '#ffffff' : '#ffd584'}
                          stroke="#5c3504"
                          strokeWidth="1"
                        />
                      )}

                      <text
                        x={finalLx}
                        y={finalLy}
                        textAnchor="middle"
                        fill={
                          isSelected
                            ? '#ffffff'
                            : isHovered
                              ? '#ffe8a3'
                              : '#ebd2a4'
                        }
                        fontSize={
                          isSelected
                            ? '11'
                            : country.areaKm2 > 400000
                              ? '10.5'
                              : '9'
                        }
                        fontWeight={isSelected || isHovered ? '800' : '700'}
                        className="select-none"
                        style={{
                          textShadow:
                            '0 1px 4px rgba(0,0,0,0.98), 0 0 8px rgba(0,0,0,0.95)'
                        }}
                      >
                        {country.shortNameAr}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* 7. 3D Isometric Golden Hexagon Pedestals (`1`, `2`, `3`, `4`, `5` - `机构排行标牌`) */}
              <g>
                {top5Countries.map((hub, idx) => {
                  const [cx, cy] = projectPoint(
                    hub.capitalCoords.lng,
                    hub.capitalCoords.lat
                  );
                  const isSelected = hub.code === selectedCode;
                  const displayRank = idx + 1;
                  const hx = cx;
                  const hy = cy - 11;

                  const hexPoints = `${hx},${hy - 15} ${hx + 13},${hy - 7.5} ${hx + 13},${hy + 7.5} ${hx},${hy + 15} ${hx - 13},${hy + 7.5} ${hx - 13},${hy - 7.5}`;
                  const beamPoints = `${hx - 10},${hy + 8.5} ${hx},${hy + 15} ${hx + 10},${hy + 8.5} ${hx + 7.5},${hy + 24} ${hx - 7.5},${hy + 24}`;

                  return (
                    <g
                      key={`badge-${hub.code}`}
                      className="cursor-pointer"
                      onClick={() => handleCountryClick(hub.code)}
                      onMouseEnter={() => setHoveredCode(hub.code)}
                      onMouseLeave={() => setHoveredCode(null)}
                    >
                      <polygon
                        points={beamPoints}
                        fill={`url(#badge-beam-${uid})`}
                        className="pointer-events-none"
                      />
                      <ellipse
                        cx={hx}
                        cy={hy + 20}
                        rx="9.5"
                        ry="3.2"
                        fill="#ffe8a8"
                        fillOpacity="0.48"
                        className="pointer-events-none"
                      />
                      <polygon
                        points={hexPoints}
                        fill={`url(#badge-face-${uid})`}
                        stroke={isSelected ? '#ffffff' : '#fff3d1'}
                        strokeWidth={isSelected ? '2.1' : '1.3'}
                      />
                      <text
                        x={hx}
                        y={hy + 4.5}
                        textAnchor="middle"
                        fill="#2b1903"
                        fontSize="13"
                        fontWeight="800"
                        className="font-mono-tabular select-none"
                      >
                        {displayRank}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* 8. User Live GPS Coordinate Beacon */}
              <g
                transform={`translate(${projectPoint(userLocation.lng, userLocation.lat)[0]}, ${
                  projectPoint(userLocation.lng, userLocation.lat)[1]
                })`}
                className="pointer-events-none"
              >
                <circle
                  r="9"
                  fill="rgba(255, 224, 150, 0.24)"
                  stroke="#ffe5a3"
                  strokeWidth="1.1"
                />
                <circle r="3.2" fill="#ffffff" stroke="#e59a2e" strokeWidth="1.8" />
              </g>
            </g>
          </svg>
        ) : (
          <div
            ref={leafletContainerRef}
            className="w-full h-full min-h-[390px] sm:min-h-[450px] leaflet-golden-tiles z-10"
          />
        )}
      </div>

      {/* Bottom Row of Map Canvas: Clean Floating Legend + `《 线上化-官微` 3-Column Block */}
      <div className="relative z-20 flex flex-col md:flex-row items-start md:items-end justify-between gap-4 pt-1">
        <div className="flex flex-col gap-2 text-xs text-[#d2c7b8] px-2">
          <div className="flex items-center gap-3">
            <span className="w-9 h-[1.5px] bg-gradient-to-r from-[#fff0c4] to-[#c68324] inline-block" />
            <span>خطوط الربط الإشعاعية للموقع الحي</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 flex justify-center">
              <span
                className="w-4 h-5 inline-block"
                style={{
                  background: 'linear-gradient(180deg, #fff1c7 0%, #b87922 100%)',
                  clipPath:
                    'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  boxShadow: '0 3px 8px rgba(245, 184, 81, 0.6)'
                }}
              />
            </div>
            <span>
              شارات تصنيف المراكز الإقليمية — {activeCountry.nameAr} ({activeCountry.temperatureC}°C)
            </span>
          </div>
        </div>

        {/* Bottom-Corner `《 线上化-官微` Block matching `804 w | 804 w | 604 w` */}
        <div className="w-full md:w-[440px] lg:w-[480px]">
          <HudSectionHeader
            title={`المؤشرات الرقمية والسكانية — ${selectedCountry.shortNameAr}`}
          />
          <div className="grid grid-cols-3 items-center text-center pt-3 pb-1">
            <div className="relative px-2">
              <div className="text-xs text-[#d2c7b8] truncate">
                {bottomCounters.col1Label}
              </div>
              <div className="font-mono-tabular text-xl sm:text-2xl font-bold text-[#ffffff] mt-1">
                {bottomCounters.col1Value}{' '}
                <span className="text-sm font-semibold text-[#e6dfd3]">
                  {bottomCounters.col1Unit ?? 'مليون'}
                </span>
              </div>
            </div>

            <div className="relative px-2 border-x border-[#ffffff]/35">
              <div className="text-xs text-[#d2c7b8] truncate">
                {bottomCounters.col2Label}
              </div>
              <div className="font-mono-tabular text-xl sm:text-2xl font-bold text-[#ffffff] mt-1">
                {bottomCounters.col2Value}{' '}
                <span className="text-sm font-semibold text-[#e6dfd3]">
                  {bottomCounters.col2Unit ?? 'مليون'}
                </span>
              </div>
            </div>

            <div className="relative px-2">
              <div className="text-xs text-[#d2c7b8] truncate">
                {bottomCounters.col3Label}
              </div>
              <div className="font-mono-tabular text-xl sm:text-2xl font-bold text-[#ffffff] mt-1">
                {bottomCounters.col3Value}{' '}
                <span className="text-sm font-semibold text-[#e6dfd3]">
                  {bottomCounters.col3Unit ?? 'مليون'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
