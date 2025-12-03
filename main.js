// Vibe Controller main module
// Three.js galaxy + MediaPipe Hands gestures

// ---------- Designer-friendly config ----------
const VC_CONFIG = {
  galaxy: {
    particleCount: 14000,
    radius: 13,
    branches: 5,
    spin: 1.4,
    randomness: 0.45,
    randomnessPower: 2.3,
    insideColor: "#ffffff", // inner bright white
    outsideColor: "#111111", // outer near-black
    particleSize: 0.035,
  },
  background: {
    baseColor: 0x000000,
    fogColor: 0x000000,
    fogNear: 18,
    fogFar: 60,
  },
  interaction: {
    grabThreshold: 0.12, // lower = easier to detect grab (more sensitive)
    palmFacingThreshold: 0.35, // angle threshold in radians
    influenceRadius: 7,
    rotationStrength: 1.05, // slightly stronger for looser feel
    pushPullStrength: 0.06,
    cameraOrbitStrength: 1.1, // a bit faster orbiting
    cameraZoomStrength: 8.5, // a bit more responsive zoom
    zoomSmoothing: 0.22, // a touch snappier zoom response
    trailFade: 0.94, // 0.9–0.98 for more / less trail
  },
};

// ---------- Three.js setup ----------
import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const container = document.getElementById("webgl-container");

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(VC_CONFIG.background.baseColor, 1);
renderer.autoClearColor = true;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(
  VC_CONFIG.background.fogColor,
  VC_CONFIG.background.fogNear,
  VC_CONFIG.background.fogFar
);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, 4, 20);

// Increased ambient light to make planets brighter
const ambient = new THREE.AmbientLight(0xffffff, 0.75);
scene.add(ambient);

// Galaxy group holds all points so we can rotate / offset as one body
const galaxyGroup = new THREE.Group();
scene.add(galaxyGroup);

// Simple solar system at the core (sun + planets)
const solarSystemGroup = new THREE.Group();
scene.add(solarSystemGroup);

// Create realistic orange sun texture - completely rewritten to avoid black spots
function createSunTexture(size = 2048) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  
  // Simple deterministic noise function
  function noise(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return (n - Math.floor(n));
  }
  
  // Smooth interpolation
  function smoothNoise(x, y) {
    const intX = Math.floor(x);
    const intY = Math.floor(y);
    const fracX = x - intX;
    const fracY = y - intY;
    
    const v1 = noise(intX, intY);
    const v2 = noise(intX + 1, intY);
    const v3 = noise(intX, intY + 1);
    const v4 = noise(intX + 1, intY + 1);
    
    const i1 = v1 * (1 - fracX) + v2 * fracX;
    const i2 = v3 * (1 - fracX) + v4 * fracX;
    return i1 * (1 - fracY) + i2 * fracY;
  }
  
  // Fractal noise for texture
  function fractalNoise(x, y, octaves = 4) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    for (let i = 0; i < octaves; i++) {
      value += smoothNoise(x * frequency, y * frequency) * amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return value;
  }
  
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  const centerX = size / 2;
  const centerY = size / 2;
  const maxRadius = size / 2;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const normalizedDist = dist / maxRadius;
      
      // Outside the sun - transparent
      if (normalizedDist > 1) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
        continue;
      }
      
      const nx = x / size;
      const ny = y / size;
      
      // Base orange sun color - ALWAYS bright, NEVER black
      // Absolute minimum values to guarantee no black spots
      const minR = 220; // Very high minimum red
      const minG = 160; // Very high minimum green  
      const minB = 80;  // High minimum blue
      
      // Granulation texture for surface detail
      const gran = fractalNoise(nx * 50, ny * 50, 4);
      const largeScale = fractalNoise(nx * 6, ny * 6, 3);
      
      // Base orange color - always starts bright
      let r = minR + (255 - minR) * (0.8 + gran * 0.2);
      let g = minG + (220 - minG) * (0.7 + gran * 0.3);
      let b = minB + (120 - minB) * (0.6 + gran * 0.4);
      
      // NO SUNSPOTS - removed to prevent any darkening
      // Just surface texture variation
      
      // Bright regions (flares) - only make brighter, never darker
      const flare = Math.max(0, largeScale - 0.75) * 0.15;
      r = Math.min(255, r * (1 + flare));
      g = Math.min(230, g * (1 + flare * 0.7));
      b = Math.min(130, b * (1 + flare * 0.5));
      
      // Very subtle limb darkening - minimal effect
      const limbDarkening = 1 - Math.pow(normalizedDist, 3) * 0.1; // Very subtle
      r = minR + (r - minR) * Math.max(0.9, limbDarkening); // Never go below 90% of min
      g = minG + (g - minG) * Math.max(0.9, limbDarkening);
      b = minB + (b - minB) * Math.max(0.9, limbDarkening);
      
      // Final absolute clamp - GUARANTEED no black spots
      data[i] = Math.max(minR, Math.min(255, r));
      data[i + 1] = Math.max(minG, Math.min(255, g));
      data[i + 2] = Math.max(minB, Math.min(255, b));
      data[i + 3] = 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

const sunGeometry = new THREE.SphereGeometry(1.8, 64, 64);
const sunTexture = createSunTexture(2048);
const sunMaterial = new THREE.MeshBasicMaterial({
  map: sunTexture,
  emissive: 0xff8844, // Orange emissive glow
  emissiveIntensity: 2.0,
});
const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
solarSystemGroup.add(sunMesh);

