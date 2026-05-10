import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import {
  Aperture,
  Compass,
  Grid2X2,
  LocateFixed,
  Pause,
  Play,
  Route,
  Sparkles,
  Tags,
  Telescope,
} from 'lucide-react';
import { createTaumakoLayer, createTaumakoSkyLayer } from './taumakoLayer.js';
import { nightStyle } from './nightStyle.js';
import {
  constellations,
  islandFeatures,
  mapView,
  routeFeature,
  VOYAGE_POSITION,
} from './taumakoData.js';

const REGULAR_FOV = 36.87;
const WIDE_FOV = 62;
const STELLARIUM_MIN_FOV = 22;
const STELLARIUM_MAX_FOV = 88;
const CAMERA_MODE_TRANSITION_MS = 900;
const CAMERA_TRANSITION_SAMPLE_MS = 1000 / 60;
const CAMERA_ENDPOINT_HOLD_MS = 150;
const SKY_DEGREES_PER_MS = 0.00086;
const DEGREES_PER_HOUR = 15;
const DEBUG_CAMERA_TRANSITIONS = false;
const DEFAULT_FOG = {
  color: '#061553',
  highColor: '#071b5f',
  spaceColor: '#01031a',
  horizonBlend: 0.15,
  starIntensity: 0.05,
};
const STELLARIUM_FOG = {
  color: '#020934',
  highColor: '#020934',
  spaceColor: '#020934',
  horizonBlend: 0,
  starIntensity: 0,
};
const STELLARIUM_MAP_CAMERA = {
  center: [VOYAGE_POSITION.lng, VOYAGE_POSITION.lat],
  zoom: 8.8,
  pitch: 85,
  bearing: 180,
  roll: 0,
};

const earthShadeFeature = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-180, -89.5],
            [0, -89.5],
            [0, 89.5],
            [-180, 89.5],
            [-180, -89.5],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, -89.5],
            [180, -89.5],
            [180, 89.5],
            [0, 89.5],
            [0, -89.5],
          ],
        ],
      },
    },
  ],
};

function readCameraHash() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const values = params.get('camera')?.split(',').map(Number);
  if (!values || values.length < 5 || values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  const [lng, lat, zoom, pitch, bearing, roll = 0, fov = REGULAR_FOV] = values;
  return {
    center: [lng, lat],
    zoom,
    pitch,
    bearing,
    roll,
    fov,
  };
}

function formatCameraNumber(value, digits = 4) {
  return Number(value).toFixed(digits).replace(/\.?0+$/, '');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function easeInOut(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function smootherStep(value) {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function visualModeBlend(value) {
  const edge = 0.1;
  return smootherStep((clamp01(value) - edge) / (1 - edge * 2));
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((value) => Math.round(value).toString(16).padStart(2, '0'))
    .join('')}`;
}

function lerpHexColor(from, to, amount) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const t = clamp01(amount);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

function applyFogModeBlend(map, blend) {
  if (!map.setFog) {
    return;
  }

  const t = clamp01(blend);
  map.setFog({
    color: lerpHexColor(DEFAULT_FOG.color, STELLARIUM_FOG.color, t),
    'high-color': lerpHexColor(DEFAULT_FOG.highColor, STELLARIUM_FOG.highColor, t),
    'space-color': lerpHexColor(DEFAULT_FOG.spaceColor, STELLARIUM_FOG.spaceColor, t),
    'horizon-blend': DEFAULT_FOG.horizonBlend + (STELLARIUM_FOG.horizonBlend - DEFAULT_FOG.horizonBlend) * t,
    'star-intensity': DEFAULT_FOG.starIntensity + (STELLARIUM_FOG.starIntensity - DEFAULT_FOG.starIntensity) * t,
  });
}

function normalizeDegrees(value) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

function cameraHashForMap(map) {
  const center = map.getCenter();
  const roll = map.getRoll?.() ?? 0;
  const fov = map.getVerticalFieldOfView?.() ?? REGULAR_FOV;
  return [
    formatCameraNumber(center.lng, 6),
    formatCameraNumber(center.lat, 6),
    formatCameraNumber(map.getZoom(), 3),
    formatCameraNumber(map.getPitch(), 2),
    formatCameraNumber(map.getBearing(), 2),
    formatCameraNumber(roll, 2),
    formatCameraNumber(fov, 2),
  ].join(',');
}

function cameraStateFromMap(map) {
  const center = map.getCenter();
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    pitch: map.getPitch(),
    bearing: map.getBearing(),
    roll: map.getRoll?.() ?? 0,
    fov: map.getVerticalFieldOfView?.() ?? REGULAR_FOV,
  };
}

function transitionCameraLog(map, extra = {}) {
  if (!DEBUG_CAMERA_TRANSITIONS || !map) {
    return;
  }

  const center = map.getCenter();
  const entry = {
    tag: 'tntm-camera-transition',
    time: Number(performance.now().toFixed(2)),
    lng: Number(center.lng.toFixed(6)),
    lat: Number(center.lat.toFixed(6)),
    zoom: Number(map.getZoom().toFixed(5)),
    pitch: Number(map.getPitch().toFixed(5)),
    bearing: Number(map.getBearing().toFixed(5)),
    roll: Number((map.getRoll?.() ?? 0).toFixed(5)),
    mapFov: Number((map.getVerticalFieldOfView?.() ?? REGULAR_FOV).toFixed(5)),
    ...extra,
  };

  window.__tntmCameraTransitionFrames = window.__tntmCameraTransitionFrames ?? [];
  window.__tntmCameraTransitionFrames.push(entry);
  console.log('tntm-camera-transition', JSON.stringify(entry));
}

function writeCameraHash(map) {
  const nextHash = `camera=${cameraHashForMap(map)}`;
  if (window.location.hash.replace(/^#/, '') !== nextHash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${nextHash}`);
  }
}

