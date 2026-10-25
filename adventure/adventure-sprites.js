(function (root, factory) {
  const sprites = factory();
  if (typeof module === 'object' && module.exports) module.exports = sprites;
  if (root) root.AdventureSprites = sprites;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const PALETTE = {
    ink: '#342c28', paper: '#f7eedb', cream: '#fff8e9', saddle: '#75462f',
    leather: '#51372c', gold: '#d9a34b', shade: '#352d2a', forest: '#426858'
  };
  const DEFAULT_ACCENT = '#e58f3b';
  const species = {
    fox: {
      body: '#cf713d', light: '#eea65f', dark: '#a54f32', face: '#f6e6ca',
      tail: '<path d="M37 59C27 56 19 49 15 40c9 2 17 4 23 10l6 7-2 10z" fill="#bc5d35" stroke="#342c28" stroke-width="2.5" stroke-linejoin="round"/><path d="M17 42c8 2 14 5 20 10l5 6-5 1c-8-2-15-8-20-17z" fill="#fff1da"/>',
      backEar: '<path d="M69 43 71 25q1-4 4 0l8 14z" fill="#b95636" stroke="#342c28" stroke-width="2.2" stroke-linejoin="round"/><path d="m73 37 1-8 4 7z" fill="#f2c39a"/>',
      head: '<path d="M73 40q7-8 20-4l15 8-14 7-17-2z" fill="#cf713d" stroke="#342c28" stroke-width="2.5" stroke-linejoin="round"/><path d="m88 47 22-3q4 1 0 4l-13 5-10-2z" fill="#f6e6ca"/><path d="m82 39 3-11q1-3 4 0l5 11z" fill="#cf713d" stroke="#342c28" stroke-width="2" stroke-linejoin="round"/><path d="m86 36 1-4 2 5z" fill="#f6c8a0"/>',
      markings: '<path d="M51 63q7 5 14 1l-2 7q-9 3-14-2z" fill="#f6e6ca"/><path d="M98 48h2" stroke="#342c28" stroke-width="2.3" stroke-linecap="round"/>'
    },
    bear: {
      body: '#8c6042', light: '#bd8a5b', dark: '#684831', face: '#d5ad7c',
      tail: '<path d="M32 59q-6 0-8 5 5 5 11 1z" fill="#8c6042" stroke="#342c28" stroke-width="2"/>',
      backEar: '<circle cx="76" cy="37" r="6" fill="#8c6042" stroke="#342c28" stroke-width="2.2"/><circle cx="76" cy="37" r="2.5" fill="#d4a17b"/>',
      head: '<path d="M75 39q7-8 17-5 11 3 12 14l-8 7-17-2-7-7z" fill="#8c6042" stroke="#342c28" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="101" cy="49" rx="8" ry="5.5" fill="#d5ad7c" stroke="#342c28" stroke-width="2"/><ellipse cx="106" cy="47" rx="2.5" ry="1.8" fill="#342c28"/><path d="M88 39h1" stroke="#342c28" stroke-width="2.2" stroke-linecap="round"/>',
      markings: '<path d="M47 55q10-7 21-2" fill="none" stroke="#d7aa78" stroke-width="3" stroke-linecap="round"/>'
    },
    boar: {
      body: '#76513d', light: '#a77753', dark: '#593c31', face: '#d6ad79',
      tail: '<path d="M34 61q-8 3-8-3 5-6 9 1" fill="none" stroke="#76513d" stroke-width="3" stroke-linecap="round"/>',
      backEar: '<path d="M76 43q-8-8-3-13 8 0 11 10z" fill="#76513d" stroke="#342c28" stroke-width="2.2"/><path d="m76 38-1-4 4 4z" fill="#d5a28a"/>',
      head: '<path d="M76 42q9-10 20-3l7 7 13 8-15 5-20-5-9-6z" fill="#76513d" stroke="#342c28" stroke-width="2.5" stroke-linejoin="round"/><path d="m96 51 20 3q4 3-1 6l-17 2-8-5z" fill="#d6ad79" stroke="#342c28" stroke-width="2"/><ellipse cx="112" cy="57" rx="2.7" ry="1.8" fill="#342c28"/><path d="m98 55-1 7q-5 2-4-3z" fill="#fff2d6" stroke="#342c28" stroke-width="1.3"/><path d="M85 39h1" stroke="#342c28" stroke-width="2.2" stroke-linecap="round"/>',
      markings: '<path d="M48 47q5-6 9 0 5-8 10-1 5-8 10-1" fill="none" stroke="#bd8a5b" stroke-width="4" stroke-linecap="round"/><path d="m101 47 3-3" stroke="#fff0d2" stroke-width="2"/>'
    },
    wolf: {
      body: '#777e7b', light: '#aeb6aa', dark: '#596462', face: '#ddd8c7',
      tail: '<path d="M36 58Q25 54 17 43q11 1 19 7l8 8-3 8z" fill="#777e7b" stroke="#342c28" stroke-width="2.5" stroke-linejoin="round"/><path d="m18 44 11 4 10 8-5 1q-9-3-16-13z" fill="#ddd8c7"/>',
      backEar: '<path d="M71 42 69 26q0-4 4-1l10 14z" fill="#777e7b" stroke="#342c28" stroke-width="2.2" stroke-linejoin="round"/><path d="m73 36-1-7 6 7z" fill="#d6a795"/>',
      head: '<path d="M74 40q7-9 17-5 8 3 10 10l17 6q3 2-1 4l-17 4-16-5-9-7z" fill="#777e7b" stroke="#342c28" stroke-width="2.5" stroke-linejoin="round"/><path d="m97 51 20 1q3 1 0 4l-17 4-8-4z" fill="#ddd8c7"/><path d="m84 39 2-12q1-3 4 0l5 12z" fill="#777e7b" stroke="#342c28" stroke-width="2" stroke-linejoin="round"/><path d="M91 42h1" stroke="#342c28" stroke-width="2.2" stroke-linecap="round"/>',
      markings: '<path d="M46 56q9-7 22-4" fill="none" stroke="#c5c6b6" stroke-width="3" stroke-linecap="round"/>'
    },
    deer: {
      body: '#b77d4e', light: '#dda96f', dark: '#8b5c3e', face: '#f1dfbd',
      tail: '<path d="M34 58q-8-4-10-11 8 1 13 7l5 5-3 6z" fill="#b77d4e" stroke="#342c28" stroke-width="2" stroke-linejoin="round"/><path d="m25 49 9 5 6 5-5 1q-6-3-10-11z" fill="#f1dfbd"/>',
      backEar: '<path d="M74 42q-9-8-5-12 7 1 12 9z" fill="#b77d4e" stroke="#342c28" stroke-width="2.2"/><path d="m73 37-1-4 5 4z" fill="#dba693"/>',
      head: '<path d="M76 40q8-8 16-4 9 4 9 12l13 5-9 5-15-3-11-7z" fill="#b77d4e" stroke="#342c28" stroke-width="2.5" stroke-linejoin="round"/><path d="m97 49 16 5q3 2-1 4l-14 1-8-5z" fill="#f1dfbd"/><path d="M99 38q3-5 2-11m0 5 5-4m-5 8-5-4m-7 7q-2-6-1-11m1 6-5-3m5 8 4-5" fill="none" stroke="#8b5c3e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M89 42h1" stroke="#342c28" stroke-width="2.2" stroke-linecap="round"/>',
      markings: '<path d="M54 58h1m6 1h1m6-2h1" stroke="#f5dfb8" stroke-width="2.3" stroke-linecap="round"/>'
    },
    rabbit: {
      body: '#b6a995', light: '#ded3bd', dark: '#877e70', face: '#f6e9d2',
      tail: '<circle cx="32" cy="62" r="5" fill="#f6e9d2" stroke="#342c28" stroke-width="2"/>',
      backEar: '<path d="M79 40q-5-16 0-24 5-3 7 3l3 19z" fill="#b6a995" stroke="#342c28" stroke-width="2.2" stroke-linejoin="round"/><path d="m82 36-1-14 3-2 2 15z" fill="#d9a9a0"/>',
      head: '<path d="M77 42q6-9 16-5 8 3 9 12l12 4q3 2 0 4l-14 4-16-6-8-7z" fill="#b6a995" stroke="#342c28" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="108" cy="54" rx="2.6" ry="2" fill="#d78378"/><path d="M91 43h1" stroke="#342c28" stroke-width="2.2" stroke-linecap="round"/><path d="M88 50q4 4 8 0" fill="none" stroke="#f6e9d2" stroke-width="2" stroke-linecap="round"/>',
      markings: '<ellipse cx="48" cy="69" rx="11" ry="6" fill="#d9cdb6"/>'
    }
  };

  function escapeXml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char];
    });
  }

  function validColor(value) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_ACCENT;
  }

  function sizeValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 16 && parsed <= 512 ? parsed : 128;
  }

  function legs(fill, shadow) {
    return '<g stroke="#342c28" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M47 64 43 78l-5 4q-1 2 2 2h9l2-2-1-13M66 65l1 13-3 4q0 2 3 2h8q2-1 0-3l-2-4 1-14" fill="' + shadow + '"/>' +
      '<path d="M79 63l5 13-1 5 2 3q1 1 8 0 2-1-1-3l-3-2-3-17M97 59l7 12-1 6 2 4q2 1 8 0 2-1-1-3l-4-3-4-18" fill="' + fill + '"/>' +
      '</g>';
  }

  function rider(accent) {
    return '<g stroke="#342c28" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">' +
      // Saddle and little stirrup make the rider read as mounted, even at map scale.
      '<path d="M47 56q11-8 24-3l8 7-7 6H49l-5-4z" fill="#75462f"/><path d="M50 58q10-4 21 0" fill="none" stroke="#d9a34b" stroke-width="1.6"/><path d="M75 64 82 75l-3 1-8-10z" fill="none" stroke="#75462f" stroke-width="2"/>' +
      // Cloak, shoulder and arm are deliberately separated from the animal's back.
      '<path d="M51 45q5-6 12-5 8 0 11 7l-3 13q-7 7-19 1l-5-7z" fill="' + accent + '"/><path d="M50 48q-5 3-4 9l6 3 5-7" fill="' + accent + '"/><path d="M50 56q4 2 7-2" fill="none" stroke="#f6e6ca" stroke-width="1.5"/>' +
      '<path d="M54 60q3 4 8 4l-1 5-7-1-4-5z" fill="#493a34"/><path d="M68 60q4 3 7 2l2 5-7 1-5-4z" fill="#493a34"/><path d="M52 67q3 1 8 0l1 2-2 2h-9q-2-1 0-3zM69 66q4 1 8-1l2 2-2 3h-9q-2-1 1-4z" fill="#342c28"/>' +
      // Hood silhouette and small visible face.
      '<path d="M52 42q-1-11 10-14 12-1 15 10l-5 11-16 1z" fill="' + accent + '"/><path d="M58 39q2-7 8-7 7 2 7 9-5 5-12 3z" fill="#f0c9a0"/><path d="M69 38q2 1 2 2" fill="none" stroke="#342c28" stroke-width="1.7"/><path d="M53 42q7-9 15-7l7 5-4-10q-8-5-15 0-5 4-3 12z" fill="' + accent + '"/><path d="M61 30q4-3 9 0" fill="none" stroke="#f6d796" stroke-width="1.8"/>' +
      // Tiny clasp and pack add hand-finished miniature detail.
      '<path d="m59 47 3 3 3-3" fill="none" stroke="#f3cc77" stroke-width="1.8"/><path d="M77 48q4 0 5 4l-3 5-4-3z" fill="#426858"/><path d="M79 50v4" fill="none" stroke="#9ab28d" stroke-width="1.2"/>' +
      '</g>';
  }

  function riderSVG(animal, color, name, size) {
    const key = String(animal || '').toLowerCase();
    const details = species[key] || species.fox;
    const accent = validColor(color);
    const dimension = sizeValue(size);
    const title = name == null || name === '' ? '' : '<title>' + escapeXml(name) + '</title>';
    const aria = title ? ' role="img" aria-label="' + escapeXml(name) + '"' : ' aria-hidden="true" focusable="false"';
    const animalLegs = key === 'rabbit'
      ? '<g stroke="#342c28" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M46 66q-2 6-7 10l-5 3q-2 2 1 3h13q4-2 3-7l3-8M67 64l4 10-2 5q-1 2 2 3h10q2-2-1-4l-4-4-1-11" fill="' + details.dark + '"/><path d="M81 63 83 77l-2 5q0 2 3 2h8q2-2-1-4l-3-4-1-14M98 58l5 13-1 6 2 5q2 1 8 0 2-1-1-3l-4-3-4-18" fill="' + details.body + '"/></g>'
      : legs(details.body, details.dark);
    const outlineBody = key === 'bear'
      ? '<path d="M35 56q1-13 13-17 8-3 18 0 14 1 19 12 8 0 14 6l-3 12q-5 5-15 4H48q-14-1-16-9z" fill="' + details.body + '" stroke="#342c28" stroke-width="2.7" stroke-linejoin="round"/>'
      : key === 'rabbit'
        ? '<path d="M39 61q4-13 18-15 10-1 17 6 6-4 13-3 12 2 15 12-2 11-13 12H51q-12-1-15-6z" fill="' + details.body + '" stroke="#342c28" stroke-width="2.7" stroke-linejoin="round"/>'
        : key === 'deer'
          ? '<path d="M36 59q4-10 18-12 14-2 25 1 10 2 16 7l9 5-2 9q-7 5-19 4H48q-12-1-14-7z" fill="' + details.body + '" stroke="#342c28" stroke-width="2.7" stroke-linejoin="round"/>'
          : key === 'boar'
            ? '<path d="M34 56q4-12 19-15 17-3 29 4 9 1 17 6l8 8-3 12q-7 4-19 3H49q-16-1-17-9z" fill="' + details.body + '" stroke="#342c28" stroke-width="2.7" stroke-linejoin="round"/>'
            : '<path d="M34 57q6-12 20-14 15-3 28 2 10 2 17 8l8 6-3 11q-7 4-18 3H48q-14-1-16-8z" fill="' + details.body + '" stroke="#342c28" stroke-width="2.7" stroke-linejoin="round"/>';
    const shadowPath = key === 'bear' ? '<path d="M39 66q20 8 52-1l-2 7q-9 5-41 1-8-1-9-7z" fill="' + details.dark + '" opacity=".48"/>' : '<path d="M42 67q22 8 55-1l-2 7q-9 4-43 2-8-1-10-8z" fill="' + details.dark + '" opacity=".42"/>';
    const upper = key === 'boar'
      ? '<path d="M40 46q5-8 10-3 5-9 10-2 5-8 10-1 5-7 10-1" fill="none" stroke="#d1a072" stroke-width="3.8" stroke-linecap="round"/>'
      : key === 'deer'
        ? '<path d="M43 51q2-4 5-2m7-3q2-4 5-2m6 3q2-4 5-2m6 3q2-3 4-1" fill="none" stroke="#f3dfb9" stroke-width="2" stroke-linecap="round"/>'
        : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + dimension + '" height="' + dimension + '" viewBox="0 0 128 96"' + aria + '>' + title +
      '<ellipse cx="68" cy="85" rx="47" ry="5" fill="#342c28" opacity=".14"/>' +
      details.tail + animalLegs + outlineBody + shadowPath +
      '<path d="M42 55q13-8 32-3 10 2 19 10-8 6-18 6H47q-8-1-11-6z" fill="' + details.light + '" opacity=".62"/>' +
      upper + details.markings + details.backEar +
      '<path d="M68 48q5-3 9 0" fill="none" stroke="#342c28" stroke-width="1.8" stroke-linecap="round"/>' + details.head +
      rider(accent) +
      // A tiny pale ground stroke helps the hooves stay legible against dark map tiles.
      '<path d="M31 85h75" stroke="#f7eedb" stroke-width="1.4" opacity=".72" stroke-linecap="round"/>' +
      '</svg>';
  }

  const icons = {
    footsteps: '<path d="M7 5c2-1 4 2 4 5 0 2-1 3-2 3S6 11 6 9s0-3 1-4zm8 7c2-1 4 1 4 4 0 2-1 3-2 3s-3-2-3-4 0-2 1-3zM5 17c2-1 4 1 4 3 0 1-1 2-2 2s-3-1-3-3 0-2 1-2zm10 2c2-1 4 0 4 2 0 1-1 2-2 2s-3-1-3-2 0-2 1-2z"/>',
    flag: '<path d="M6 22V3m1 1q6-3 11 0v8q-5-3-11 0" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 5q5-2 10 0v5q-5-2-10 0z"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke-width="2.2"/><circle cx="12" cy="15" r="1.5" fill="#f7eedb"/><path d="M12 16v2" stroke="#f7eedb" stroke-width="1.5"/>',
    compass: '<circle cx="12" cy="12" r="9" fill="none" stroke-width="1.8"/><path d="m15.8 7.6-2.3 6.1-5.3 2.7 2.3-6.2z"/><circle cx="12" cy="12" r="1.4"/>',
    squats: '<path d="M8 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM10 9l4 2 2 4-3 1-2-3-3-1-1 5 6 2 3 3h3l-1-5-5-3" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m8 10-3 4 2 2m6 2-2 3" fill="none" stroke-width="2" stroke-linecap="round"/>',
    running: '<circle cx="14" cy="4.5" r="2"/><path d="m11 8-4 4 4 2 2 4-3 4m2-10 4 1 3 3m-7-8 3 3-2 4-4 2" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    dice: '<path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><circle cx="8" cy="8" r="1.3" fill="#f7eedb"/><circle cx="16" cy="8" r="1.3" fill="#f7eedb"/><circle cx="12" cy="12" r="1.3" fill="#f7eedb"/><circle cx="8" cy="16" r="1.3" fill="#f7eedb"/><circle cx="16" cy="16" r="1.3" fill="#f7eedb"/>',
    shield: '<path d="M12 3 20 6v5q0 6-8 10-8-4-8-10V6z"/><path d="m8 12 2.5 2.5 5-5" fill="none" stroke="#f7eedb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
  };

  function iconSVG(name) {
    const key = String(name || '').toLowerCase();
    const shape = icons[key];
    if (!shape) return '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" role="img" aria-label="' + escapeXml(key) + '" fill="#426858" stroke="#342c28" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><title>' + escapeXml(key) + '</title>' + shape + '</svg>';
  }

  return { riderSVG: riderSVG, iconSVG: iconSVG };
});