// Create radial gradient texture for sun glow with perfect feathering
function createRadialGradientTexture(size = 1024, startRadius = 0.0, endRadius = 1.0) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  
  const centerX = size / 2;
  const centerY = size / 2;
  const maxRadius = size / 2;
  
  // Create image data for pixel-perfect control
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const normalizedDist = dist / maxRadius;
      
      // Normalize to 0-1 range within the gradient bounds
      let t = (normalizedDist - startRadius) / (endRadius - startRadius);
      
      // Use a smoother easing function - exponential falloff for perfect feathering
      // This ensures alpha goes smoothly to zero at the edges
      let alpha = 0;
      if (t < 1) {
        // Smooth exponential falloff - starts fading earlier and more gradually
        const fadeStart = 0.5; // Start fading at 50% of radius
        if (t < fadeStart) {
          // Bright center
          alpha = 1 - (t / fadeStart) * 0.3; // Slight fade in center
        } else {
          // Smooth exponential fade to zero at edge
          const fadeT = (t - fadeStart) / (1 - fadeStart);
          alpha = 0.7 * Math.exp(-fadeT * fadeT * 8); // Exponential falloff
        }
      }
      
      // Ensure alpha is clamped and smooth
      alpha = Math.max(0, Math.min(1, alpha));
      
      // Color gradient from bright yellow-white to orange
      const colorT = Math.min(1, normalizedDist * 1.2);
      const r = 255;
      const g = 255 - colorT * 100;
      const b = 200 - colorT * 120;
      
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = alpha * 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}


// Point light at the sun to illuminate planets realistically
const sunLight = new THREE.PointLight(0xffffff, 1.5, 100, 2);
sunLight.position.set(0, 0, 0);
solarSystemGroup.add(sunLight);