function graticuleStepForZoom(zoom) {
  if (zoom >= 5) {
    return 1;
  }
  if (zoom >= 3.4) {
    return 5;
  }
  return 10;
}

function makeGraticule(step) {
  const features = [];
  const sampleStep = step === 1 ? 1 : 2;

  for (let lng = -180; lng <= 180; lng += step) {
    const coordinates = [];
    for (let lat = -85; lat <= 85; lat += sampleStep) {
      coordinates.push([lng, lat]);
    }
    features.push({
      type: 'Feature',
      properties: { major: lng % 10 === 0 },
      geometry: { type: 'LineString', coordinates },
    });
  }

  for (let lat = -80; lat <= 80; lat += step) {
    const coordinates = [];
    for (let lng = -180; lng <= 180; lng += sampleStep) {
      coordinates.push([lng, lat]);
    }
    features.push({
      type: 'Feature',
      properties: { major: lat % 10 === 0 },
      geometry: { type: 'LineString', coordinates },
    });
  }

  return { type: 'FeatureCollection', features };
}

function updateGraticule(map) {
  const source = map.getSource('taumako-graticule');
  if (!source) {
    return;
  }

  const step = graticuleStepForZoom(map.getZoom());
  if (map.__taumakoGraticuleStep === step) {
    return;
  }

  map.__taumakoGraticuleStep = step;
  source.setData(makeGraticule(step));
}

function addEarthShadeLayer(map) {
  if (!map.getSource('taumako-earth-shade')) {
    map.addSource('taumako-earth-shade', {
      type: 'geojson',
      data: earthShadeFeature,
    });
  }

  if (!map.getLayer('taumako-earth-shade')) {
    map.addLayer({
      id: 'taumako-earth-shade',
      type: 'fill',
      source: 'taumako-earth-shade',
      paint: {
        'fill-color': '#06194f',
        'fill-opacity': 0.5,
      },
    });
  }
}

function addGraticuleLayers(map, visible) {
  if (!map.getSource('taumako-graticule')) {
    map.addSource('taumako-graticule', {
      type: 'geojson',
      data: makeGraticule(graticuleStepForZoom(map.getZoom())),
    });
    map.__taumakoGraticuleStep = graticuleStepForZoom(map.getZoom());
  }

  if (!map.getLayer('taumako-graticule')) {
    map.addLayer({
      id: 'taumako-graticule',
      type: 'line',
      source: 'taumako-graticule',
      layout: {
        visibility: visible ? 'visible' : 'none',
      },
      paint: {
        'line-color': '#62baff',
        'line-width': ['case', ['get', 'major'], 1.35, 0.72],
        'line-opacity': ['case', ['get', 'major'], 0.42, 0.22],
      },
    });
  }

  updateGraticule(map);
}

