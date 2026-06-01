const ARTWORK_PALETTES = [
  ["#0f766e", "#f59e0b", "#f8fafc"],
  ["#7c3aed", "#06b6d4", "#f8fafc"],
  ["#be123c", "#f97316", "#fff7ed"],
  ["#1d4ed8", "#22c55e", "#eff6ff"],
  ["#4338ca", "#ec4899", "#fdf2f8"],
  ["#047857", "#84cc16", "#f7fee7"],
  ["#b45309", "#e11d48", "#fff7ed"],
  ["#0e7490", "#a855f7", "#f0f9ff"],
];

const hashString = (value = "") =>
  String(value).split("").reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 7);

const escapeSvgText = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const initials = (value = "", fallback = "M") => {
  const words = String(value).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
};

export const getArtworkPalette = (seed = "") => {
  const hash = hashString(seed);
  return ARTWORK_PALETTES[hash % ARTWORK_PALETTES.length] || ARTWORK_PALETTES[0];
};

const svgDataUri = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const isPlaceholderArtwork = (value = "") => {
  const normalized = String(value).trim().toLowerCase();
  return (
    !normalized ||
    normalized.endsWith("/default_cover.png") ||
    normalized === "default_cover.png" ||
    normalized.endsWith("/my-logo.png") ||
    normalized === "my-logo.png"
  );
};

const firstRealArtwork = (...values) =>
  values.find((value) => !isPlaceholderArtwork(value));

export const createTrackArtwork = (track = {}) => {
  const title = track.track_name || track.title || "Song";
  const artist = track.artist_name || track.artist || "Unknown Artist";
  const seed = track.id || track.track_id || `${title}-${artist}`;
  const [primary, secondary, text] = getArtworkPalette(seed);
  const label = escapeSvgText(initials(title, "S"));
  const safeTitle = escapeSvgText(title);
  const safeArtist = escapeSvgText(artist);

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${primary}"/>
          <stop offset="100%" stop-color="${secondary}"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#020617" flood-opacity="0.28"/>
        </filter>
      </defs>
      <rect width="400" height="400" rx="36" fill="url(#bg)"/>
      <circle cx="326" cy="72" r="96" fill="#ffffff" opacity="0.14"/>
      <circle cx="70" cy="330" r="120" fill="#000000" opacity="0.12"/>
      <g filter="url(#shadow)">
        <rect x="92" y="82" width="216" height="216" rx="24" fill="#ffffff" opacity="0.2"/>
        <path d="M240 126v112.5a31.5 31.5 0 1 1-18-28.5V154l-78 18v82.5a31.5 31.5 0 1 1-18-28.5v-96l114-26z" fill="${text}"/>
      </g>
      <text x="36" y="340" fill="${text}" font-family="Arial, sans-serif" font-size="52" font-weight="800">${label}</text>
      <text x="36" y="368" fill="${text}" opacity="0.86" font-family="Arial, sans-serif" font-size="18" font-weight="700">${safeTitle.slice(0, 28)}</text>
      <text x="36" y="390" fill="${text}" opacity="0.72" font-family="Arial, sans-serif" font-size="15">${safeArtist.slice(0, 32)}</text>
    </svg>
  `);
};

export const createArtistArtwork = (artist = {}) => {
  const name = artist.name || artist.artist_name || artist.artist || "Artist";
  const seed = artist.id || artist.artist_id || name;
  const [primary, secondary, text] = getArtworkPalette(seed);
  const label = escapeSvgText(initials(name, "A"));
  const safeName = escapeSvgText(name);

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <radialGradient id="spot" cx="50%" cy="32%" r="70%">
          <stop offset="0%" stop-color="${secondary}"/>
          <stop offset="100%" stop-color="${primary}"/>
        </radialGradient>
      </defs>
      <rect width="400" height="400" rx="36" fill="url(#spot)"/>
      <circle cx="200" cy="152" r="82" fill="#ffffff" opacity="0.22"/>
      <path d="M86 360c12-88 70-136 114-136s102 48 114 136" fill="#ffffff" opacity="0.22"/>
      <circle cx="304" cy="84" r="74" fill="#ffffff" opacity="0.12"/>
      <circle cx="86" cy="310" r="98" fill="#000000" opacity="0.13"/>
      <text x="200" y="178" text-anchor="middle" fill="${text}" font-family="Arial, sans-serif" font-size="78" font-weight="800">${label}</text>
      <text x="200" y="344" text-anchor="middle" fill="${text}" opacity="0.9" font-family="Arial, sans-serif" font-size="24" font-weight="700">${safeName.slice(0, 24)}</text>
    </svg>
  `);
};

