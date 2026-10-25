(function attachBossSprites(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AdventureBosses = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function makeBossSprites() {
  'use strict';
  const INK = '#342c28';
  const escapeXml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const shadow = '<ellipse cx="83" cy="135" rx="54" ry="5" fill="#342c28" opacity=".15"/><path d="M32 137h105" stroke="#f7eedb" stroke-width="1.5" opacity=".75"/>';
  function goblet(x, y, fill, stem = true) {
    return `<g transform="translate(${x} ${y})"><path d="M-8-16h16L6-4Q0 3-6-4Z" fill="#f7eedb" stroke="${INK}" stroke-width="2.2"/><path d="M-6-11H6L4-5Q0-1-4-5Z" fill="${fill}" stroke="none"/>${stem ? `<path d="M0 0v11m-6 0H6" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>` : ''}<path d="M-5-14v4" stroke="#fffaf0" stroke-width="1.5" stroke-linecap="round"/></g>`;
  }
  const ART = Object.freeze({
    troll: `
      <path d="M48 76 38 109l1 18 18 2 8-25m35-27 16 32 2 18-22 2-13-27" fill="#6f8751"/>
      <path d="m36 123-7 7q-2 5 6 5h26l-1-12m35 0-3 11h29q7 0 4-5l-8-7" fill="#72513a"/>
      <path d="M44 47Q57 32 81 38q28-2 35 23l7 28q-7 28-37 29-35-2-47-24Z" fill="#869c57"/>
      <path d="M46 77q4 29 35 30 27 1 35-19l-2 17q-15 19-42 11-25-7-31-24Z" fill="#627b43" stroke="none"/>
      <path d="M60 88q20-13 39 0l-3 12q-17 7-33-1Z" fill="#a8b16c" stroke="none"/>
      <path d="M41 46q-14 1-15 13l8 16 17-4 8-15Z" fill="#96703f"/><path d="m33 48 10 23m-2-26 11 20M26 58l28-7m-22 18 25-8" stroke="#5d4732" stroke-width="2"/>
      <path d="M111 47q15 1 16 16l-12 13-15-9-2-14Z" fill="#96703f"/><path d="m113 49-9 21m17-15-8 18m-14-18 25 9" stroke="#5d4732" stroke-width="2"/>
      <path d="M43 61 31 76 14 75l-4 11 23 9 23-18" fill="#869c57"/>
      <path d="M112 66q13 8 13 24l-9 10-9-7 2-18" fill="#869c57"/>
      <path d="m51 31-12-6 4 16 14 4m43-13 12-7-2 18-12 4" fill="#869c57"/>
      <path d="M52 20q18-14 41-2 13 9 10 29-6 19-30 17-24-2-28-22Z" fill="#96aa65"/>
      <path d="M49 24q-3-13 11-16l5 5 10-9 7 8 13-4 6 17-13-3-10 5-11-4-10 6Z" fill="#4c7042"/>
      <path d="M49 16q-7-7-2-10 7-3 11 4l-4 7Z" fill="#d59047"/><path d="M49 15v7" stroke="#efe3ba" stroke-width="3"/>
      <path d="m58 35 10-3m17-1 10 5" stroke="#4d6338" stroke-width="4"/>
      <circle cx="64" cy="37" r="2.2" fill="${INK}" stroke="none"/><circle cx="89" cy="38" r="2.2" fill="${INK}" stroke="none"/>
      <path d="M65 42q-5 9 6 10h11q7-2 2-8" fill="#aebb73"/>
      <path d="M59 53q15 11 32-1" fill="none"/><path d="m63 53 1 8 6-5m14-1 4 5 1-9" fill="#fff0cb" stroke-width="1.7"/>
      <path d="M51 106q29 8 61-1l-1 8q-26 8-60 0Z" fill="#765236"/><rect x="77" y="106" width="14" height="10" rx="2" fill="#d3a24f" stroke-width="2"/>
      <g transform="translate(16 77)"><path d="M-8-15H9V6q-9 5-17-1Z" fill="#b7874b"/><path d="M9-10q14-3 14 7T9 6" fill="none" stroke-width="4"/><path d="M-4-12V2m7-14V2" stroke="#7b5635" stroke-width="1.5"/><path d="M-10-14q-1-8 6-6 4-8 10-2 10-2 8 8Z" fill="#fff3d3" stroke-width="2"/></g>`,
    witch: `
      <path d="M70 112 62 128l-11 3q-6 4 0 5h23l8-20m15-6 6 20 15 1q5 3 0 5H97l-12-20" fill="#63483e"/>
      <path d="M59 48q20-14 41 2l8 34 16 35q-44 16-79 0l13-36Z" fill="#813d58"/>
      <path d="M79 56q-14 35-26 62 18 9 34 6-12-32-8-68" fill="#aa5b70" stroke="none"/>
      <path d="M93 55q4 42 25 63l-16 3q-14-27-17-56" fill="#5d344a" stroke="none"/>
      <path d="M63 56 46 70 30 68l-5 11 24 6 24-17" fill="#b26a7b"/>
      <path d="M101 55q17 3 21 26l-9 9-9-8-7-17" fill="#8d475e"/>
      <path d="M25 69q-11 0-11 6 1 7 14 6l6-7Z" fill="#ddb78b"/>
      <path d="m60 27-18-6 6 15 16 7m33-15 17-5-5 16-14 5" fill="#d4ae83"/>
      <path d="M59 18q18-10 33 1 13 11 6 28-7 15-24 14-19-3-22-18Z" fill="#e0ba8e"/>
      <path d="M54 22q-4 16 2 25l-8 4q-8-16 2-31 9-17 29-14 20-1 28 18-11-2-16-10-11 11-37 8Z" fill="#6d4636"/>
      <path d="m57 32 10-3m15 1 9 3" stroke="#5d3c33" stroke-width="2.5"/>
      <circle cx="63" cy="35" r="1.9" fill="${INK}" stroke="none"/><circle cx="86" cy="36" r="1.9" fill="${INK}" stroke="none"/>
      <path d="m67 39-7 6 10 2m1 5q10 4 17-3" fill="none" stroke-width="2"/>
      <path d="M51 17q27-17 51 1" fill="none" stroke="#5b7040" stroke-width="5"/>
      <g fill="#6e4b75" stroke-width="1.6"><circle cx="52" cy="17" r="5"/><circle cx="58" cy="13" r="5"/><circle cx="59" cy="21" r="5"/><circle cx="95" cy="15" r="5"/><circle cx="101" cy="20" r="5"/></g>
      <path d="M65 11 69 1l9 9m7 2 7-11 5 13" fill="#6c854b"/>
      <path d="M64 75q19 9 39 0l1 7q-21 9-41 0Z" fill="#d0a550"/><circle cx="81" cy="79" r="4" fill="#eee1b3" stroke-width="1.5"/>
      ${goblet(20, 70, '#8d3f58')}`,
    dragon: `
      <path d="M110 87q32-11 32-36 15 36-12 55l-18 8" fill="#a45535"/><path d="m139 55 7-9 5 10-10 5" fill="#dca856"/>
      <path d="M97 56 116 21l17 24 13 25-29-8 1 26-18-13" fill="#c27743"/><path d="m114 29-7 26 23-7-18 12 25 6" fill="#e8ab62" stroke-width="1.8"/>
      <path d="M62 60 36 30l-8 33 22-6-3 25 20-9" fill="#b9673a"/>
      <path d="M65 85 55 116l-7 11q-4 7 3 8h25l6-29m20-15 11 28 13 10q4 6-3 6H98l-8-26" fill="#bc6738"/>
      <path d="M51 132h17m35 0h16" stroke="#f5ddb4" stroke-width="3"/>
      <path d="M60 48q29-15 44 8l15 36q-3 26-31 27-30 0-36-26Z" fill="#cf7b42"/>
      <path d="M79 63q18-9 24 10l7 23q-8 22-30 16-16-10-7-33Z" fill="#e9b56c"/>
      <path d="M79 81h23m-27 11h31m-28 11h24" fill="none" stroke="#bf8d50" stroke-width="2"/>
      <path d="M58 61 42 77l-17-3-3 11 22 10 26-20" fill="#cf7b42"/>
      <path d="M102 65q12 6 17 17l-10 8-10-16" fill="#cf7b42"/>
      <path d="M58 21q20-13 39 1l9 23-18 17-25-6-17-10-18-2q-9-4-5-12l21-3Z" fill="#cf7b42"/>
      <path d="m41 38-17-2 2 7 28 6" fill="#e9b56c" stroke-width="2"/>
      <path d="m51 18 1-13 13 14m24-1 11-13-2 23" fill="#e7c88b"/>
      <path d="M55 27q8-5 14 0" fill="none" stroke-width="3"/><circle cx="60" cy="31" r="2.5" fill="${INK}" stroke="none"/>
      <path d="M25 42q16 8 31 4m-16 2 3 7 4-7" fill="#fff0d0" stroke-width="1.8"/>
      <path d="m91 29 12-3-3 13 10 1-7 12" fill="#a95033" stroke-width="2"/>
      <path d="M56 105q28 8 56-1" fill="none" stroke="#79553b" stroke-width="6"/>
      <g transform="translate(24 76)"><path d="M-5-11H4v13q-6 5-11 0Z" fill="#f5dcad" stroke-width="2"/><path d="M-5-6h7v7h-7Z" fill="#d69242" stroke="none"/><path d="m-7-15 3-4m9 0 3 4" stroke="#e7bb6f" stroke-width="2"/></g>`,
    sphinx: `
      <path d="M69 112 63 129l-14 1q-5 4 1 5h26l7-21m11-2 5 16 13 3q5 4-1 4H91l-6-18" fill="#564139"/>
      <path d="M63 50q21-12 39 2l9 44 14 24q-36 15-76 0l12-26Z" fill="#627852"/>
      <path d="M71 64q-4 31-16 54l20 6q7-29 9-57" fill="#8da375" stroke="none"/>
      <path d="m98 63 17 55-12 4-13-50" fill="#496248" stroke="none"/>
      <path d="M64 55 45 72l-11-1-3 11 18 8 26-23" fill="#769362"/>
      <path d="M102 58q15 4 17 24l-8 11-9-11-4-13" fill="#627852"/>
      <path d="M31 72q-10-1-10 5 2 7 13 5l5-6Z" fill="#edc8a1"/>
      <path d="M59 29q20-15 35 1 10 11 2 25-8 11-24 5-17-6-19-16Z" fill="#edc8a1"/>
      <path d="M58 32q-7 5-4 21l-9 1q-10-24 9-32 27-12 45 11l-8 6-8-9q-7 7-25 2Z" fill="#cbb079"/>
      <path d="M47 25 70 2q6-5 11 2l18 23 15 7q-34 13-69-1l-11-5Z" fill="#586f4d"/>
      <path d="m61 17 27 1 6 9q-17 5-36-1Z" fill="#d4a34d" stroke-width="2"/>
      <path d="M64 38h2m16 0h2" stroke-width="3"/><path d="m66 43-6 6 11 1m2 5q8 2 13-3" fill="none" stroke-width="2"/>
      <path d="M65 80q17 6 38-1" stroke="#d3af66" stroke-width="5"/>
      <path d="M23 47v85" stroke="#86623f" stroke-width="4"/>
      <path d="m23 31 5 11-5 8-5-8Z" fill="#f4d78d" stroke-width="2"/>
      <path d="m17 26-3-6m16 5 4-6m-11 1v-7" fill="none" stroke="#c7a054" stroke-width="2"/>
      <g fill="#f8e3a3" stroke="#c29c50" stroke-width="1.7"><circle cx="36" cy="48" r="4"/><circle cx="13" cy="57" r="3"/><circle cx="36" cy="35" r="2.5"/></g>`,
    // Retain the original boss ID so existing local saves keep their progress.
    kraken: `
      <path d="M67 89q-20-5-24 10-3 10 13 17l15-7m21-19q19-4 26 10 5 10-13 18l-13-10" fill="#afb29c"/>
      <path d="m57 108-9 14-12 6q-7 5 1 7h25l12-18m26-10 10 16 13 5q7 5-1 7H99l-13-19" fill="#c3c5ad"/>
      <path d="M42 132h12m54 0h12" stroke="#89947f" stroke-width="1.7"/>
      <path d="M76 67q-14 9-14 24 3 17 20 21 20-1 22-20-2-16-14-25Z" fill="#c3c5ad"/>
      <path d="M88 74q7 12 5 22l-8 8 11 1q12-12 4-26Z" fill="#a2aa94" stroke="none"/>
      <path d="M73 80q5 4 13 3m-15 4q7 5 16 3m-13 5q5 3 11 2" fill="none" stroke="#939e87" stroke-width="1.5"/>
      <path d="M65 96q16 8 35-1l4 13-13-2-7 10-7-8-13 4Z" fill="#77614d"/>
      <path d="m72 100 5 7m13-8-3 8m10-7 3 5" stroke="#a08a68" stroke-width="1.6"/>
      <path d="M66 76q-13 7-19 7l-14-9-7 4 5 9 18 8 20-8" fill="#c3c5ad"/>
      <path d="M32 77q-9-7-14-1l-3 8 7 6 11-3 2-8m-14 0-3 6m8-5-3 7m9-5-3 5" fill="#c3c5ad" stroke-width="2"/>
      <path d="M95 76q19 8 20 25l-2 14 13 5 6 10-7 2-5-5-8 1-8-7 2-21-14-12" fill="#c3c5ad"/>
      <path d="m114 122 1 7m7-5 2 7m-17-11-1 7" stroke-width="1.6"/>
      <path d="M76 66v11q8 5 15-3l-3-10" fill="#c3c5ad"/>
      <path d="m56 28-20-12 4 23 17 12m43-23 22-13-5 24-17 12" fill="#b2b69e"/>
      <path d="m43 25 11 13m59-12-11 13" stroke="#8f9983" stroke-width="1.7"/>
      <path d="M57 18q20-16 40 0 14 12 10 31-5 21-24 24-21-2-30-21-8-20 4-34Z" fill="#c8c9b1"/>
      <path d="M98 24q10 19-2 35l-12 11q19 1 24-22 2-16-10-24" fill="#aab19a" stroke="none"/>
      <path d="M60 14q-7-9-1-12m13 7q-4-9 1-9m10 8q4-9 9-7m4 14q7-7 11-4" fill="none" stroke="#565a4b" stroke-width="1.5"/>
      <ellipse cx="66" cy="37" rx="10" ry="11" fill="#f5efda" stroke-width="2"/>
      <ellipse cx="92" cy="38" rx="10" ry="11" fill="#f5efda" stroke-width="2"/>
      <ellipse cx="68" cy="39" rx="5" ry="6.5" fill="#86aeb2" stroke-width="1.2"/>
      <ellipse cx="90" cy="40" rx="5" ry="6.5" fill="#86aeb2" stroke-width="1.2"/>
      <ellipse cx="69" cy="40" rx="2.3" ry="4" fill="${INK}" stroke="none"/><ellipse cx="89" cy="41" rx="2.3" ry="4" fill="${INK}" stroke="none"/>
      <circle cx="66" cy="36" r="1.8" fill="#fffaf0" stroke="none"/><circle cx="88" cy="37" r="1.8" fill="#fffaf0" stroke="none"/>
      <path d="M57 25q10-6 17 0m11 0q9-4 15 3" fill="none" stroke="#8e9981" stroke-width="2.2"/>
      <path d="m79 39-7 13 10 3 5-5" fill="#bac1a7" stroke-width="1.7"/>
      <path d="M65 58q18 13 34-3-8 18-24 13Z" fill="#655148" stroke-width="1.8"/>
      <path d="m70 61 2 5 4-3m11-1 3 3 1-5" fill="#f3e8c9" stroke-width="1.2"/>
      <path d="m57 49 7 5m33-3-5 4m-31-1 3 2" stroke="#909b85" stroke-width="1.4"/>
      ${goblet(22, 72, '#a34c57')}`,
    final: `
      <path d="M52 48q29-16 58 4l18 69-17 9-21-7-19 7-30-8Z" fill="#345846"/>
      <path d="M56 61 45 118l22 6 14-61m21 0 17 57-19 4-14-62" fill="#4d7153" stroke="none"/>
      <path d="m65 109-8 20-12 2q-4 5 2 5h29l7-23m17-4 5 20 15 3q4 4-2 4H93l-8-23" fill="#60483b"/>
      <path d="M60 49q24-13 43 3l9 56q-25 15-55-1Z" fill="#7f6650"/>
      <path d="M64 58q20-9 36 0l6 41q-22 12-44-1Z" fill="#b39561"/>
      <path d="M55 50 68 62l-7 10-15-13m58-11-15 14 10 10 18-14" fill="#e5d5af"/>
      <path d="M59 65 40 80l-14-2-4 12 24 8 23-18" fill="#b49769"/>
      <path d="M106 67q17 9 16 25l-12 8-8-18" fill="#b49769"/>
      <path d="M60 23q20-12 36 2 10 11 3 28L82 68 63 57q-13-12-9-25Z" fill="#dbb38b"/>
      <path d="M53 34q-7 15 8 29l9 9 7-6 7 8 12-10 9-17-8-5q-1 15-13 13-15 1-16-15Z" fill="#d5c5a1"/>
      <path d="M58 34 70 32m13 0 10 4" stroke="#82705a" stroke-width="3"/>
      <path d="m63 37 4 1m19 0 4 1" stroke-width="2.5"/>
      <path d="M70 41q-7 8 5 10h8" fill="#dba77b" stroke-width="2"/>
      <path d="m69 57 5 6m10-5-1 7m8-10-3 6" stroke="#b4a485" stroke-width="1.6"/>
      <path d="M54 22 51 7l15 6 11-12 9 13 17-7-2 17Z" fill="#d5aa54"/>
      <path d="M54 21q22-5 45 0v7q-22 5-45 0Z" fill="#be8a3d"/>
      <g fill="#f0d68d" stroke-width="1.5"><circle cx="54" cy="6" r="3"/><circle cx="77" cy="3" r="3"/><circle cx="102" cy="6" r="3"/></g>
      <path d="m75 20 4-5 5 5-5 6Z" fill="#537b64" stroke-width="1.5"/>
      <path d="M59 101q25 6 50-1" stroke="#60483b" stroke-width="6"/><circle cx="86" cy="102" r="10" fill="#d6ab58" stroke-width="2"/><circle cx="86" cy="102" r="6" fill="#f4e6bd" stroke-width="1.3"/><path d="M86 98v5l3 2" stroke-width="1.5"/>
      <g transform="translate(22 81)"><path d="M-8-12H8L6 5q-6 4-12 0Z" fill="#f4e1b9" stroke-width="2"/><path d="M-6-5H6L4 3q-4 2-8 0Z" fill="#c2873b" stroke="none"/><path d="m-4-10-1 5" stroke="#fff7df" stroke-width="1.5"/></g>`,
  });
  function bossSVG(id, name, size = 300) {
    const key = Object.hasOwn(ART, id) ? id : 'troll';
    const dimension = Number.isFinite(Number(size)) && Number(size) >= 16 && Number(size) <= 512 ? Number(size) : 300;
    const a11y = name ? `role="img" aria-label="${escapeXml(name)}"` : 'aria-hidden="true" focusable="false"';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension * .9}" viewBox="0 0 160 144" data-boss-sprite="${key}" ${a11y}>${name ? '<title>' + escapeXml(name) + '</title>' : ''}${shadow}<g fill="none" stroke="${INK}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">${ART[key]}</g></svg>`;
  }
  return Object.freeze({ bossSVG });
}));