function addNavigationLayers(map) {
  if (!map.getSource('taumako-route')) {
    map.addSource('taumako-route', {
      type: 'geojson',
      data: routeFeature,
    });
  } else {
    map.getSource('taumako-route').setData(routeFeature);
  }

  if (!map.getLayer('taumako-route-glow')) {
    map.addLayer({
      id: 'taumako-route-glow',
      type: 'line',
      source: 'taumako-route',
      paint: {
        'line-color': '#d6de57',
        'line-width': 12,
        'line-opacity': 0.08,
      },
    });
  }

  if (!map.getLayer('taumako-route-core')) {
    map.addLayer({
      id: 'taumako-route-core',
      type: 'line',
      source: 'taumako-route',
      paint: {
        'line-color': '#d8e56a',
        'line-width': 3,
        'line-dasharray': [1.5, 1.2],
        'line-opacity': 0.58,
      },
    });
  }

  if (!map.getSource('taumako-islands')) {
    map.addSource('taumako-islands', {
      type: 'geojson',
      data: islandFeatures,
    });
  } else {
    map.getSource('taumako-islands').setData(islandFeatures);
  }

  if (!map.getLayer('taumako-island-glow')) {
    map.addLayer({
      id: 'taumako-island-glow',
      type: 'circle',
      source: 'taumako-islands',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'size'], 0.6, 10, 1.2, 25],
        'circle-color': '#0b4e16',
        'circle-opacity': 0.62,
        'circle-blur': 0.5,
      },
    });
  }

  if (!map.getLayer('taumako-islands')) {
    map.addLayer({
      id: 'taumako-islands',
      type: 'circle',
      source: 'taumako-islands',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'size'], 0.6, 4, 1.2, 11],
        'circle-color': '#12812a',
        'circle-stroke-color': '#053012',
        'circle-stroke-width': 2,
        'circle-opacity': 0.96,
      },
    });
  }

}

function applyMapModeBlend(map, blend) {
  const visualBlend = visualModeBlend(blend);
  const mapOpacity = clamp01(1 - visualBlend);
  applyFogModeBlend(map, visualBlend);
  const opacity = (value) => clamp01(value * mapOpacity);
  const paintUpdates = [
    ['osm-night', 'raster-opacity', opacity(0.5)],
    ['taumako-earth-shade', 'fill-opacity', opacity(0.5)],
    ['taumako-route-glow', 'line-opacity', opacity(0.08)],
    ['taumako-route-core', 'line-opacity', opacity(0.58)],
    ['taumako-island-glow', 'circle-opacity', opacity(0.62)],
    ['taumako-islands', 'circle-opacity', opacity(0.96)],
    ['taumako-islands', 'circle-stroke-opacity', mapOpacity],
    ['taumako-island-labels', 'text-opacity', opacity(0.92)],
  ];

  paintUpdates.forEach(([layerId, property, value]) => {
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, property, value);
    }
  });

  if (map.getLayer('taumako-graticule')) {
    map.setPaintProperty('taumako-graticule', 'line-opacity', [
      'case',
      ['get', 'major'],
      opacity(0.42),
      opacity(0.22),
    ]);
  }
}

function IconToggle({ active, icon: Icon, label, onClick }) {
  return (
    <button
      className={active ? 'tool-button is-active' : 'tool-button'}
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon size={18} strokeWidth={2.2} />
    </button>
  );
}

