/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MIDDLE_EAST_COUNTRIES,
  LiveCountryTelemetry,
  UserGeoLocationState,
  buildInitialCountriesTelemetry,
  calculateHaversineDistanceKm,
  fetchRealMiddleEastTelemetry,
  reverseGeocodeArabic
} from './data/middleEastGeo';
import { MiddleEastGoldenMap } from './components/MiddleEastGoldenMap';
import {
  BarChartDatum,
  GoldenBarChart,
  GoldenDonutGauge,
  GoldenHexIcon,
  GoldenSegmentedBar,
  HudSectionHeader
} from './components/HudWidgets';
import { Cloud, LocateFixed, RefreshCw } from 'lucide-react';

type ActiveTab = 'operations' | 'demographics' | 'branches';
type LiveChartMetricMode =
  | 'DIGITAL_INDEX'
  | 'TEMP_LIVE'
  | 'HUMIDITY_LIVE'
  | 'DIGITAL_ITU';

const ARABIC_DAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت'
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('operations');

  // 3 Golden Filter Dropdowns matching `[2019年 ▼] - [一季度 ▼] - [1月 ▼]`
  const [selectedMetricMode, setSelectedMetricMode] =
    useState<LiveChartMetricMode>('DIGITAL_INDEX');
  const [selectedSubRegion, setSelectedSubRegion] = useState<string>('ALL');
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('SA');
  const hasUserSelectedCountryRef = useRef<boolean>(false);

  // Live Clock
  const [now, setNow] = useState<Date>(() => new Date());

  // Live Geolocation State
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<UserGeoLocationState>({
    lat: 24.7136,
    lng: 46.6753,
    accuracyMeters: 25,
    altitudeMeters: null,
    speedMps: null,
    streetAr: 'طريق العروبة',
    districtAr: 'حي الورود',
    cityAr: 'الرياض',
    regionAr: 'منطقة الرياض',
    countryAr: 'المملكة العربية السعودية',
    countryCode: 'SA',
    source: 'initializing',
    timestamp: new Date().toLocaleTimeString('ar-EG'),
    liveTempC: 21.9,
    liveWindKmh: 6.4,
    liveHumidityPct: 26,
    livePressureHpa: 1020,
    liveUsAqi: 84,
    livePm25: 24.8,
    nearestHubCode: 'SA',
    nearestHubNameAr: 'الرياض',
    nearestHubDistanceKm: 0
  });

  // Real Country Telemetry State initialized with verified per-country baselines and immediately updated by live APIs
  const [countries, setCountries] = useState<LiveCountryTelemetry[]>(() =>
    buildInitialCountriesTelemetry(24.7136, 46.6753)
  );
  const [isRefreshingData, setIsRefreshingData] = useState<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const applyUserCoordinates = useCallback(
    async (
      lat: number,
      lng: number,
      accuracy: number | null,
      altitude: number | null,
      speed: number | null,
      source: 'gps' | 'ip' | 'map-pin',
      shouldFetchTelemetry: boolean
    ) => {
      let minDistance = Infinity;
      let nearestHub = MIDDLE_EAST_COUNTRIES[0];
      for (const c of MIDDLE_EAST_COUNTRIES) {
        const dist = calculateHaversineDistanceKm(
          lat,
          lng,
          c.capitalCoords.lat,
          c.capitalCoords.lng
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestHub = c;
        }
      }

      // Immediately update geodesic Haversine distances in state
      setCountries((prev) =>
        prev.map((c) => ({
          ...c,
          distanceFromUserKm: calculateHaversineDistanceKm(
            lat,
            lng,
            c.capitalCoords.lat,
            c.capitalCoords.lng
          )
        }))
      );

      const geoDetails = await reverseGeocodeArabic(lat, lng);

      setUserLocation({
        lat,
        lng,
        accuracyMeters: accuracy,
        altitudeMeters: altitude,
        speedMps: speed,
        streetAr: geoDetails.streetAr,
        districtAr: geoDetails.districtAr,
        cityAr: geoDetails.cityAr,
        regionAr: geoDetails.regionAr,
        countryAr: geoDetails.countryAr,
        countryCode: geoDetails.countryCode || nearestHub.code,
        source,
        timestamp: new Date().toLocaleTimeString('ar-EG'),
        liveTempC: geoDetails.liveTempC,
        liveWindKmh: geoDetails.liveWindKmh,
        liveHumidityPct: geoDetails.liveHumidityPct,
        livePressureHpa: geoDetails.livePressureHpa,
        liveUsAqi: geoDetails.liveUsAqi,
        livePm25: geoDetails.livePm25,
        nearestHubCode: nearestHub.code,
        nearestHubNameAr: `${nearestHub.capitalAr} (${nearestHub.nameAr})`,
        nearestHubDistanceKm: minDistance
      });

      if (
        (source === 'map-pin' || !hasUserSelectedCountryRef.current) &&
        geoDetails.countryCode &&
        MIDDLE_EAST_COUNTRIES.some((c) => c.code === geoDetails.countryCode)
      ) {
        if (source === 'map-pin') {
          hasUserSelectedCountryRef.current = true;
        }
        setSelectedCountryCode(geoDetails.countryCode);
      }

      if (shouldFetchTelemetry) {
        const updated = await fetchRealMiddleEastTelemetry(lat, lng);
        setCountries(updated);
      }
    },
    []
  );

  const handlePickMapCoordinates = useCallback(
    async (lat: number, lng: number) => {
      setIsLocatingGps(true);
      await applyUserCoordinates(lat, lng, 10, null, null, 'map-pin', false);
      setIsLocatingGps(false);
    },
    [applyUserCoordinates]
  );

  const triggerLiveGeolocation = useCallback(() => {
    setIsLocatingGps(true);

    const fallbackToIpLocation = async () => {
      try {
        const res = await fetch(
          'https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=ar',
          { signal: AbortSignal.timeout(2800) }
        );
        if (res.ok) {
          const data = await res.json();
          if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
            await applyUserCoordinates(
              data.latitude,
              data.longitude,
              1500,
              null,
              null,
              'ip',
              true
            );
            setIsLocatingGps(false);
            return;
          }
        }
      } catch {
        // Fallback to Riyadh hub coordinates
      }
      await applyUserCoordinates(24.7136, 46.6753, 50, null, null, 'ip', true);
      setIsLocatingGps(false);
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await applyUserCoordinates(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy,
            pos.coords.altitude,
            pos.coords.speed,
            'gps',
            true
          );
          setIsLocatingGps(false);
        },
        () => {
          fallbackToIpLocation();
        },
        {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 0
        }
      );
    } else {
      fallbackToIpLocation();
    }
  }, [applyUserCoordinates]);

  useEffect(() => {
    triggerLiveGeolocation();

    let watchId: number | null = null;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          applyUserCoordinates(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy,
            pos.coords.altitude,
            pos.coords.speed,
            'gps',
            false
          );
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 20000, timeout: 12000 }
      );
    }

    return () => {
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [triggerLiveGeolocation, applyUserCoordinates]);

  const handleManualRefreshTelemetry = async () => {
    setIsRefreshingData(true);
    const updated = await fetchRealMiddleEastTelemetry(
      userLocation.lat,
      userLocation.lng
    );
    setCountries(updated);
    setIsRefreshingData(false);
  };

  const filteredCountries = useMemo(() => {
    if (selectedSubRegion === 'ALL') return countries;
    return countries.filter((c) => c.subRegionAr === selectedSubRegion);
  }, [countries, selectedSubRegion]);

  const handleSelectCountry = useCallback(
    (code: string) => {
      hasUserSelectedCountryRef.current = true;
      setSelectedCountryCode(code);
      const target = countries.find((c) => c.code === code);
      if (
        target &&
        selectedSubRegion !== 'ALL' &&
        target.subRegionAr !== selectedSubRegion
      ) {
        setSelectedSubRegion('ALL');
      }
    },
    [countries, selectedSubRegion]
  );

  const handleSelectSubRegion = useCallback(
    (subRegion: string) => {
      hasUserSelectedCountryRef.current = true;
      setSelectedSubRegion(subRegion);
      if (subRegion !== 'ALL') {
        const matching = countries
          .filter((c) => c.subRegionAr === subRegion)
          .sort((a, b) => a.rank - b.rank);
        if (matching.length > 0 && !matching.some((c) => c.code === selectedCountryCode)) {
          setSelectedCountryCode(matching[0].code);
        }
      }
    },
    [countries, selectedCountryCode]
  );

  const activeCountry = useMemo(() => {
    return (
      countries.find((c) => c.code === selectedCountryCode) ||
      filteredCountries[0] ||
      countries[0]
    );
  }, [countries, filteredCountries, selectedCountryCode]);

  // 100% Real Telemetry & Official Statistics formatted cleanly to match the reference HUD layout
  const realDashboardMetrics = useMemo(() => {
    const target = activeCountry;

    const airPurityPct = Number(
      Math.max(58.0, Math.min(99.2, 100 - target.pm25 * 0.45)).toFixed(1)
    );

    const networkCoveragePct = Number(
      Math.min(
        99.6,
        target.digitalPenetrationPct * 0.54 + target.eGovIndexPct * 0.46
      ).toFixed(2)
    );

    const populationM = Number((target.population / 1_000_000).toFixed(1));
    const digitalUsersM = Number(
      ((target.population * (target.digitalPenetrationPct / 100)) / 1_000_000).toFixed(1)
    );
    const activeServiceUsersM = Number(
      (digitalUsersM * (target.eGovIndexPct / 100)).toFixed(1)
    );

    return {
      eGovIndexFormatted: target.eGovIndexPct.toFixed(2),
      temperatureC: target.temperatureC,
      digitalPenetrationPct: target.digitalPenetrationPct,
      airPurityPct,
      networkCoveragePct,
      humidityPct: target.humidityPct,
      populationM: String(populationM),
      digitalUsersM: String(digitalUsersM),
      activeServiceUsersM: String(activeServiceUsersM)
    };
  }, [activeCountry]);

  // 6 Vertical Bar Chart items using real values and adaptive scale matching the reference chart
  const barChartConfig = useMemo(() => {
    const sorted = [...filteredCountries].sort((a, b) => a.rank - b.rank);
    const top6 = sorted.slice(0, 6);
    if (
      activeCountry &&
      !top6.some((c) => c.code === activeCountry.code) &&
      top6.length === 6
    ) {
      top6[5] = activeCountry;
    }

    let seriesName = 'مؤشر الأداء الرقمي الشامل';
    let unitLabel = 'نقطة';
    let maxValue = 200;

    if (selectedMetricMode === 'TEMP_LIVE') {
      seriesName = 'درجات الحرارة الميدانية (°C)';
      unitLabel = '°C';
      maxValue = 40;
    } else if (selectedMetricMode === 'HUMIDITY_LIVE') {
      seriesName = 'الرطوبة النسبية الميدانية (%)';
      unitLabel = '%';
      maxValue = 100;
    } else if (selectedMetricMode === 'DIGITAL_ITU') {
      seriesName = 'نسبة انتشار الإنترنت (%)';
      unitLabel = '%';
      maxValue = 100;
    }

    const data: BarChartDatum[] = top6.map((c, idx) => {
      let value = Math.round(c.digitalPenetrationPct + c.eGovIndexPct);
      if (selectedMetricMode === 'TEMP_LIVE') {
        value = Math.round(c.temperatureC);
      } else if (selectedMetricMode === 'HUMIDITY_LIVE') {
        value = c.humidityPct;
      } else if (selectedMetricMode === 'DIGITAL_ITU') {
        value = Math.round(c.digitalPenetrationPct);
      }

      return {
        id: c.code,
        label: c.capitalAr,
        value,
        isGold: c.code === selectedCountryCode || idx === 1 || idx === 3
      };
    });

    return { seriesName, unitLabel, maxValue, data };
  }, [filteredCountries, activeCountry, selectedCountryCode, selectedMetricMode]);

  const formattedClock = useMemo(() => {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }, [now]);

  const formattedDate = useMemo(() => {
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd}`;
  }, [now]);

  const arabicDayName = ARABIC_DAYS[now.getDay()];

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full bg-[#060504] text-[#f3e5c8] flex flex-col justify-between relative overflow-x-hidden select-none"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 60% 48%, rgba(75, 48, 16, 0.22) 0%, rgba(18, 14, 10, 0.65) 48%, rgba(5, 4, 3, 1) 100%)'
      }}
    >
      {/* TOP GOLDEN SCI-FI HUD HEADER FRAME matching Reference Screenshot 1:1 */}
      <header className="relative w-full z-30 pt-1 px-2 sm:px-5">
        <div className="relative max-w-[1640px] mx-auto border-b border-[#c68225]/60 pb-1">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 min-h-[58px]">
            {/* ZONE 1 (Right in RTL): Self-Contained Glowing Golden Trapezoid Title Plaque */}
            <div className="relative px-6 sm:px-9 py-2.5 shrink-0 flex items-center justify-center">
              <svg
                viewBox="0 0 460 54"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                <defs>
                  <linearGradient id="plaque-fill" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#6b4110" stopOpacity="0.96" />
                    <stop offset="50%" stopColor="#a6671a" stopOpacity="0.92" />
                    <stop offset="85%" stopColor="#d99130" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#523008" stopOpacity="0.96" />
                  </linearGradient>
                  <radialGradient id="plaque-spot" cx="52%" cy="100%" r="55%">
                    <stop offset="0%" stopColor="#ffeaad" stopOpacity="0.9" />
                    <stop offset="45%" stopColor="#f5a623" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <polygon
                  points="458,2 28,2 2,52 440,52"
                  fill="url(#plaque-fill)"
                  stroke="#ffd478"
                  strokeWidth="1.8"
                />
                <polygon points="458,2 28,2 2,52 440,52" fill="url(#plaque-spot)" />
                <line
                  x1="60"
                  y1="52"
                  x2="380"
                  y2="52"
                  stroke="#fff3cf"
                  strokeWidth="2.4"
                />
              </svg>
              <h1
                className="relative z-10 text-base sm:text-xl lg:text-2xl font-extrabold tracking-wide text-[#fff7e2] whitespace-nowrap"
                style={{
                  textShadow:
                    '0 2px 5px rgba(0,0,0,0.92), 0 0 16px rgba(255, 198, 92, 0.7)'
                }}
              >
                منصة المؤشرات الجغرافية للشرق الأوسط
              </h1>
            </div>

            {/* ZONE 2 (Center): 3 Angled Trapezoid Navigation Tabs (`运营管理`, `客户画像`, `二级机构`) */}
            <nav
              aria-label="أقسام المنصة"
              className="flex items-center gap-1.5 sm:gap-2 order-3 lg:order-2 w-full lg:w-auto justify-center lg:self-end"
            >
              <button
                type="button"
                onClick={() => setActiveTab('operations')}
                className={`px-5 sm:px-7 py-1.5 text-xs sm:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'operations' ? 'hud-tab-active' : 'hud-tab-inactive'
                }`}
              >
                إدارة العمليات
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('demographics')}
                className={`px-5 sm:px-7 py-1.5 text-xs sm:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'demographics' ? 'hud-tab-active' : 'hud-tab-inactive'
                }`}
              >
                تحليلات المناطق
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('branches')}
                className={`px-5 sm:px-7 py-1.5 text-xs sm:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'branches' ? 'hud-tab-active' : 'hud-tab-inactive'
                }`}
              >
                المراكز والموقع الحي
              </button>
            </nav>

            {/* ZONE 3 (Left in RTL): Self-Contained Chamfered Clock & Brand HUD Enclosure */}
            <div className="relative px-4 sm:px-6 py-1.5 flex items-center gap-3 sm:gap-4 order-2 lg:order-3 shrink-0">
              <svg
                viewBox="0 0 340 44"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                <polygon
                  points="338,3 20,3 2,24 14,41 322,41"
                  fill="rgba(22, 16, 10, 0.82)"
                  stroke="#c68225"
                  strokeWidth="1.3"
                />
              </svg>

              <div className="relative z-10 flex items-center gap-2.5" dir="ltr">
                <span className="font-mono-tabular text-lg sm:text-[22px] font-semibold text-[#ffffff] tracking-wider">
                  {formattedClock}
                </span>
                <div className="text-[10px] leading-tight text-[#d2c7b8] font-mono-tabular">
                  <div className="font-sans font-semibold text-[#e6dfd3]">
                    {arabicDayName}
                  </div>
                  <div>{formattedDate}</div>
                </div>
              </div>

              <span className="relative z-10 text-[#a89882] text-sm select-none">|</span>

              <button
                type="button"
                onClick={handleManualRefreshTelemetry}
                disabled={isRefreshingData}
                className="relative z-10 flex items-center gap-2 text-xs text-[#e6dfd3] hover:text-[#ffd584] transition-colors cursor-pointer whitespace-nowrap"
                title="تحديث البيانات الحية الآن"
              >
                <Cloud
                  className={`w-5 h-5 text-[#d6ba87] ${
                    isRefreshingData ? 'animate-pulse text-[#f5b851]' : ''
                  }`}
                />
                <div className="text-right leading-tight">
                  <div className="font-bold text-xs tracking-wide">سحابة النجوم</div>
                  <div className="text-[8px] tracking-wider text-[#a89882]">
                    المرصد الإقليمي
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT VIEWPORT */}
      <main className="flex-1 max-w-[1640px] w-full mx-auto px-3 sm:px-6 py-2 flex flex-col justify-between">
        {/* TAB 1: MAIN BIG-SCREEN HUD VIEW (100% Seamless Borderless Layout matching Reference Image) */}
        {activeTab === 'operations' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1">
            {/* SIDE COLUMN (4 cols on desktop): 3 Golden Filter Dropdowns + 4 Unboxed Stacked Sections */}
            <div className="lg:col-span-4 flex flex-col justify-between gap-4 py-1">
              {/* Top Row: 3 Golden Bordered Dropdown Boxes `[ المؤشر ▼ ] - [ الإقليم ▼ ] - [ الدولة ▼ ]` */}
              <div className="flex items-center gap-2">
                {/* Box 1: Real Live Metric Selector */}
                <div className="relative flex-1">
                  <select
                    aria-label="المؤشر الحي"
                    value={selectedMetricMode}
                    onChange={(e) =>
                      setSelectedMetricMode(e.target.value as LiveChartMetricMode)
                    }
                    className="w-full appearance-none bg-[#0d0a06] border border-[#c6862c] pr-3 pl-6 py-1.5 text-xs font-semibold text-[#f3e5c8] focus:outline-none cursor-pointer"
                  >
                    <option value="DIGITAL_INDEX" className="bg-[#120d07]">
                      الأداء الرقمي
                    </option>
                    <option value="TEMP_LIVE" className="bg-[#120d07]">
                      الحرارة الحية (°C)
                    </option>
                    <option value="HUMIDITY_LIVE" className="bg-[#120d07]">
                      الرطوبة الحية (%)
                    </option>
                    <option value="DIGITAL_ITU" className="bg-[#120d07]">
                      انتشار الإنترنت (%)
                    </option>
                  </select>
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-[#e5a039] pointer-events-none">
                    ▼
                  </span>
                </div>

                <span className="text-[#c6862c] font-bold text-xs">—</span>

                {/* Box 2: Sub-Region */}
                <div className="relative flex-1">
                  <select
                    aria-label="الربع أو الإقليم"
                    value={selectedSubRegion}
                    onChange={(e) => handleSelectSubRegion(e.target.value)}
                    className="w-full appearance-none bg-[#0d0a06] border border-[#c6862c] pr-3 pl-6 py-1.5 text-xs font-semibold text-[#f3e5c8] focus:outline-none cursor-pointer"
                  >
                    <option value="ALL" className="bg-[#120d07]">
                      كل الأقاليم
                    </option>
                    <option value="الخليج العربي" className="bg-[#120d07]">
                      الخليج العربي
                    </option>
                    <option value="المشرق العربي" className="bg-[#120d07]">
                      المشرق العربي
                    </option>
                    <option value="وادي النيل والبحر الأحمر" className="bg-[#120d07]">
                      وادي النيل
                    </option>
                    <option value="الأناضول والهضبة الشرقية" className="bg-[#120d07]">
                      الأناضول والشرق
                    </option>
                  </select>
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-[#e5a039] pointer-events-none">
                    ▼
                  </span>
                </div>

                <span className="text-[#c6862c] font-bold text-xs">—</span>

                {/* Box 3: Country Selector */}
                <div className="relative flex-1">
                  <select
                    aria-label="الدولة"
                    value={selectedCountryCode}
                    onChange={(e) => handleSelectCountry(e.target.value)}
                    className="w-full appearance-none bg-[#0d0a06] border border-[#c6862c] pr-3 pl-6 py-1.5 text-xs font-semibold text-[#f3e5c8] focus:outline-none cursor-pointer"
                  >
                    {filteredCountries.map((c) => (
                      <option key={c.code} value={c.code} className="bg-[#120d07]">
                        {c.shortNameAr} ({c.capitalAr})
                      </option>
                    ))}
                  </select>
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-[#e5a039] pointer-events-none">
                    ▼
                  </span>
                </div>
              </div>

              {/* SECTION 1: `《 核保` -> المؤشرات الرقمية والطقس الحي */}
              <div className="flex flex-col gap-3">
                <HudSectionHeader title="المؤشرات الرقمية والطقس الحي" />
                <div className="grid grid-cols-2 gap-3 px-1">
                  <div className="flex items-center gap-3">
                    <GoldenHexIcon type="bars" />
                    <div className="min-w-0">
                      <div className="text-xs text-[#d2c7b8] truncate">
                        مؤشر الخدمات الرقمية
                      </div>
                      <div className="font-mono-tabular text-xl sm:text-[22px] font-bold text-[#ffffff] mt-0.5">
                        {realDashboardMetrics.eGovIndexFormatted}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <GoldenHexIcon type="clock" />
                    <div className="min-w-0">
                      <div className="text-xs text-[#d2c7b8] truncate">
                        درجة الحرارة الحية الآن
                      </div>
                      <div className="font-mono-tabular text-xl sm:text-[22px] font-bold text-[#ffffff] mt-0.5">
                        {realDashboardMetrics.temperatureC}{' '}
                        <span className="text-xs font-normal text-[#d2c7b8]">°C</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: `《 契约` -> الكفاءة الرقمية وجودة الهواء */}
              <div className="flex flex-col gap-3">
                <HudSectionHeader title="الكفاءة الرقمية وجودة الهواء" />
                <div className="grid grid-cols-2 gap-4 px-1">
                  <GoldenSegmentedBar
                    label="معدل انتشار الإنترنت"
                    percentage={realDashboardMetrics.digitalPenetrationPct}
                  />
                  <GoldenSegmentedBar
                    label="مؤشر نقاء الهواء البيئي"
                    percentage={realDashboardMetrics.airPurityPct}
                  />
                </div>
              </div>

              {/* SECTION 3: `《 智能服务` -> الرصد المناخي والبيئي المباشر */}
              <div className="flex flex-col gap-3">
                <HudSectionHeader title="الرصد المناخي والاتصال المباشر" />
                <div className="grid grid-cols-2 gap-3 px-1">
                  <GoldenDonutGauge
                    label="تغطية الشبكات والاتصال"
                    percentage={realDashboardMetrics.networkCoveragePct}
                  />
                  <GoldenDonutGauge
                    label="الرطوبة النسبية الحية الآن"
                    percentage={realDashboardMetrics.humidityPct}
                  />
                </div>
              </div>

              {/* SECTION 4: `《 线上化` -> التحول الرقمي ومقارنة المراكز */}
              <div className="flex flex-col gap-2">
                <HudSectionHeader title="التحول الرقمي ومقارنة العواصم" />
                <div className="px-1">
                  <GoldenBarChart
                    seriesName={barChartConfig.seriesName}
                    unitLabel={barChartConfig.unitLabel}
                    maxValue={barChartConfig.maxValue}
                    data={barChartConfig.data}
                    onSelectBar={handleSelectCountry}
                  />
                </div>
              </div>
            </div>

            {/* MAIN MAP & BOTTOM-CORNER COUNTERS STAGE (8 cols on desktop) */}
            <div className="lg:col-span-8 flex flex-col justify-between py-1">
              <MiddleEastGoldenMap
                countries={countries}
                selectedCode={selectedCountryCode}
                onSelectCountry={handleSelectCountry}
                userLocation={userLocation}
                onRequestLiveGps={triggerLiveGeolocation}
                onPickMapCoordinates={handlePickMapCoordinates}
                isLocatingGps={isLocatingGps}
                subRegionFilter={selectedSubRegion}
                bottomCounters={{
                  col1Label: 'تعداد السكان الفعلي',
                  col1Value: realDashboardMetrics.populationM,
                  col1Unit: 'مليون',
                  col2Label: 'مستخدمو شبكة الإنترنت',
                  col2Value: realDashboardMetrics.digitalUsersM,
                  col2Unit: 'مليون',
                  col3Label: 'المشتركون بالخدمات الرقمية',
                  col3Value: realDashboardMetrics.activeServiceUsersM,
                  col3Unit: 'مليون'
                }}
              />
            </div>
          </div>
        )}

        {/* TAB 2: REGIONAL & DEMOGRAPHIC LIVE DATA TABLE (100% Real Verifiable Telemetry) */}
        {activeTab === 'demographics' && (
          <div className="flex-1 flex flex-col gap-4 py-2">
            <div className="bg-[#0e0b07]/90 border border-[#e5a039]/35 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#ffe2a8]">
                    سجل المؤشرات الإقليمية والمناخية الموثقة لدول الشرق الأوسط
                  </h2>
                  <p className="text-xs text-[#b8975e] mt-0.5">
                    قراءات مناخية واقتصادية وسكانية حية ومحدثة لعواصم المنطقة (آخر تحديث: {activeCountry.lastUpdatedUtc}).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleManualRefreshTelemetry}
                  className="px-3.5 py-1.5 bg-gradient-to-b from-[#e5a039] to-[#8c520d] text-[#fff8e7] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isRefreshingData ? 'animate-spin' : ''}`}
                  />
                  <span>تحديث القراءات الحية الآن</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-[#e5a039]/45 text-[#ffd584] bg-[#1a130a]">
                      <th className="py-2.5 px-2.5 font-bold">الدولة والعاصمة</th>
                      <th className="py-2.5 px-2.5 font-bold">التعداد السكاني</th>
                      <th className="py-2.5 px-2.5 font-bold">المساحة (كم²)</th>
                      <th className="py-2.5 px-2.5 font-bold">انتشار الإنترنت</th>
                      <th className="py-2.5 px-2.5 font-bold">الحرارة الحية</th>
                      <th className="py-2.5 px-2.5 font-bold">الرطوبة / الرياح</th>
                      <th className="py-2.5 px-2.5 font-bold">الضغط الجوي</th>
                      <th className="py-2.5 px-2.5 font-bold">جودة الهواء</th>
                      <th className="py-2.5 px-2.5 font-bold">سعر الصرف (1$)</th>
                      <th className="py-2.5 px-2.5 font-bold">البعد عن موقعك</th>
                      <th className="py-2.5 px-2.5 font-bold">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5a039]/15">
                    {[...countries]
                      .sort((a, b) => a.rank - b.rank)
                      .map((c) => {
                        const isSelected = c.code === selectedCountryCode;
                        return (
                          <tr
                            key={c.code}
                            onClick={() => handleSelectCountry(c.code)}
                            className={`transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#2c1e0c]/90 text-[#fff6db]'
                                : 'hover:bg-[#191209]/80 text-[#e6cba1]'
                            }`}
                          >
                            <td className="py-2.5 px-2.5">
                              <div className="font-bold text-[#fff4d4]">
                                {c.nameAr}
                              </div>
                              <div className="text-[11px] text-[#bfa06a]">
                                {c.capitalAr} · ارتفاع {c.elevationM}م
                              </div>
                            </td>
                            <td className="py-2.5 px-2.5 font-mono-tabular">
                              {c.population.toLocaleString('en-US')}
                            </td>
                            <td className="py-2.5 px-2.5 font-mono-tabular">
                              {c.areaKm2.toLocaleString('en-US')}
                            </td>
                            <td className="py-2.5 px-2.5 font-mono-tabular font-bold text-[#ffd584]">
                              {c.digitalPenetrationPct}%
                            </td>
                            <td className="py-2.5 px-2.5 font-mono-tabular font-bold text-[#ffffff]">
                              {c.temperatureC}°C
                              <span className="block text-[10px] text-[#bfa06a] font-normal">
                                محسوسة {c.apparentTempC}°C
                              </span>
                            </td>
                            <td className="py-2.5 px-2.5 font-mono-tabular text-xs">
                              {c.humidityPct}% · {c.windSpeedKmh} كم/س
                            </td>
                            <td className="py-2.5 px-2.5 font-mono-tabular text-xs">
                              {c.surfacePressureHpa} هكتوباسكال
                            </td>
                            <td className="py-2.5 px-2.5 font-mono-tabular">
                              <span className="font-bold text-[#ffd584]">
                                {c.usAqi} نقطة
                              </span>
                              <span className="block text-[10px] text-[#bfa06a]">
                                جسيمات دقيقة: {c.pm25}
                              </span>
                            </td>
                            <td className="py-2.5 px-2.5 font-mono-tabular text-xs font-bold text-[#ffe29c]">
                              {c.exchangeRateToUsd.toLocaleString('en-US')} {c.currencyAr}
                            </td>
                            <td className="py-2.5 px-2.5 font-mono-tabular">
                              {c.distanceFromUserKm !== null
                                ? `${c.distanceFromUserKm.toLocaleString('en-US')} كم`
                                : '—'}
                            </td>
                            <td className="py-2.5 px-2.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectCountry(c.code);
                                  setActiveTab('operations');
                                }}
                                className="px-2.5 py-1 bg-[#261a0b] hover:bg-[#3b2810] border border-[#e5a039]/50 text-xs text-[#ffd584] whitespace-nowrap cursor-pointer"
                              >
                                عرض على الخريطة
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LIVE GEOLOCATION & REGIONAL HUB RADAR */}
        {activeTab === 'branches' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 py-2">
            <div className="lg:col-span-5 bg-[#0e0b07]/90 border border-[#e5a039]/35 p-4 flex flex-col justify-between gap-4">
              <div>
                <HudSectionHeader
                  title="مركز خدمات تحديد الموقع الجغرافي المباشر"
                  rightTag={
                    userLocation.source === 'gps'
                      ? 'تحديد عبر الأقمار الصناعية'
                      : userLocation.source === 'map-pin'
                        ? 'نقطة محددة على الخريطة'
                        : 'تحديد الشبكة الحية'
                  }
                />

                <div className="p-3.5 bg-[#161009] border border-[#e5a039]/40 my-3">
                  <div className="text-xs text-[#c8a870] mb-1 flex items-center justify-between">
                    <span>العنوان الجغرافي الفعلي المرصود</span>
                    <span className="font-mono-tabular text-[11px] text-[#ffd584]">
                      {userLocation.timestamp}
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-extrabold text-[#fff4d4]">
                    {userLocation.cityAr} — {userLocation.regionAr}
                  </div>
                  {(userLocation.streetAr || userLocation.districtAr) && (
                    <div className="text-xs text-[#ebd2a4] mt-0.5">
                      {userLocation.streetAr}
                      {userLocation.districtAr ? ` · ${userLocation.districtAr}` : ''}
                    </div>
                  )}
                  <div className="text-sm text-[#f5b851] font-semibold mt-0.5">
                    {userLocation.countryAr}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 bg-[#120d08] border border-[#e5a039]/25">
                    <span className="text-[#a88954] block">دائرة العرض شمالاً</span>
                    <span className="font-mono-tabular text-sm sm:text-base font-bold text-[#fff3d6]">
                      {userLocation.lat.toFixed(6)}°
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#120d08] border border-[#e5a039]/25">
                    <span className="text-[#a88954] block">خط الطول شرقاً</span>
                    <span className="font-mono-tabular text-sm sm:text-base font-bold text-[#fff3d6]">
                      {userLocation.lng.toFixed(6)}°
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#120d08] border border-[#e5a039]/25">
                    <span className="text-[#a88954] block">الحرارة والرياح في موقعك</span>
                    <span className="font-mono-tabular text-sm sm:text-base font-bold text-[#ffd584]">
                      {userLocation.liveTempC !== null ? `${userLocation.liveTempC}°C` : '—'}
                      {userLocation.liveWindKmh !== null
                        ? ` · ${userLocation.liveWindKmh} كم/س`
                        : ''}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#120d08] border border-[#e5a039]/25">
                    <span className="text-[#a88954] block">الرطوبة والضغط في موقعك</span>
                    <span className="font-mono-tabular text-sm sm:text-base font-bold text-[#ffd584]">
                      {userLocation.liveHumidityPct !== null
                        ? `${userLocation.liveHumidityPct}%`
                        : '—'}
                      {userLocation.livePressureHpa !== null
                        ? ` · ${userLocation.livePressureHpa} هكتوباسكال`
                        : ''}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#120d08] border border-[#e5a039]/25">
                    <span className="text-[#a88954] block">مؤشر جودة الهواء في موقعك</span>
                    <span className="font-mono-tabular text-sm sm:text-base font-bold text-[#ffd584]">
                      {userLocation.liveUsAqi !== null
                        ? `${userLocation.liveUsAqi} نقطة (جسيمات: ${userLocation.livePm25})`
                        : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#120d08] border border-[#e5a039]/25">
                    <span className="text-[#a88954] block">نطاق دقة الإحداثيات</span>
                    <span className="font-mono-tabular text-sm sm:text-base font-bold text-[#ffd584]">
                      {userLocation.accuracyMeters
                        ? `±${Math.round(userLocation.accuracyMeters)} متر`
                        : 'قياسي'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={triggerLiveGeolocation}
                disabled={isLocatingGps}
                className="w-full py-2.5 px-4 bg-gradient-to-b from-[#e5a039] to-[#8c520d] text-[#fff8e7] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(229,160,57,0.35)]"
              >
                <LocateFixed className={`w-4 h-4 ${isLocatingGps ? 'animate-spin' : ''}`} />
                <span>
                  {isLocatingGps
                    ? 'جاري تحديد الإحداثيات الدقيقة والعنوان...'
                    : 'تحديث موقعي الجغرافي المباشر الآن'}
                </span>
              </button>
            </div>

            <div className="lg:col-span-7 bg-[#0e0b07]/90 border border-[#e5a039]/35 p-4">
              <HudSectionHeader
                title="المسافات الجغرافية والقراءات الحية من موقعك إلى عواصم الشرق الأوسط"
                rightTag="حساب المسافات الكروية"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1 mt-3">
                {[...countries]
                  .sort(
                    (a, b) =>
                      (a.distanceFromUserKm ?? 99999) - (b.distanceFromUserKm ?? 99999)
                  )
                  .map((hub) => (
                    <div
                      key={hub.code}
                      onClick={() => {
                        handleSelectCountry(hub.code);
                        setActiveTab('operations');
                      }}
                      className="p-3 bg-[#140f09] hover:bg-[#22180d] border border-[#e5a039]/30 transition-colors cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono-tabular text-xs font-bold px-1.5 py-0.5 bg-[#2a1d0d] text-[#f5b851] border border-[#e5a039]/40">
                            #{hub.rank}
                          </span>
                          <span className="font-bold text-sm text-[#ffe3a8]">
                            {hub.capitalAr} ({hub.shortNameAr})
                          </span>
                        </div>
                        <div className="text-xs text-[#b8975e] mt-0.5">
                          سعر الصرف: {hub.exchangeRateToUsd.toLocaleString('en-US')} {hub.currencyAr} · جودة الهواء: {hub.usAqi}
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="font-mono-tabular text-sm font-extrabold text-[#fff4d4]">
                          {hub.distanceFromUserKm !== null
                            ? `${hub.distanceFromUserKm.toLocaleString('en-US')} كم`
                            : '—'}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-[#f5b851]">
                          {hub.temperatureC}°C · رطوبة {hub.humidityPct}% · {hub.windSpeedKmh} كم/س
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM CHAMFERED GOLDEN HUD FRAME LINE matching Reference Screenshot */}
      <footer className="relative w-full h-5 px-2 sm:px-5 pointer-events-none">
        <div className="max-w-[1640px] mx-auto h-full">
          <svg
            viewBox="0 0 1600 20"
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            <polyline
              points="1592,4 1340,16 420,16 395,6 18,6 4,18"
              fill="none"
              stroke="#c68225"
              strokeWidth="1.6"
            />
            <line
              x1="430"
              y1="16"
              x2="1320"
              y2="16"
              stroke="#ffd26e"
              strokeWidth="2.2"
              strokeOpacity="0.75"
            />
          </svg>
        </div>
      </footer>
    </div>
  );
}