// Helper function to create highly realistic planet textures for all 8 planets
function createPlanetTexture(type, size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Simple noise function
  function noise(x, y) {
    return Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1;
  }

  // Smooth noise
  function smoothNoise(x, y) {
    const intX = Math.floor(x);
    const intY = Math.floor(y);
    const fracX = x - intX;
    const fracY = y - intY;

    const v1 = noise(intX, intY);
    const v2 = noise(intX + 1, intY);
    const v3 = noise(intX, intY + 1);
    const v4 = noise(intX + 1, intY + 1);

    const i1 = v1 * (1 - fracX) + v2 * fracX;
    const i2 = v3 * (1 - fracX) + v4 * fracX;
    return i1 * (1 - fracY) + i2 * fracY;
  }

  // Fractal noise
  function fractalNoise(x, y, octaves = 4) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    for (let i = 0; i < octaves; i++) {
      value += smoothNoise(x * frequency, y * frequency) * amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return value;
  }

  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;

      let r, g, b;

      if (type === "mercury") {
        // Mercury: Gray, heavily cratered, no atmosphere
        const n = fractalNoise(nx * 15, ny * 15, 6);
        const craters = fractalNoise(nx * 30, ny * 30, 3);
        const detail = fractalNoise(nx * 40, ny * 40, 2);
        
        // Base gray-brown
        r = 120 + n * 30 + detail * 10;
        g = 110 + n * 25 + detail * 8;
        b = 100 + n * 20 + detail * 6;
        
        // Craters everywhere
        if (craters < 0.25) {
          const craterDepth = (0.25 - craters) / 0.25;
          r *= (1 - craterDepth * 0.5);
          g *= (1 - craterDepth * 0.5);
          b *= (1 - craterDepth * 0.5);
        }
      } else if (type === "venus") {
        // Venus: Yellow-orange with thick cloud cover, volcanic features
        const n = fractalNoise(nx * 8, ny * 8, 5);
        const clouds = fractalNoise(nx * 12, ny * 12, 4);
        const bands = Math.sin(ny * Math.PI * 6) * 0.2 + 0.8;
        const volcanos = fractalNoise(nx * 4, ny * 4, 2);
        
        // Yellow-orange base
        r = 220 + bands * 20 + n * 15;
        g = 180 + bands * 15 + n * 10;
        b = 120 + bands * 10 + n * 5;
        
        // Cloud layers
        if (clouds > 0.5) {
          const cloudAmount = (clouds - 0.5) / 0.5;
          r = r * (1 - cloudAmount * 0.2) + 240 * cloudAmount;
          g = g * (1 - cloudAmount * 0.15) + 220 * cloudAmount;
          b = b * (1 - cloudAmount * 0.1) + 200 * cloudAmount;
        }
        
        // Volcanic dark spots
        if (volcanos < 0.2) {
          r *= 0.7;
          g *= 0.7;
          b *= 0.7;
        }
      } else if (type === "earth") {
        // Earth: Blue oceans, green/brown continents, white polar ice, clouds
        const n = fractalNoise(nx * 10, ny * 10, 6);
        const n2 = fractalNoise(nx * 5, ny * 5, 4);
        const n3 = fractalNoise(nx * 20, ny * 20, 3);
        const clouds = fractalNoise(nx * 15, ny * 15, 3);
        const lat = Math.abs(ny - 0.5) * 2;
        
        if (n > 0.28) {
          // Continents - varied terrain
          const terrain = n3 * 0.3;
          const isGreen = n > 0.35; // Some areas greener
          r = isGreen ? 60 + n * 40 + terrain * 15 : 85 + n * 55 + terrain * 15;
          g = isGreen ? 120 + n * 50 + terrain * 20 : 105 + n * 35 + terrain * 10;
          b = isGreen ? 50 + n * 30 + terrain * 10 : 65 + n * 25 + terrain * 8;
          
          // Polar ice caps
          if (lat > 0.7) {
            const iceAmount = (lat - 0.7) / 0.3;
            r = r * (1 - iceAmount * 0.6) + 200 * iceAmount;
            g = g * (1 - iceAmount * 0.6) + 220 * iceAmount;
            b = b * (1 - iceAmount * 0.4) + 240 * iceAmount;
          }
        } else {
          // Oceans with depth
          const depth = n2 * 0.5 + 0.5;
          r = 15 + depth * 10 + n3 * 5;
          g = 35 + depth * 15 + n3 * 8;
          b = 75 + depth * 25 + n3 * 12;
          if (lat > 0.75) {
            r = 180 + n3 * 20;
            g = 200 + n3 * 20;
            b = 230 + n3 * 25;
          }
        }
        
        // White clouds
        if (clouds > 0.65) {
          const cloudAmount = (clouds - 0.65) / 0.35;
          r = r * (1 - cloudAmount * 0.5) + 255 * cloudAmount;
          g = g * (1 - cloudAmount * 0.5) + 255 * cloudAmount;
          b = b * (1 - cloudAmount * 0.3) + 255 * cloudAmount;
        }
      } else if (type === "mars") {
        // Mars: Red-orange with craters, canyons, polar ice caps, dust storms
        const n = fractalNoise(nx * 12, ny * 12, 6);
        const n2 = fractalNoise(nx * 4, ny * 4, 3);
        const craters = fractalNoise(nx * 25, ny * 25, 2);
        const dust = fractalNoise(nx * 2, ny * 2, 1);
        const lat = Math.abs(ny - 0.5) * 2;
        
        // Red-orange base
        r = 180 + n * 50 + n2 * 15;
        g = 100 + n * 30 + n2 * 12;
        b = 70 + n * 20 + n2 * 8;
        
        // Craters
        if (craters < 0.2) {
          const craterDepth = (0.2 - craters) / 0.2;
          r *= (1 - craterDepth * 0.4);
          g *= (1 - craterDepth * 0.4);
          b *= (1 - craterDepth * 0.4);
        }
        
        // Polar ice caps (white)
        if (lat > 0.75) {
          const iceAmount = (lat - 0.75) / 0.25;
          r = r * (1 - iceAmount * 0.7) + 220 * iceAmount;
          g = g * (1 - iceAmount * 0.7) + 230 * iceAmount;
          b = b * (1 - iceAmount * 0.6) + 240 * iceAmount;
        }
        
        // Dust storms
        if (dust > 0.7) {
          const dustAmount = (dust - 0.7) / 0.3;
          r = r * (1 - dustAmount * 0.2) + 200 * dustAmount;
          g = g * (1 - dustAmount * 0.3) + 140 * dustAmount;
          b = b * (1 - dustAmount * 0.4) + 100 * dustAmount;
        }
      } else if (type === "jupiter") {
        // Jupiter: Colorful bands, Great Red Spot, storms, swirls
        const bandNoise = Math.sin(ny * Math.PI * 10 + nx * 0.5) * 0.4 + 0.6;
        const n = fractalNoise(nx * 15, ny * 10, 5);
        const swirl = Math.sin((nx + ny * 0.7) * Math.PI * 6) * 0.3;
        
        // Colorful bands (orange, brown, white, red)
        const bandColor = Math.floor((ny * 10) % 4);
        if (bandColor === 0) {
          r = 220 + bandNoise * 30 + n * 20;
          g = 160 + bandNoise * 20 + n * 15;
          b = 120 + bandNoise * 15 + n * 10;
        } else if (bandColor === 1) {
          r = 180 + bandNoise * 25 + n * 18;
          g = 140 + bandNoise * 20 + n * 15;
          b = 100 + bandNoise * 15 + n * 12;
        } else if (bandColor === 2) {
          r = 240 + bandNoise * 15;
          g = 230 + bandNoise * 15;
          b = 220 + bandNoise * 15;
        } else {
          r = 200 + bandNoise * 30 + n * 20;
          g = 120 + bandNoise * 20 + n * 15;
          b = 100 + bandNoise * 15 + n * 10;
        }
        
        // Swirls
        if (swirl > 0.15) {
          r += swirl * 20;
          g += swirl * 15;
        }
        
        // Great Red Spot
        const spotX = 0.3;
        const spotY = 0.4;
        const spotDist = Math.sqrt((nx - spotX) ** 2 + (ny - spotY) ** 2);
        if (spotDist < 0.12) {
          const spotIntensity = (0.12 - spotDist) / 0.12;
          r = r * (1 - spotIntensity * 0.2) + 200 * spotIntensity;
          g = g * (1 - spotIntensity * 0.5) + 60 * spotIntensity;
          b = b * (1 - spotIntensity * 0.6) + 40 * spotIntensity;
        }
      } else if (type === "saturn") {
        // Saturn: Pale yellow with subtle bands, less colorful than Jupiter
        const bandNoise = Math.sin(ny * Math.PI * 8 + nx * 0.3) * 0.25 + 0.75;
        const n = fractalNoise(nx * 12, ny * 8, 4);
        const swirl = Math.sin((nx + ny * 0.5) * Math.PI * 4) * 0.2;
        
        // Pale yellow-gold bands
        r = 240 + bandNoise * 15 + n * 10 + swirl * 5;
        g = 220 + bandNoise * 20 + n * 12 + swirl * 8;
        b = 180 + bandNoise * 15 + n * 10 + swirl * 5;
        
        // Occasional darker bands
        if (bandNoise < 0.6) {
          r *= 0.85;
          g *= 0.85;
          b *= 0.85;
        }
      } else if (type === "uranus") {
        // Uranus: Pale blue-green with subtle bands, featureless
        const n = fractalNoise(nx * 6, ny * 6, 4);
        const band = Math.sin(ny * Math.PI * 4 + nx * 0.2) * 0.15 + 0.85;
        const clouds = fractalNoise(nx * 10, ny * 10, 2);
        
        // Pale blue-green
        r = 120 + band * 20 + n * 15 + clouds * 10;
        g = 180 + band * 30 + n * 20 + clouds * 15;
        b = 200 + band * 40 + n * 25 + clouds * 20;
        
        // Subtle cloud features
        if (clouds > 0.65) {
          const cloudAmount = (clouds - 0.65) / 0.35;
          r = r * (1 - cloudAmount * 0.3) + 180 * cloudAmount;
          g = g * (1 - cloudAmount * 0.2) + 220 * cloudAmount;
          b = b * (1 - cloudAmount * 0.1) + 240 * cloudAmount;
        }
      } else if (type === "neptune") {
        // Neptune: Deep blue with white clouds, dark spots, more active than Uranus
        const n = fractalNoise(nx * 8, ny * 8, 5);
        const band = Math.sin(ny * Math.PI * 5 + nx * 0.3) * 0.2 + 0.8;
        const clouds = fractalNoise(nx * 12, ny * 12, 3);
        const spots = fractalNoise(nx * 3, ny * 3, 1);
        
        // Deep blue base
        r = 40 + band * 20 + n * 12;
        g = 80 + band * 30 + n * 18;
        b = 140 + band * 50 + n * 25;
        
        // White cloud features
        if (clouds > 0.6) {
          const cloudAmount = (clouds - 0.6) / 0.4;
          r = r * (1 - cloudAmount * 0.4) + 200 * cloudAmount;
          g = g * (1 - cloudAmount * 0.3) + 220 * cloudAmount;
          b = b * (1 - cloudAmount * 0.2) + 240 * cloudAmount;
        }
        
        // Dark spots (like Great Dark Spot)
        if (spots < 0.15) {
          const spotIntensity = (0.15 - spots) / 0.15;
          r *= (1 - spotIntensity * 0.5);
          g *= (1 - spotIntensity * 0.4);
          b *= (1 - spotIntensity * 0.3);
        }
      }

      data[i] = Math.min(255, Math.max(0, r));
      data[i + 1] = Math.min(255, Math.max(0, g));
      data[i + 2] = Math.min(255, Math.max(0, b));
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Create normal map for surface detail
function createNormalMap(size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  function noise(x, y) {
    return Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1;
  }

  function smoothNoise(x, y) {
    const intX = Math.floor(x);
    const intY = Math.floor(y);
    const fracX = x - intX;
    const fracY = y - intY;
    const v1 = noise(intX, intY);
    const v2 = noise(intX + 1, intY);
    const v3 = noise(intX, intY + 1);
    const v4 = noise(intX + 1, intY + 1);
    const i1 = v1 * (1 - fracX) + v2 * fracX;
    const i2 = v3 * (1 - fracX) + v4 * fracX;
    return i1 * (1 - fracY) + i2 * fracY;
  }

  function fractalNoise(x, y) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    for (let i = 0; i < 4; i++) {
      value += smoothNoise(x * frequency, y * frequency) * amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return value;
  }

  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;
      const n = fractalNoise(nx * 8, ny * 8);
      // Normal map: RGB = XYZ normal vector
      const height = n;
      const dx = (fractalNoise((nx + 1 / size) * 8, ny * 8) - height) * 0.5;
      const dy = (fractalNoise(nx * 8, (ny + 1 / size) * 8) - height) * 0.5;
      const dz = Math.sqrt(1 - dx * dx - dy * dy);
      data[i] = (dx + 1) * 127.5;
      data[i + 1] = (dy + 1) * 127.5;
      data[i + 2] = dz * 255;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const planetConfigs = [
  {
    name: "Mercury",
    radius: 0.25,
    orbitRadius: 3.5,
    speed: 0.45,
    type: "mercury",
    rotationSpeed: 0.015,
    tilt: 0.03,
    roughness: 0.9,
    metalness: 0.2,
    hasRings: false,
  },
  {
    name: "Venus",
    radius: 0.35,
    orbitRadius: 4.8,
    speed: 0.35,
    type: "venus",
    rotationSpeed: -0.004, // Retrograde rotation
    tilt: 2.6,
    roughness: 0.8,
    metalness: 0.1,
    hasRings: false,
  },
  {
    name: "Earth",
    radius: 0.38,
    orbitRadius: 6.2,
    speed: 0.30,
    type: "earth",
    rotationSpeed: 0.025,
    tilt: 0.41,
    roughness: 0.75,
    metalness: 0.1,
    hasRings: false,
  },
  {
    name: "Mars",
    radius: 0.28,
    orbitRadius: 8.5,
    speed: 0.24,
    type: "mars",
    rotationSpeed: 0.024,
    tilt: 0.44,
    roughness: 0.85,
    metalness: 0.1,
    hasRings: false,
  },
  {
    name: "Jupiter",
    radius: 1.2,
    orbitRadius: 12,
    speed: 0.13,
    type: "jupiter",
    rotationSpeed: 0.04,
    tilt: 0.05,
    roughness: 0.6,
    metalness: 0.05,
    hasRings: false,
  },
  {
    name: "Saturn",
    radius: 1.0,
    orbitRadius: 18,
    speed: 0.095,
    type: "saturn",
    rotationSpeed: 0.038,
    tilt: 0.47,
    roughness: 0.65,
    metalness: 0.05,
    hasRings: true,
  },
  {
    name: "Uranus",
    radius: 0.65,
    orbitRadius: 24,
    speed: 0.068,
    type: "uranus",
    rotationSpeed: 0.03,
    tilt: 1.7, // Extreme tilt
    roughness: 0.6,
    metalness: 0.1,
    hasRings: false,
  },
  {
    name: "Neptune",
    radius: 0.62,
    orbitRadius: 30,
    speed: 0.054,
    type: "neptune",
    rotationSpeed: 0.032,
    tilt: 0.49,
    roughness: 0.6,
    metalness: 0.12,
    hasRings: false,
  },
];

const planets = [];

// Create planet-specific normal maps for better detail
function createPlanetNormalMap(type, size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  
  function noise(x, y) {
    return Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1;
  }
  
  function smoothNoise(x, y) {
    const intX = Math.floor(x);
    const intY = Math.floor(y);
    const fracX = x - intX;
    const fracY = y - intY;
    const v1 = noise(intX, intY);
    const v2 = noise(intX + 1, intY);
    const v3 = noise(intX, intY + 1);
    const v4 = noise(intX + 1, intY + 1);
    const i1 = v1 * (1 - fracX) + v2 * fracX;
    const i2 = v3 * (1 - fracX) + v4 * fracX;
    return i1 * (1 - fracY) + i2 * fracY;
  }
  
  function fractalNoise(x, y, octaves = 4) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    for (let i = 0; i < octaves; i++) {
      value += smoothNoise(x * frequency, y * frequency) * amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return value;
  }
  
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  
  // Different detail levels for different planet types
  const detailScale = type === "mercury" || type === "mars" ? 20 : 
                     type === "jupiter" || type === "saturn" ? 8 :
                     type === "uranus" || type === "neptune" ? 6 : 12;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;
      const n = fractalNoise(nx * detailScale, ny * detailScale, 5);
      const height = n;
      const dx = (fractalNoise((nx + 1 / size) * detailScale, ny * detailScale, 5) - height) * 0.5;
      const dy = (fractalNoise(nx * detailScale, (ny + 1 / size) * detailScale, 5) - height) * 0.5;
      const dz = Math.sqrt(1 - dx * dx - dy * dy);
      data[i] = (dx + 1) * 127.5;
      data[i + 1] = (dy + 1) * 127.5;
      data[i + 2] = dz * 255;
      data[i + 3] = 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

// Function to create ring texture for gas giants
function createRingTexture(size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - size / 2;
      const dy = y - size / 2;
      const dist = Math.sqrt(dx * dx + dy * dy) / (size / 2);
      
      // Create concentric rings with gaps
      const ringPattern = Math.sin(dist * Math.PI * 12) * 0.5 + 0.5;
      const gapPattern = dist < 0.3 || dist > 0.95 ? 0 : 1;
      const opacity = ringPattern * gapPattern * (1 - dist * 0.3);
      
      // Brownish-gray ring color (like Saturn's rings)
      data[i] = 180 * opacity;
      data[i + 1] = 160 * opacity;
      data[i + 2] = 140 * opacity;
      data[i + 3] = opacity * 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

for (let idx = 0; idx < planetConfigs.length; idx++) {
  const cfg = planetConfigs[idx];
  const g = new THREE.SphereGeometry(cfg.radius, 64, 64);
  const texture = createPlanetTexture(cfg.type, 1024); // High resolution for realism
  const normalMap = createPlanetNormalMap(cfg.type, 512); // Planet-specific normal maps
  const m = new THREE.MeshStandardMaterial({
    map: texture,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5), // More pronounced normal mapping
    roughness: cfg.roughness,
    metalness: cfg.metalness,
    emissive: new THREE.Color(0x222222), // Add subtle emissive glow
    emissiveIntensity: 0.3, // Make planets glow slightly
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.userData.orbitRadius = cfg.orbitRadius;
  mesh.userData.speed = cfg.speed;
  mesh.userData.rotationSpeed = cfg.rotationSpeed;
  mesh.userData.angle = Math.random() * Math.PI * 2;
  mesh.userData.tilt = cfg.tilt;
  mesh.userData.rotationY = 0;
  solarSystemGroup.add(mesh);
  planets.push(mesh);
  
  // Add rings to Saturn
  if (cfg.hasRings) {
    const ringGeometry = new THREE.RingGeometry(cfg.radius * 1.3, cfg.radius * 2.2, 128);
    const ringTexture = createRingTexture(512);
    const ringMaterial = new THREE.MeshBasicMaterial({
      map: ringTexture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh.rotation.x = Math.PI / 2 + cfg.tilt;
    // Make ring a child of the planet so it follows automatically
    mesh.add(ringMesh);
  }
}

let galaxyPoints;
let galaxyGeometry;
let galaxyMaterial;

function generateGalaxy() {
  if (galaxyPoints) {
    galaxyGeometry.dispose();
    galaxyMaterial.dispose();
    galaxyGroup.remove(galaxyPoints);
  }

  const {
    particleCount,
    radius,
    branches,
    spin,
    randomness,
    randomnessPower,
    insideColor,
    outsideColor,
    particleSize,
  } = VC_CONFIG.galaxy;

  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  const colorInside = new THREE.Color(insideColor);
  const colorOutside = new THREE.Color(outsideColor);

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;

    const r = Math.random() * radius;
    const branchAngle = ((i % branches) / branches) * Math.PI * 2;
    const spinAngle = r * spin;

    const randomX =
      Math.pow(Math.random(), randomnessPower) *
      (Math.random() < 0.5 ? 1 : -1) *
      randomness *
      r;
    const randomY =
      Math.pow(Math.random(), randomnessPower) *
      (Math.random() < 0.5 ? 1 : -1) *
      randomness *
      0.65 *
      r;
    const randomZ =
      Math.pow(Math.random(), randomnessPower) *
      (Math.random() < 0.5 ? 1 : -1) *
      randomness *
      r;

    positions[i3 + 0] = Math.cos(branchAngle + spinAngle) * r + randomX;
    positions[i3 + 1] = randomY * 0.7;
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + randomZ;

    const mixedColor = colorInside.clone();
    mixedColor.lerp(colorOutside, r / radius);
    colors[i3 + 0] = mixedColor.r;
    colors[i3 + 1] = mixedColor.g;
    colors[i3 + 2] = mixedColor.b;
  }

  galaxyGeometry = new THREE.BufferGeometry();
  galaxyGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
  galaxyGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  galaxyMaterial = new THREE.PointsMaterial({
    size: particleSize,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
  });

  galaxyPoints = new THREE.Points(galaxyGeometry, galaxyMaterial);
  galaxyGroup.add(galaxyPoints);
}

generateGalaxy();

// ---------- Background starfield (scattered everywhere in 3D) ----------
const backgroundStarsGroup = new THREE.Group();
scene.add(backgroundStarsGroup);

function generateBackgroundStars() {
  const starCount = 12000; // More stars for larger map
  const starRadius = 250; // Much larger star field
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    
    // Random position in a sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = Math.random() * starRadius;
    
    positions[i3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);
    
    // Vary star colors slightly (white to slightly blue/white)
    const brightness = 0.7 + Math.random() * 0.3;
    const colorTint = Math.random() * 0.2; // slight blue tint sometimes
    colors[i3 + 0] = brightness;
    colors[i3 + 1] = brightness + colorTint * 0.3;
    colors[i3 + 2] = brightness + colorTint;
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const starMaterial = new THREE.PointsMaterial({
    size: 0.08,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
  });

  const starPoints = new THREE.Points(starGeometry, starMaterial);
  backgroundStarsGroup.add(starPoints);
}

generateBackgroundStars();


// ---------- Interaction state ----------
let clock = new THREE.Clock();

const interactionState = {
  controlling: false,
  lastGrabStrength: 0,
  lastPalmFacing: false,
  lastHandPos3D: new THREE.Vector3(),
  smoothedHandPos3D: new THREE.Vector3(),
  lastFrameTime: performance.now(),
  // camera exploration state (spherical coordinates around galaxy center)
  camTheta: 0, // horizontal orbit angle
  camPhi: 0.9, // vertical angle (0 = up, PI = down)
  camRadius: 20,
  targetCamRadius: 20, // smoothed target for zoom
  lastHandScale: null,
  currentHandScale: null,
};

// World-space center of where the user is “holding” the galaxy
const controlAnchor = new THREE.Vector3(0, 0, 0);

// ---------- Hand tracking (MediaPipe Hands) ----------
// We dynamically import from CDN if available in browser.

const webcamVideo = document.getElementById("vc-webcam");

async function setupWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });
    webcamVideo.srcObject = stream;
  } catch (err) {
    console.warn("Webcam access denied or failed:", err);
  }
}

setupWebcam();

// Use global MediaPipe scripts from index.html if present; if not, the galaxy still works standalone.
let hands;
let mpCamera;

function setupHandsWhenReady(retries = 40) {
  // Wait a bit for the external scripts to load
  if (!window.Hands || !window.Camera) {
    if (retries <= 0) {
      console.warn("MediaPipe scripts not available; gestures disabled.");
      return;
    }
    setTimeout(() => setupHandsWhenReady(retries - 1), 250);
    return;
  }

  try {
    hands = new window.Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    hands.onResults(onHandResults);

    const startCamera = () => {
      if (mpCamera) return;
      // eslint-disable-next-line no-undef
      mpCamera = new window.Camera(webcamVideo, {
        onFrame: async () => {
          await hands.send({ image: webcamVideo });
        },
        width: 640,
        height: 480,
      });
      mpCamera.start();
    };

    if (webcamVideo.readyState >= 2 || webcamVideo.srcObject) {
      startCamera();
    } else {
      webcamVideo.addEventListener("loadeddata", startCamera, { once: true });
    }
  } catch (e) {
    console.warn("Failed to initialize MediaPipe Hands; gestures disabled.", e);
  }
}

setupHandsWhenReady();

// ---------- Hand gesture decoding ----------

/**
 * Estimate how “closed” the hand is based on fingertip distance to wrist.
 * 0 = fully open, 1 = tightly closed.
 */
function estimateGrabStrength(landmarks) {
  const wrist = landmarks[0];

  const fingertipIndices = [4, 8, 12, 16, 20];
  let totalDist = 0;

  for (const idx of fingertipIndices) {
    const tip = landmarks[idx];
    const dx = tip.x - wrist.x;
    const dy = tip.y - wrist.y;
    const dz = (tip.z || 0) - (wrist.z || 0);
    totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  const avgDist = totalDist / fingertipIndices.length;

  // Normalize via simple curve; tuned by eye
  const grab = 1 - THREE.MathUtils.clamp((avgDist - 0.08) / 0.22, 0, 1);
  return grab;
}

/**
 * Estimate how big the hand appears in the frame (used for zoom, and to ignore faces).
 * Uses distance between index knuckle (5) and pinky knuckle (17) as palm width proxy.
 */
function estimateHandScale(landmarks) {
  const a = landmarks[5];
  const b = landmarks[17];
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Rough filter to avoid treating a face or very large blob as a hand.
 * We require the landmark bounding box to be within a reasonable size range.
 */
function passesHandShapeFilter(landmarks) {
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;

  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.y > maxY) maxY = lm.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;

  // Too big or too small is probably not a single hand
  if (width < 0.08 || height < 0.08) return false;
  if (width > 0.55 || height > 0.55) return false;

  // Aspect ratio check (hands are usually taller than wide in this orientation)
  const aspect = height / (width + 1e-5);
  if (aspect < 0.6 || aspect > 3.2) return false;

  return true;
}

/**
 * Roughly estimate if the palm is facing the camera.
 * Use three points on the palm to compute a normal and compare to camera direction.
 */
function isPalmFacingCamera(landmarks) {
  // Use wrist (0), index knuckle (5), pinky knuckle (17)
  const p0 = landmarks[0];
  const p1 = landmarks[5];
  const p2 = landmarks[17];

  const v1 = new THREE.Vector3(p1.x - p0.x, p1.y - p0.y, (p1.z || 0) - (p0.z || 0));
  const v2 = new THREE.Vector3(p2.x - p0.x, p2.y - p0.y, (p2.z || 0) - (p0.z || 0));

  const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();

  // In MediaPipe’s normalized space, camera looks along -Z
  const cameraDir = new THREE.Vector3(0, 0, -1);
  const dot = normal.dot(cameraDir);

  // dot > 0 implies facing roughly toward camera
  return dot > Math.cos(VC_CONFIG.interaction.palmFacingThreshold);
}

/**
 * Convert 2D normalized (x,y) from MediaPipe (0-1 range) to a 3D point
 * in front of the camera we can treat as the control “ball”.
 */
function handToWorldPosition(normX, normY) {
  const x = (normX - 0.5) * 2;
  const y = -(normY - 0.5) * 2;

  const depth = 0.5; // 0 = near, 1 = far, we choose mid
  const ndc = new THREE.Vector3(x, y, depth);
  ndc.unproject(camera);

  // Interpolate from camera position towards unprojected point
  const dir = ndc.sub(camera.position).normalize();
  const distance = 18; // how far in front of camera the control sphere lives

  return new THREE.Vector3().copy(camera.position).add(dir.multiplyScalar(distance));
}

function onHandResults(results) {
  if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
    interactionState.controlling = false;
    return;
  }

  const landmarks = results.multiHandLandmarks[0];

  // Ignore shapes that look too big / wrong to be a hand (helps avoid face mis-detections)
  if (!passesHandShapeFilter(landmarks)) {
    interactionState.controlling = false;
    return;
  }

  const grabStrength = estimateGrabStrength(landmarks);
  const palmFacing = isPalmFacingCamera(landmarks);

  const handScale = estimateHandScale(landmarks);
  interactionState.currentHandScale = handScale;
  if (interactionState.lastHandScale === null) {
    interactionState.lastHandScale = handScale;
  }

  interactionState.lastGrabStrength = grabStrength;
  interactionState.lastPalmFacing = palmFacing;

  const palmCenter = landmarks[9]; // base of middle finger is a nice “hand center”
  const worldPos = handToWorldPosition(palmCenter.x, palmCenter.y);

  // Smooth hand motion so the galaxy feels weighty (slightly looser)
  interactionState.smoothedHandPos3D.lerp(worldPos, 0.14);

  const now = performance.now();
  const dt = (now - interactionState.lastFrameTime) / 1000;
  interactionState.lastFrameTime = now;

  const wasControlling = interactionState.controlling;
  // Small hysteresis so grab doesn't flicker on/off
  const onThreshold = VC_CONFIG.interaction.grabThreshold;
  const offThreshold = onThreshold * 0.7;
  if (wasControlling) {
    interactionState.controlling =
      grabStrength > offThreshold && palmFacing;
  } else {
    interactionState.controlling =
      grabStrength > onThreshold && palmFacing;
  }

  if (interactionState.controlling) {
    if (!wasControlling) {
      // Just grabbed: reset anchor near current position for a stable feel
      controlAnchor.copy(interactionState.smoothedHandPos3D);
      interactionState.lastHandPos3D.copy(interactionState.smoothedHandPos3D);
      interactionState.lastHandScale = interactionState.currentHandScale;
    } else {
      applyGalaxyControl(dt);
    }
  } else {
    interactionState.lastHandPos3D.copy(interactionState.smoothedHandPos3D);
    interactionState.lastHandScale = interactionState.currentHandScale;
  }
}

// ---------- Mapping hand motion to galaxy motion ----------

function applyGalaxyControl(dt) {
  if (!galaxyGroup) return;

  const {
    rotationStrength,
    pushPullStrength,
    cameraOrbitStrength,
    cameraZoomStrength,
  } = VC_CONFIG.interaction;

  const current = interactionState.smoothedHandPos3D;
  const last = interactionState.lastHandPos3D;

  const delta = new THREE.Vector3().subVectors(current, last);
  // Damp raw delta so quick twitches don't overreact – slightly less damping for looser feel
  delta.multiplyScalar(0.65);

  // Horizontal hand motion -> orbit camera around galaxy (theta)
  // Add smoothing for more tactile feel
  const targetThetaDelta = -delta.x * cameraOrbitStrength;
  interactionState.camTheta += targetThetaDelta * 0.85; // smoother but more responsive

  // Vertical hand motion -> change camera altitude (phi)
  const targetPhiDelta = delta.y * cameraOrbitStrength * 0.8;
  const targetPhi = THREE.MathUtils.clamp(
    interactionState.camPhi + targetPhiDelta,
    0.15,
    Math.PI - 0.3
  );
  interactionState.camPhi += (targetPhi - interactionState.camPhi) * 0.8; // smooth phi changes with a bit more snap

  // Forward/backward motion (hand getting bigger/smaller) -> zoom in/out
  let scaleDelta =
    interactionState.currentHandScale != null &&
    interactionState.lastHandScale != null
      ? interactionState.currentHandScale - interactionState.lastHandScale
      : 0;
  // Clamp to avoid sudden spikes from tracking noise (slightly wider for more feel)
  scaleDelta = THREE.MathUtils.clamp(scaleDelta, -0.02, 0.02);
  
  // Smooth zoom changes for better tactile feel
  const zoomChange = -scaleDelta * cameraZoomStrength;
  interactionState.targetCamRadius = THREE.MathUtils.clamp(
    interactionState.targetCamRadius + zoomChange,
    10,
    40
  );
  
  // Smooth interpolation to target radius
  interactionState.camRadius += (interactionState.targetCamRadius - interactionState.camRadius) * VC_CONFIG.interaction.zoomSmoothing;

  // Apply spherical camera coordinates
  const r = interactionState.camRadius;
  const phi = interactionState.camPhi;
  const theta = interactionState.camTheta;
  camera.position.set(
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.cos(theta)
  );
  camera.lookAt(0, 0, 0);

  // Subtle galaxy wobble for living feel
  galaxyGroup.rotation.y += -delta.x * rotationStrength * 0.3;
  galaxyGroup.rotation.x = THREE.MathUtils.clamp(
    galaxyGroup.rotation.x + delta.y * rotationStrength * 0.2,
    -Math.PI / 3,
    Math.PI / 3
  );

  // Update last position for next frame
  interactionState.lastHandPos3D.copy(current);
}

// ---------- Random shooting stars ----------
const shootingStarsGroup = new THREE.Group();
scene.add(shootingStarsGroup);

const shootingStars = [];

function createShootingStar() {
  // Random start position on the edge of the visible area
  const startDistance = 80 + Math.random() * 40;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(Math.random() * 2 - 1);
  
  const startPos = new THREE.Vector3(
    startDistance * Math.sin(phi) * Math.cos(theta),
    startDistance * Math.sin(phi) * Math.sin(theta),
    startDistance * Math.cos(phi)
  );
  
  // Direction toward center (or random direction)
  const targetPos = new THREE.Vector3(
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20
  );
  
  const direction = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
  const speed = 15 + Math.random() * 10;
  const length = 4 + Math.random() * 6;
  
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(2 * 3);
  const colors = new Float32Array(2 * 3);
  
  // Start and end points of the streak
  positions[0] = startPos.x;
  positions[1] = startPos.y;
  positions[2] = startPos.z;
  
  positions[3] = startPos.x + direction.x * length;
  positions[4] = startPos.y + direction.y * length;
  positions[5] = startPos.z + direction.z * length;
  
  // Color: white to slightly blue/cyan, brighter at start
  const brightness = 0.8 + Math.random() * 0.2;
  const colorTint = Math.random() * 0.3;
  colors[0] = brightness;
  colors[1] = brightness + colorTint * 0.2;
  colors[2] = brightness + colorTint;
  colors[3] = brightness * 0.2; // Fade at tail
  colors[4] = (brightness + colorTint * 0.2) * 0.2;
  colors[5] = (brightness + colorTint) * 0.2;
  
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 1,
    linewidth: 2,
  });
  
  const line = new THREE.Line(geometry, material);
  line.userData.velocity = direction.multiplyScalar(speed);
  line.userData.lifetime = 0;
  line.userData.maxLifetime = 1.5 + Math.random() * 1;
  shootingStarsGroup.add(line);
  shootingStars.push(line);
  
  return line;
}

