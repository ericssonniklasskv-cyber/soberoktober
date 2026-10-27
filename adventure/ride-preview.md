# Ruta 28 — En mycket märklig skjuts

Separat designpreview: `/adventure/ride-preview.html`, lokalt `http://localhost:3002/adventure/ride-preview.html` med `npm run dev:adventure`.

Ja tack: pjäsen flyttas från 28 till 29 och får ett utomordentligt trevligt samtal med gubben. Nej tack: pjäsen stannar på 28 och gubben ropar sitt tveksamma livsråd efter spelaren. Stäng/Escape flyttar inte pjäsen. Previewen har ett återställningsverktyg för att prova båda valen och alla fem personliga pjäser samt standardräven.

Ingen anslutning till konton, databas eller spel-API. Inga poäng eller riktig spelprogress ändras. Inget ljud. Inga skrivningar till localStorage eller sessionStorage. Allt återställs vid ny sidladdning. En framtida liveintegration behöver beständig servervalidering av engångsvalet, precis som ruta 21.

## Illustration

Skapad med det inbyggda imagegen-verktyget. Inga personbilder skickades till bildverktyget; befintliga spelarpjäser visas separat ovanpå miljön i webbläsaren.

Projektfil: `adventure/assets/strange-traveller.webp` (1200 × 800, 340 552 byte).
Original: `/Users/niklasericsson/.codex/generated_images/01a10806-81e6-7f62-8a53-048670f520a2/exec-99359325-7381-4a3b-9335-8ff58157285c.png`.

Prompt:

> Use case: illustration-story. Asset type: wide encounter illustration for a hidden bonus popup at tile 28 in the Swedish fantasy board game Frestelsernas rike. Primary request: an eccentric slightly shady but amusing adult old traveller standing next to a very peculiar rideable fantasy beast, offering a lift to the player. Scene/backdrop: a sunlit mountain trail in a classic rich high fantasy world, pale rocky crags, winding cream-colored path, distant dramatic mountains, patches of green moss, ferns and golden autumn shrubs. Subject: the old man has a wonderfully expressive lined face, a scruffy silver beard, crooked eyebrows, a sly friendly grin, a battered floppy hat and a weathered teal-brown travelling coat; one hand lifted in welcoming invitation, the other on the beast's reins. Beside him stands a stout comically charming fantasy pack animal: a shaggy plum-colored owl-bear-like creature with a broad orange ducklike beak, little curled ram horns, huge soft paws and kind curious amber eyes; it has an empty leather saddle and travel bags, clearly large enough to carry someone. Style/medium: polished painterly high fantasy game key art, rich readable shapes, warm golden light, detailed believable faces and materials, Warcraft / Tolkien adventure atmosphere with whimsical humour, not flat vector or pixel art. Composition: landscape 3:2; arrange man and creature as a compact full-body group in the RIGHT 55 percent of the image, facing and gesturing toward the left. Keep their faces and animal's entire head within the center-right safe region, keep the top 12 percent open for a small interface badge, leave the lower-left foreground an empty stretch of path for a separate personal player pawn that will be composited by the app. Warm parchment cream, forest and sage greens, copper highlights and muted plum. Welcoming mysterious, playful, adults-only fantasy encounter. No actual player, no children, no existing recognizable characters, no text, no lettering, no UI, no speech bubbles, no watermarks.

## Verifierat

Chrome vid 320/390/768/1440 px: båda valen, 28 → 29 exakt en ruta vid ja, oförändrad ruta 28 vid nej, rätt resultatreplik, alla personliga pjäser och standardräven, stängknapp/Escape, fokusåtergång, ingen horisontell overflow, inga API-anrop eller lagringsskrivningar. Fysisk iPhone/Safari inte provad.

## Uppdaterad spelstil

Den aktuella previewen ersätter den målade rastermiljön med nya kodbaserade SVG-figurer och en bakgrund i samma visuella språk som `adventure-bosses.js` och `adventure-sprites.js`: mörkbruna konturer, platta färgfält, överdrivna ansiktsdrag och läsbar silhuett. Gubben och den lila varelsen finns i `adventure/ride-characters.js`. Spelarpjäserna är oförändrade. Ingen ny AI-bildgenerering gjordes för denna version. Rasterbilden och prompten ovan hör till den bevarade första previewen och används inte av den aktuella versionen.

Nej-resultatets markerade ruta säger uttryckligen: ”Du missade en gratis extraruta. Du står kvar på ruta 28.” Repliken från gubben är kvar. Ja ger fortfarande en enda ruta, 28 till 29. Alla ändringar gäller endast previewen.
