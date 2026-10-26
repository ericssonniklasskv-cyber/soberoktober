# Ruta 21 — Den hemliga genvägen

Separat designpreview: `/adventure/shortcut-preview.html`.
Starta vid behov `npm run dev:adventure` och öppna `http://localhost:3002/adventure/shortcut-preview.html`.

Inga ändringar har gjorts i startsidan, äventyrets logik, API eller databas. Previewen laddar inga konton och använder varken localStorage eller sessionStorage. Alla vägval finns bara i minnet och kan testas om med knappen på previewsidan.

## Flöde

- På ruta 21 upptäcker pjäsen en gömd stig i Ravine of shots.
- **Ta genvägen:** texten ”En genväg är alltid en genväg, bra val” visas, pjäsen rör sig mot stigen, och positionen i previewen ändras från 21 till 22. Exakt en extra ruta, inga poäng.
- **Fortsätt på samma väg:** visar ”Synd, ingen minns en fegis” och ”En genväg är alltid en genväg. Nu får du göra 15 squats för att flytta en ruta till.” Pjäsen behåller position 21 och resultatrutan har en knapp tillbaka till äventyret.
- Stängkrysset/Escape lämnar positionen oförändrad tills man uttryckligen valt genvägen.
- Efter valet av genväg behålls position 22 när resultatet stängs.
- Välj bland fem befintliga personliga pjäser eller standardräven i previewverktyget. Det här verktyget är ingen inloggning och påverkar inte personliga pjäsbindningar.

Liveintegration och en beständig, servervaliderad engångsbonus ingår inte i denna preview. Vid en framtida godkänd release behöver bonusrutan räknas separat från träningsregistreringar och spärras mot upprepad hämtning.

## Bild och prompt

Ny miljöillustration skapad med det inbyggda imagegen-verktyget. Inga personbilder skickades till bildverktyget; befintliga pjäser läggs ovanpå skogen i webbläsaren.

Projektbild: `adventure/assets/secret-shortcut.webp` (1200 × 800, 321 130 byte).
Original: `/Users/niklasericsson/.codex/generated_images/01a10806-81e6-7f62-8a53-048670f520a2/exec-1b6ea7c9-9539-4a1f-a77d-4f531d6de061.png`.

Prompt:

> Use case: illustration-story. Asset type: background illustration for a hidden shortcut popup in the Swedish fantasy board game Frestelsernas rike. Primary request: a beautiful welcoming secret fork in a fantasy woodland path, fitting a classic high fantasy Warcraft / Tolkien storybook adventure. Wide landscape image around 3:2. A warm pale sandy road enters at bottom center then forks: broad safe road curving gently away on the left, a tiny inviting shortcut on the right through a mossy natural arch made of twisted trees and glowing golden leaves. A small rustic wooden arrow sign at the fork points toward the secret arch; no writing or symbols on the sign. Warm afternoon sunbeams, soft mist, moss, ferns, small copper orange mushrooms, green-gold foliage. Painterly polished game illustration with rich readable shapes, subtly hand painted texture, forest green, sage green, warm parchment cream, copper orange and golden lighting; inviting playful discovery rather than scary. Scene framed to crop well to wide landscape and square mobile header, keep fork and arch in central 65 percent. Keep lower-left foreground relatively uncluttered for a separate player pawn that will be composited on top in the app. NO PEOPLE, no riders, no animals, no UI, no lettering, no readable text, no watermarks, no borders. This is the environment only.

## Verifierat

Klickflödet har provats i Chrome vid 320, 390, 768 och 1440 px. Båda val, återställning, Escape/stängkryss, fokusåtergång, de fem personliga pjäserna och standardräven fungerar. Ingen horisontell overflow, inga API-anrop och inga skrivningar till webbläsarlagring. Fysisk iPhone/Safari har inte provats.