export const createAlbumArtwork = (album = {}) =>
  {
    const safeAlbum = album || {};
    const title = safeAlbum.name || safeAlbum.album || safeAlbum.title || "Album";
    const artist = safeAlbum.artist_name || safeAlbum.artist || "Unknown Artist";
    const seed = safeAlbum.id || safeAlbum.album_id || `${title}-${artist}`;
    const hash = hashString(seed);
    const [primary, secondary, text] = getArtworkPalette(seed);
    const accentPalette = ARTWORK_PALETTES[(hash >> 3) % ARTWORK_PALETTES.length] || ARTWORK_PALETTES[0];
    const accent = accentPalette[1] === secondary ? accentPalette[0] : accentPalette[1];
    const label = escapeSvgText(initials(title, "A"));
    const safeTitle = escapeSvgText(title);
    const safeArtist = escapeSvgText(artist);
    const rotation = hash % 360;
    const ringOffset = 56 + (hash % 42);
    const stripeWidth = 18 + (hash % 18);

    return svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
        <defs>
          <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="${primary}"/>
            <stop offset="58%" stop-color="${secondary}"/>
            <stop offset="100%" stop-color="${accent}"/>
          </linearGradient>
          <pattern id="stripes" width="${stripeWidth}" height="${stripeWidth}" patternUnits="userSpaceOnUse" patternTransform="rotate(${rotation})">
            <rect width="${stripeWidth}" height="${stripeWidth}" fill="transparent"/>
            <rect width="${Math.max(4, Math.floor(stripeWidth / 3))}" height="${stripeWidth}" fill="#ffffff" opacity="0.12"/>
          </pattern>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#020617" flood-opacity="0.26"/>
          </filter>
        </defs>
        <rect width="400" height="400" rx="34" fill="url(#bg)"/>
        <rect width="400" height="400" rx="34" fill="url(#stripes)"/>
        <circle cx="${ringOffset}" cy="76" r="116" fill="#ffffff" opacity="0.12"/>
        <circle cx="${344 - (hash % 72)}" cy="${300 + (hash % 48)}" r="132" fill="#000000" opacity="0.14"/>
        <g filter="url(#shadow)">
          <circle cx="200" cy="184" r="104" fill="#ffffff" opacity="0.22"/>
          <circle cx="200" cy="184" r="72" fill="#000000" opacity="0.11"/>
          <circle cx="200" cy="184" r="24" fill="${text}" opacity="0.92"/>
          <circle cx="200" cy="184" r="10" fill="${primary}" opacity="0.95"/>
        </g>
        <text x="200" y="204" text-anchor="middle" fill="${text}" font-family="Arial, sans-serif" font-size="58" font-weight="800">${label}</text>
        <text x="36" y="338" fill="${text}" font-family="Arial, sans-serif" font-size="25" font-weight="800">${safeTitle.slice(0, 24)}</text>
        <text x="36" y="368" fill="${text}" opacity="0.8" font-family="Arial, sans-serif" font-size="17" font-weight="700">${safeArtist.slice(0, 30)}</text>
      </svg>
    `);
  };

export const getTrackArtwork = (track = {}) =>
  firstRealArtwork(track.image_url, track.cover_url) || createTrackArtwork(track);

export const getArtistArtwork = (artist = {}) =>
  firstRealArtwork(artist.image, artist.profile_image_url, artist.image_url) || createArtistArtwork(artist);

export const getAlbumArtwork = (album = {}) =>
  firstRealArtwork(album.image, album.cover_image_url, album.cover_url) || createAlbumArtwork(album);
