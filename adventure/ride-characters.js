/* Native game sprites: same ink, flat palette and rounded outlines as the bosses. */
(() => {
 'use strict';
 const ink='#342c28';
 const sceneSVG=`<svg viewBox="0 0 1000 430" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <circle cx="746" cy="106" r="93" fill="#fff7d5" opacity=".7"/>
  <path d="M0 294 116 121 222 267 354 78 515 277 649 113 783 282 915 91 1000 239V430H0Z" fill="#b6c0a0"/>
  <path d="m287 162 67-84 67 83-48-25-23 16-26-18Z" fill="#f6efd9"/><path d="m865 155 50-64 43 70-38-21-17 10-15-10Z" fill="#f6efd9"/>
  <path d="M0 355 151 243 304 337 489 199 676 346 829 216 1000 332V430H0Z" fill="#94a77f"/>
  <path d="M0 382Q244 307 514 372T1000 353V430H0Z" fill="#bfc796"/>
  <path d="M410 430Q446 383 626 362T734 318Q655 320 612 343T373 392L280 430Z" fill="#ead5a1"/>
  <path d="M0 412Q290 357 483 402T1000 385V430H0Z" fill="#aab887"/>
  <g fill="#657d57"><path d="m25 347 41-94 40 94H83l30 35H18l29-35ZM830 341l34-82 36 82h-20l26 32h-84l25-32Z"/><path d="m133 322 22-55 25 55h-13l19 23h-60l18-23Z"/></g>
  <g fill="#e4b26a"><ellipse cx="912" cy="386" rx="20" ry="6"/><ellipse cx="78" cy="400" rx="11" ry="4"/></g>
 </svg>`;
 const charactersSVG=`<svg viewBox="0 0 340 230" fill="none" role="img" aria-label="En skum gubbe i krokig hatt och hans lila, hornprydda skjutsvarelse">
 <g stroke="${ink}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
  <ellipse cx="202" cy="216" rx="132" ry="9" fill="${ink}" opacity=".13" stroke="none"/>
  <!-- The peculiar creature, with paws, horns, empty saddle and bags. -->
  <path d="m269 132 14 27 7 35 16 6q8 7-1 11h-32l-9-27-16-24" fill="#70516d"/>
  <path d="m213 148-7 36-8 14-9 5q-7 8 1 9h29l12-29 11-25" fill="#70516d"/>
  <path d="M298 125q29 5 32-12 8 25-18 35l-18-3" fill="#9d788a"/>
  <path d="M191 103q31-28 75-11 43 14 44 50-1 29-34 36-48 12-77-13-28-22-8-62Z" fill="#92718b"/>
  <path d="M206 153q29 18 66 8 22-6 28-20-3 27-29 31-42 8-65-8Z" fill="#70516d" stroke="none"/>
  <path d="M196 144q-5 28-20 48l-12 7q-8 10 2 12h29l21-34 10-23" fill="#a17c91"/>
  <path d="m255 156 5 37-9 9q-6 8 4 10h30l-7-19-2-37" fill="#92718b"/>
  <path d="m167 207 5-6m12 8 3-7m71 6 4-7m11 8 2-6" stroke="#dfb671" stroke-width="2"/>
  <path d="M235 92q7 28-5 63l39 9q18-26 9-56Z" fill="#e2b168"/>
  <path d="m245 99 8 4-6 10 10 5-8 10 10 5-8 10 11 7" stroke="#a96e40" stroke-width="2"/>
  <path d="M228 95q20-14 48 4l-1 14q-23-10-46-4Z" fill="#684635"/>
  <path d="M225 93q0-12 12-11h24q12 2 14 14-19 9-50-3Z" fill="#b87b48"/>
  <path d="M232 87q14 5 28 2" stroke="#e2b168" stroke-width="2"/>
  <path d="m281 114 17 1 4 28q-7 11-23 2Z" fill="#94663f"/><path d="m280 126 20 1m-10-7v15" stroke="#d9aa62" stroke-width="2"/>
  <path d="M196 58q-5-25 10-31 15-5 18 9-12-4-13 9l7 18" fill="#dfc397"/>
  <path d="M255 54q11-27 26-17 14 11-2 22-2-12-11-6l-4 12" fill="#dfc397"/>
  <path d="m191 78-18-11 4 24 20 6m60-20 18-9-3 23-15 7" fill="#92718b"/>
  <path d="m181 77 4 10m79-3 3-7" stroke="#d2a194" stroke-width="3"/>
  <path d="M197 53q23-12 44 0l15 10 7 27-10 36-18 14-20-6-24-18-9-27 5-23Z" fill="#a58096"/>
  <path d="M194 54 209 45l8 8 15-9 9 13 14-1-2 17-16-8-13 7-13-8-18 9Z" fill="#92718b"/>
  <path d="M192 78q13-13 24 1l-2 15q-15 7-23-5Z" fill="#f3e3bc"/>
  <path d="M232 79q11-13 23-1l1 13q-11 9-24 1Z" fill="#f3e3bc"/>
  <ellipse cx="208" cy="84" rx="3.5" ry="5.5" fill="${ink}" stroke="none"/><ellipse cx="243" cy="84" rx="3.5" ry="5.5" fill="${ink}" stroke="none"/>
  <path d="m196 70 16-3m22 0 17 3" stroke-width="4"/>
  <path d="M207 96q18-10 35 0l-3 15-15 11-14-10Z" fill="#e5a14f"/>
  <path d="m210 100 14 6 15-6m-15 6v8" stroke="#975d37" stroke-width="2"/>
  <path d="m194 108 7 10 4-5 8 13 7-4 8 12 9-9 6 4 7-14 7-3" fill="#e5cba1"/>
  <path d="m193 139 8 4m-5 7 8 4m73-12 8-2m-11 11 8-1" stroke="#c6a0ad" stroke-width="3"/>
  <!-- The stranger: full body, warm flat colours, face readable at pawn size. -->
  <path d="m106 159-8 32-7 14-17 2q-7 7 2 9h31l14-49m18-10 7 32 13 18q9 7 1 10h-31l-15-29" fill="#6a4a37"/>
  <path d="M92 203h16m24 3h19" stroke="#c69760" stroke-width="2"/>
  <path d="M101 87q23-13 43 0l13 35-1 37 8 29-31 2-12-20-11 20-27-4 11-37-6-33Z" fill="#537b6c"/>
  <path d="m109 96 9 12-13 77-16-2 10-42-2-30Z" fill="#6d9680" stroke="none"/>
  <path d="m132 95-9 16 9 77 26-2-9-46 2-24Z" fill="#3d6055" stroke="none"/>
  <path d="m111 103 10 65 14-67" fill="#ceaa72"/><path d="m121 110 2 49" stroke="#8c6843" stroke-width="2"/>
  <path d="m142 116 22 8 16-7 5 10-22 13-26-11" fill="#537b6c"/>
  <path d="m174 117 10-7 9 1 2 6-8 4 4 5-5 6-10-5Z" fill="#ddb68a"/>
  <path d="m98 107-20 16-17-4-4 12 23 9 31-19" fill="#537b6c"/>
  <path d="m61 118-11-7-12-1-2 6 11 5-14 3q-6 4 0 8l23 3 10-6Z" fill="#ddb68a"/>
  <path d="m44 126 13 2m-7-12 8 6" stroke="#ad805d" stroke-width="1.8"/>
  <path d="M100 85q19 18 43-1l-4 19-19 10-20-10Z" fill="#b06343"/>
  <path d="m111 98 7 9-9 21 13-3 7-21" fill="#cc8b5b"/>
  <path d="M98 57q13-14 33-8 18 4 19 24l-9 22-19 5-20-12-9-16Z" fill="#e0ba8e"/>
  <path d="m98 61-7-4-3 13 12 5m44-12 10-6 2 12-10 7" fill="#e0ba8e"/>
  <path d="M99 60q-12 8-4 25l6-4-2 11 10-4-2 13 13-6 8 7 10-13 8 3 4-17-9 6-2-10-15 13-14-7-8 4Z" fill="#ded8bb"/>
  <path d="m102 63 10-5m19 2 11 4" stroke="#72513b" stroke-width="3.5"/>
  <circle cx="109" cy="67" r="2.2" fill="${ink}" stroke="none"/><circle cx="135" cy="68" r="2.2" fill="${ink}" stroke="none"/>
  <path d="m121 66-7 11 9 3" fill="#e7c59d" stroke-width="2"/>
  <path d="m113 85 7 3 11-4" stroke="#88654a" stroke-width="2"/>
  <path d="M89 54q18-12 55-5l15 7q-24 10-70 6l-12-5Z" fill="#b99459"/>
  <path d="m99 50 10-30 18-7 5 17 20 5-12 18q-20 5-41-3Z" fill="#6f7753"/>
  <path d="m109 24 11-4 7 16 18 2-8 8" fill="#8b9266" stroke="none"/>
  <path d="m101 43 36 4 7-8" stroke="#684635" stroke-width="6"/>
  <path d="m136 37 11-20 9 2-8 8-2 11" fill="#d19358" stroke-width="2"/>
  <path d="m102 140 37 1-1 7-38-1Z" fill="#684635"/><rect x="116" y="139" width="12" height="11" rx="2" fill="#d9a34b" stroke-width="2"/>
  <path d="m141 145 14 2 1 22-18 3-2-21Z" fill="#a97748"/><path d="m140 150 14 2m-10 6h5" stroke="#d6b07b" stroke-width="2"/>
  <path d="M58 214h99m31 0h124" stroke="#fff4d7" stroke-width="2" opacity=".7"/>
 </g></svg>`;
 window.AdventureRideArt=Object.freeze({sceneSVG,charactersSVG});
})();