export default function App() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const visualStateRef = useRef({});
  const initialCameraRef = useRef(null);
  const cameraModeBlendRef = useRef(0);
  const globeCameraBeforeStellariumRef = useRef(null);
  const fovAnimationRef = useRef(null);
  const stellariumFovAnimationRef = useRef(null);
  const delayedCameraAnimationRef = useRef(null);

  if (!initialCameraRef.current) {
    initialCameraRef.current = readCameraHash();
  }

  const [selectedId, setSelectedId] = useState('kaua-kona');
  const [playing, setPlaying] = useState(true);
  const [phase, setPhase] = useState(0);
  const [dayOfYear, setDayOfYear] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showCompass, setShowCompass] = useState(true);
  const [showFieldStars, setShowFieldStars] = useState(true);
  const [wideFov, setWideFov] = useState(() => (initialCameraRef.current?.fov ?? REGULAR_FOV) > 48);
  const [stellariumMode, setStellariumMode] = useState(false);
  const [cameraModeBlend, setCameraModeBlend] = useState(0);
  const [lookYaw, setLookYaw] = useState(0);
  const [lookPitch, setLookPitch] = useState(0);
  const [stellariumFov, setStellariumFov] = useState(() => clamp(
    initialCameraRef.current?.fov ?? REGULAR_FOV,
    STELLARIUM_MIN_FOV,
    STELLARIUM_MAX_FOV,
  ));

  const selected = useMemo(
    () => constellations.find((constellation) => constellation.id === selectedId) ?? constellations[0],
    [selectedId],
  );
  const stellariumVisualActive = stellariumMode || cameraModeBlend > 0.001;

  useEffect(() => {
    const { hitTargets } = visualStateRef.current;
    visualStateRef.current = {
      playing,
      phase,
      dayOfYear,
      showLabels,
      showPaths,
      showGrid,
      showCompass,
      showFieldStars,
      cameraModeBlend: cameraModeBlendRef.current,
      lookYaw,
      lookPitch,
      stellariumFov,
      hitTargets,
    };
    mapRef.current?.triggerRepaint();
  }, [
    playing,
    phase,
    dayOfYear,
    showLabels,
    showPaths,
    showGrid,
    showCompass,
    showFieldStars,
    cameraModeBlend,
    lookYaw,
    lookPitch,
    stellariumFov,
  ]);

  useEffect(() => {
    if (!playing) {
      return undefined;
    }

    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = now - lastTick;
      lastTick = now;
      setPhase((value) => (value + delta * SKY_DEGREES_PER_MS) % 360);
    }, 100);

    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    const map = mapRef.current;
    const from = cameraModeBlendRef.current;
    const to = stellariumMode ? 1 : 0;
    if (from === to) {
      return undefined;
    }

    const startedAt = performance.now();
    let sampleTimer = null;
    let sampleIndex = 0;

    if (DEBUG_CAMERA_TRANSITIONS) {
      window.__tntmCameraTransitionFrames = [];
      window.__tntmSkyTransitionFrames = [];
    }

    const setBlendForRender = (nextBlend) => {
      cameraModeBlendRef.current = nextBlend;
      visualStateRef.current = {
        ...visualStateRef.current,
        cameraModeBlend: nextBlend,
      };
      setCameraModeBlend(nextBlend);
    };

    const tick = () => {
      const now = performance.now();
      const progress = clamp01((now - startedAt) / CAMERA_MODE_TRANSITION_MS);
      const nextBlend = from + (to - from) * easeInOut(progress);
      setBlendForRender(nextBlend);
      if (map) {
        applyMapModeBlend(map, nextBlend);
        transitionCameraLog(map, {
          sample: sampleIndex,
          direction: to > from ? 'enter' : 'exit',
          elapsed: Number((now - startedAt).toFixed(2)),
          progress: Number(progress.toFixed(5)),
          modeBlend: Number(nextBlend.toFixed(6)),
          visualBlend: Number(visualModeBlend(nextBlend).toFixed(6)),
          stellariumFov: Number((visualStateRef.current.stellariumFov ?? REGULAR_FOV).toFixed(5)),
          lookYaw: Number((visualStateRef.current.lookYaw ?? 0).toFixed(5)),
          lookPitch: Number((visualStateRef.current.lookPitch ?? 0).toFixed(5)),
        });
        map.triggerRepaint();
      }
      sampleIndex += 1;

      if (progress < 1) {
        return;
      }

      setBlendForRender(to);
      if (map) {
        applyMapModeBlend(map, to);
        map.triggerRepaint();
      }
      window.clearInterval(sampleTimer);
      sampleTimer = null;
    };

    tick();
    sampleTimer = window.setInterval(tick, CAMERA_TRANSITION_SAMPLE_MS);

    return () => {
      if (sampleTimer !== null) {
        window.clearInterval(sampleTimer);
      }
    };
  }, [stellariumMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (stellariumMode) {
      map.dragPan.disable();
      map.dragRotate.disable();
      map.scrollZoom.disable();
      map.keyboard.disableRotation();
      map.touchZoomRotate.disable();
      return;
    }

    map.dragPan.enable();
    map.dragRotate.enable();
    map.scrollZoom.enable();
    map.keyboard.enableRotation();
    map.touchZoomRotate.enable();
    map.touchZoomRotate.enableRotation();
  }, [stellariumMode]);

  useEffect(() => {
    const element = mapContainerRef.current;
    if (!element) {
      return undefined;
    }

    const dragState = {
      active: false,
      pointerId: null,
      x: 0,
      y: 0,
      startX: 0,
      startY: 0,
      moved: false,
    };

    const triggerRepaint = () => mapRef.current?.triggerRepaint();
    const distanceToSegment = (x, y, x1, y1, x2, y2) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared <= 0.0001) {
        return Math.hypot(x - x1, y - y1);
      }
      const t = clamp(((x - x1) * dx + (y - y1) * dy) / lengthSquared, 0, 1);
      return Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t));
    };
    const selectHitTarget = (clientX, clientY) => {
      const rect = element.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const targets = visualStateRef.current.hitTargets ?? [];
      let best = null;

      targets.forEach((target) => {
        let score = Infinity;
        if (target.width && target.height) {
          const dx = Math.abs(x - target.x);
          const dy = Math.abs(y - target.y);
          if (dx <= target.width * 0.5 && dy <= target.height * 0.5) {
            score = dx / Math.max(target.width, 1) + dy / Math.max(target.height, 1);
          }
        } else if (Number.isFinite(target.x1) && Number.isFinite(target.y1)) {
          const distance = distanceToSegment(x, y, target.x1, target.y1, target.x2, target.y2);
          if (distance <= target.radius) {
            score = distance / Math.max(target.radius, 1);
          }
        } else {
          const distance = Math.hypot(x - target.x, y - target.y);
          if (distance <= target.radius) {
            score = distance / Math.max(target.radius, 1);
          }
        }

        if (score < (best?.score ?? Infinity)) {
          best = { ...target, score };
        }
      });

      if (best?.id) {
        setSelectedId(best.id);
        return true;
      }
      return false;
    };

    const handlePointerDown = (event) => {
      if (event.button !== 0) {
        return;
      }
      dragState.active = true;
      dragState.pointerId = event.pointerId;
      dragState.x = event.clientX;
      dragState.y = event.clientY;
      dragState.startX = event.clientX;
      dragState.startY = event.clientY;
      dragState.moved = false;
      if (stellariumMode) {
        element.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      }
    };

    const handlePointerMove = (event) => {
      if (!dragState.active || event.pointerId !== dragState.pointerId) {
        return;
      }

      const dx = event.clientX - dragState.x;
      const dy = event.clientY - dragState.y;
      dragState.x = event.clientX;
      dragState.y = event.clientY;
      dragState.moved = dragState.moved
        || Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) > 5;

      if (!stellariumMode) {
        return;
      }

      setLookYaw((value) => normalizeDegrees(value - dx * 0.12));
      setLookPitch((value) => clamp(value + dy * 0.12, -24, 88));
      triggerRepaint();
      event.preventDefault();
    };

    const handlePointerUp = (event) => {
      if (event.pointerId !== dragState.pointerId) {
        return;
      }
      dragState.active = false;
      dragState.pointerId = null;
      if (element.hasPointerCapture?.(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
      if (!dragState.moved) {
        const selectedTarget = selectHitTarget(event.clientX, event.clientY);
        if (selectedTarget) {
          if (stellariumMode) {
            event.preventDefault();
            event.stopPropagation();
          }
          return;
        }
      }
      if (stellariumMode) {
        event.preventDefault();
      }
    };

    const handleWheel = (event) => {
      if (!stellariumMode) {
        return;
      }
      event.preventDefault();
      if (stellariumFovAnimationRef.current !== null) {
        window.cancelAnimationFrame(stellariumFovAnimationRef.current);
        stellariumFovAnimationRef.current = null;
      }
      setStellariumFov((value) => {
        const next = clamp(value + event.deltaY * 0.035, STELLARIUM_MIN_FOV, STELLARIUM_MAX_FOV);
        setWideFov(next > 48);
        return next;
      });
      triggerRepaint();
    };

    element.addEventListener('pointerdown', handlePointerDown, true);
    element.addEventListener('pointermove', handlePointerMove, true);
    element.addEventListener('pointerup', handlePointerUp, true);
    element.addEventListener('pointercancel', handlePointerUp, true);
    element.addEventListener('lostpointercapture', handlePointerUp, true);
    element.addEventListener('wheel', handleWheel, { capture: true, passive: false });

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown, true);
      element.removeEventListener('pointermove', handlePointerMove, true);
      element.removeEventListener('pointerup', handlePointerUp, true);
      element.removeEventListener('pointercancel', handlePointerUp, true);
      element.removeEventListener('lostpointercapture', handlePointerUp, true);
      element.removeEventListener('wheel', handleWheel, true);
    };
  }, [stellariumMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('taumako-graticule')) {
      return;
    }

    map.setLayoutProperty('taumako-graticule', 'visibility', showGrid ? 'visible' : 'none');
  }, [showGrid]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return undefined;
    }

    const initialCamera = initialCameraRef.current;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: nightStyle,
      center: initialCamera?.center ?? mapView.center,
      zoom: initialCamera?.zoom ?? mapView.zoom,
      pitch: initialCamera?.pitch ?? mapView.pitch,
      bearing: initialCamera?.bearing ?? mapView.bearing,
      roll: initialCamera?.roll ?? mapView.roll ?? 0,
      maxPitch: 85,
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    });
    mapRef.current = map;
    map.setVerticalFieldOfView(initialCamera?.fov ?? mapView.fov ?? REGULAR_FOV);
    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('style.load', () => {
      map.setProjection({ type: 'globe' });
      applyFogModeBlend(map, cameraModeBlendRef.current);
      if (!map.getLayer('taumako-infinite-sky')) {
        map.addLayer(createTaumakoSkyLayer(visualStateRef), 'osm-night');
      }
      addEarthShadeLayer(map);
      addGraticuleLayers(map, visualStateRef.current.showGrid ?? true);
      addNavigationLayers(map);
      if (!map.getLayer('taumako-stars-and-compass')) {
        map.addLayer(createTaumakoLayer(visualStateRef));
      }
      applyMapModeBlend(map, cameraModeBlendRef.current);
    });

    let hashFrame = null;
    const scheduleCameraHash = () => {
      if (hashFrame !== null) {
        return;
      }
      hashFrame = window.requestAnimationFrame(() => {
        hashFrame = null;
        writeCameraHash(map);
      });
    };
    const handleZoomEnd = () => updateGraticule(map);
    map.on('move', scheduleCameraHash);
    map.on('moveend', scheduleCameraHash);
    map.on('zoomend', handleZoomEnd);
    map.once('idle', () => {
      updateGraticule(map);
      writeCameraHash(map);
    });

    return () => {
      if (hashFrame !== null) {
        window.cancelAnimationFrame(hashFrame);
      }
      if (fovAnimationRef.current !== null) {
        window.cancelAnimationFrame(fovAnimationRef.current);
        fovAnimationRef.current = null;
      }
      if (stellariumFovAnimationRef.current !== null) {
        window.cancelAnimationFrame(stellariumFovAnimationRef.current);
        stellariumFovAnimationRef.current = null;
      }
      if (delayedCameraAnimationRef.current !== null) {
        window.clearTimeout(delayedCameraAnimationRef.current);
        delayedCameraAnimationRef.current = null;
      }
      map.off('move', scheduleCameraHash);
      map.off('moveend', scheduleCameraHash);
      map.off('zoomend', handleZoomEnd);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!stellariumMode && cameraModeBlendRef.current <= 0.001) {
      map.setVerticalFieldOfView(wideFov ? WIDE_FOV : REGULAR_FOV);
    }
    map.triggerRepaint();
  }, [wideFov, stellariumMode]);

  function animateMapFov(map, from, to, duration = CAMERA_MODE_TRANSITION_MS) {
    if (fovAnimationRef.current !== null) {
      window.cancelAnimationFrame(fovAnimationRef.current);
      fovAnimationRef.current = null;
    }
    if (delayedCameraAnimationRef.current !== null) {
      window.clearTimeout(delayedCameraAnimationRef.current);
      delayedCameraAnimationRef.current = null;
    }

    const startedAt = performance.now();
    const tick = (now) => {
      const progress = clamp01((now - startedAt) / duration);
      const eased = easeInOut(progress);
      map.setVerticalFieldOfView(from + (to - from) * eased);
      map.triggerRepaint();

      if (progress < 1) {
        fovAnimationRef.current = window.requestAnimationFrame(tick);
      } else {
        fovAnimationRef.current = null;
        map.setVerticalFieldOfView(to);
        map.triggerRepaint();
      }
    };

    fovAnimationRef.current = window.requestAnimationFrame(tick);
  }

  function animateStellariumFov(from, to, duration = CAMERA_MODE_TRANSITION_MS) {
    if (stellariumFovAnimationRef.current !== null) {
      window.cancelAnimationFrame(stellariumFovAnimationRef.current);
      stellariumFovAnimationRef.current = null;
    }
    if (delayedCameraAnimationRef.current !== null) {
      window.clearTimeout(delayedCameraAnimationRef.current);
      delayedCameraAnimationRef.current = null;
    }

    const startedAt = performance.now();
    const tick = (now) => {
      const progress = clamp01((now - startedAt) / duration);
      const eased = easeInOut(progress);
      setStellariumFov(from + (to - from) * eased);
      mapRef.current?.triggerRepaint();

      if (progress < 1) {
        stellariumFovAnimationRef.current = window.requestAnimationFrame(tick);
      } else {
        stellariumFovAnimationRef.current = null;
        setStellariumFov(to);
        mapRef.current?.triggerRepaint();
      }
    };

    stellariumFovAnimationRef.current = window.requestAnimationFrame(tick);
  }

  function easeMapCamera(map, camera, duration = CAMERA_MODE_TRANSITION_MS) {
    map.stop();
    map.easeTo({
      center: camera.center,
      zoom: camera.zoom,
      pitch: camera.pitch,
      bearing: camera.bearing,
      roll: camera.roll ?? 0,
      duration,
      easing: easeInOut,
      essential: true,
    });
  }

  function resetView() {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (fovAnimationRef.current !== null) {
      window.cancelAnimationFrame(fovAnimationRef.current);
      fovAnimationRef.current = null;
    }
    if (stellariumFovAnimationRef.current !== null) {
      window.cancelAnimationFrame(stellariumFovAnimationRef.current);
      stellariumFovAnimationRef.current = null;
    }
    if (delayedCameraAnimationRef.current !== null) {
      window.clearTimeout(delayedCameraAnimationRef.current);
      delayedCameraAnimationRef.current = null;
    }
    setStellariumMode(false);
    globeCameraBeforeStellariumRef.current = null;
    setLookYaw(0);
    setLookPitch(0);
    setDayOfYear(1);
    setStellariumFov(mapView.fov ?? REGULAR_FOV);
    setWideFov(false);
    map.setVerticalFieldOfView(mapView.fov ?? REGULAR_FOV);
    map.setRoll?.(mapView.roll ?? 0);
    map.flyTo({
      center: mapView.center,
      zoom: mapView.zoom,
      pitch: mapView.pitch,
      bearing: mapView.bearing,
      duration: 900,
    });
  }

  function toggleCameraMode() {
    setStellariumMode((value) => {
      const next = !value;
      const map = mapRef.current;

      if (fovAnimationRef.current !== null) {
        window.cancelAnimationFrame(fovAnimationRef.current);
        fovAnimationRef.current = null;
      }
      if (stellariumFovAnimationRef.current !== null) {
        window.cancelAnimationFrame(stellariumFovAnimationRef.current);
        stellariumFovAnimationRef.current = null;
      }
      if (delayedCameraAnimationRef.current !== null) {
        window.clearTimeout(delayedCameraAnimationRef.current);
        delayedCameraAnimationRef.current = null;
      }

      if (next) {
        const currentCamera = map ? cameraStateFromMap(map) : null;
        const currentFov = currentCamera?.fov ?? (wideFov ? WIDE_FOV : REGULAR_FOV);
        globeCameraBeforeStellariumRef.current = currentCamera;
        setLookYaw(0);
        setLookPitch(0);
        setStellariumFov(clamp(currentFov, STELLARIUM_MIN_FOV, STELLARIUM_MAX_FOV));
        setWideFov(true);
        if (map) {
          easeMapCamera(map, STELLARIUM_MAP_CAMERA, CAMERA_MODE_TRANSITION_MS);
          animateMapFov(map, currentFov, WIDE_FOV, CAMERA_MODE_TRANSITION_MS);
        }
        animateStellariumFov(
          clamp(currentFov, STELLARIUM_MIN_FOV, STELLARIUM_MAX_FOV),
          WIDE_FOV,
          CAMERA_MODE_TRANSITION_MS,
        );
      } else if (map) {
        const restoreCamera = globeCameraBeforeStellariumRef.current ?? {
          center: mapView.center,
          zoom: mapView.zoom,
          pitch: mapView.pitch,
          bearing: mapView.bearing,
          roll: mapView.roll ?? 0,
          fov: mapView.fov ?? REGULAR_FOV,
        };
        const currentFov = map.getVerticalFieldOfView?.() ?? WIDE_FOV;
        easeMapCamera(map, restoreCamera, CAMERA_MODE_TRANSITION_MS);
        animateMapFov(map, currentFov, restoreCamera.fov ?? REGULAR_FOV, CAMERA_MODE_TRANSITION_MS);
        setWideFov((restoreCamera.fov ?? REGULAR_FOV) > 48);
      }
      return next;
    });
  }

  function toggleFov() {
    if (stellariumMode) {
      if (stellariumFovAnimationRef.current !== null) {
        window.cancelAnimationFrame(stellariumFovAnimationRef.current);
        stellariumFovAnimationRef.current = null;
      }
      setStellariumFov((value) => {
        const next = value > 48 ? REGULAR_FOV : WIDE_FOV;
        setWideFov(next > 48);
        return next;
      });
      return;
    }

    setWideFov((value) => !value);
  }

  return (
    <main
      className={stellariumVisualActive ? 'app-shell is-stellarium' : 'app-shell'}
      style={{ '--stellarium-mode-blend': visualModeBlend(cameraModeBlend).toFixed(4) }}
    >
      <div ref={mapContainerRef} className="map-canvas" />

      <section className="title-block" aria-label="Title">
        <p className="overline">Nga Hetu o Lata</p>
        <h1>Taumako Southern Sky</h1>
      </section>

      <aside className="info-panel" aria-live="polite">
        <p className="panel-kicker">Selected star body</p>
        <h2>{selected.name}</h2>
        <p>{selected.association}</p>
        <span>{selected.wind}</span>
      </aside>

      <nav className="tool-dock" aria-label="Viewer controls">
        <IconToggle
          active={playing}
          icon={playing ? Pause : Play}
          label={playing ? 'Pause star motion' : 'Play star motion'}
          onClick={() => setPlaying((value) => !value)}
        />
        <IconToggle
          active={showLabels}
          icon={Tags}
          label="Toggle local labels"
          onClick={() => setShowLabels((value) => !value)}
        />
        <IconToggle
          active={showPaths}
          icon={Route}
          label="Toggle star paths"
          onClick={() => setShowPaths((value) => !value)}
        />
        <IconToggle
          active={showGrid}
          icon={Grid2X2}
          label="Toggle horizon grid"
          onClick={() => setShowGrid((value) => !value)}
        />
        <IconToggle
          active={showCompass}
          icon={Compass}
          label="Toggle wind compass"
          onClick={() => setShowCompass((value) => !value)}
        />
        <IconToggle
          active={showFieldStars}
          icon={Sparkles}
          label="Toggle field stars"
          onClick={() => setShowFieldStars((value) => !value)}
        />
        <IconToggle
          active={stellariumMode}
          icon={Telescope}
          label={stellariumMode ? 'Use globe camera control' : 'Use sky camera control'}
          onClick={toggleCameraMode}
        />
        <IconToggle
          active={stellariumMode ? stellariumFov > 48 : wideFov}
          icon={Aperture}
          label={(stellariumMode ? stellariumFov > 48 : wideFov) ? 'Use regular FOV' : 'Use wide FOV'}
          onClick={toggleFov}
        />
        <button
          className="tool-button reset-camera-button"
          type="button"
          aria-label="Reset camera"
          title="Reset camera"
          onClick={resetView}
        >
          <LocateFixed size={18} strokeWidth={2.2} />
          <span>Reset camera</span>
        </button>
        <label className="phase-control" title="Hour of day">
          <span>Hour of day</span>
          <input
            type="range"
            min="0"
            max="24"
            step="0.1"
            value={(phase / DEGREES_PER_HOUR).toFixed(1)}
            onChange={(event) => {
              setPlaying(false);
              setPhase(Number(event.target.value) * DEGREES_PER_HOUR);
            }}
          />
        </label>
        <label className="phase-control" title="Day of year">
          <span>Day of year</span>
          <input
            type="range"
            min="1"
            max="365"
            step="1"
            value={dayOfYear}
            onChange={(event) => setDayOfYear(Number(event.target.value))}
          />
        </label>
      </nav>
    </main>
  );
}