// Spawn shooting stars randomly
let lastShootingStarSpawn = 0;
let shootingStarSpawnInterval = 2 + Math.random() * 3; // Random interval between 2-5 seconds

// ---------- Animation loop ----------

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  
  // Spawn random shooting stars
  if (elapsed - lastShootingStarSpawn > shootingStarSpawnInterval) {
    createShootingStar();
    lastShootingStarSpawn = elapsed;
    // Reset interval for next spawn
    shootingStarSpawnInterval = 2 + Math.random() * 3;
  }
  
  // Animate and remove shooting stars
  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const star = shootingStars[i];
    star.userData.lifetime += clock.getDelta();
    
    // Move the star along its velocity
    star.position.add(star.userData.velocity.clone().multiplyScalar(clock.getDelta()));
    
    // Fade out over lifetime
    const age = star.userData.lifetime / star.userData.maxLifetime;
    star.material.opacity = 1 - age;
    
    // Remove when expired or faded
    if (star.userData.lifetime >= star.userData.maxLifetime || star.material.opacity <= 0) {
      shootingStarsGroup.remove(star);
      star.geometry.dispose();
      star.material.dispose();
      shootingStars.splice(i, 1);
    }
  }
  
  // Animate planets around the sun
  for (const planet of planets) {
    const { orbitRadius, speed, tilt, rotationSpeed } = planet.userData;
    planet.userData.angle += speed * 0.5 * clock.getDelta();
    const angle = planet.userData.angle;
    planet.position.set(
      Math.cos(angle) * orbitRadius,
      Math.sin(angle) * tilt,
      Math.sin(angle) * orbitRadius
    );
    // Rotate planet on its own axis for realistic spinning
    planet.userData.rotationY += rotationSpeed;
    planet.rotation.y = planet.userData.rotationY;
  }

  // Base galaxy motion: slow swirl + breathing
  galaxyGroup.rotation.y += 0.0012;
  galaxyGroup.rotation.z = Math.sin(elapsed * 0.06) * 0.06;

  // Subtle breathing scale for a living galaxy feel
  const baseScale = 1 + Math.sin(elapsed * 0.14) * 0.05;
  galaxyGroup.scale.setScalar(baseScale);

  renderer.render(scene, camera);
}

animate();

// ---------- Resize handling ----------

window.addEventListener("resize", () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// Expose config on window for designers to tweak at runtime if they open devtools
window.VIBE_CONTROLLER_CONFIG = VC_CONFIG;


