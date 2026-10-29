# Ruta 44 — gubbens återkomst (endast lokal preview)

Öppna http://localhost:3002/adventure/ride-return-preview.html. Starta servern med `npm run dev:adventure`.

Samma `AdventureRideArt.charactersSVG` som på ruta 28, utan ändring i originalfilen. Spelarens tilldelade personliga pjäs eller standardpjäs visas bredvid gubben och varelsen.

Godkänd precisering av användaren: de 15 squatsen är ett **extra flyktuppdrag**, varefter pjäsen hamnar på ruta **43**. De är inte det vanliga steget från 43 till 44.

- Inledningen ”Du rollade högt …” är berättelsetext, inte en ny slump-/tärningsfunktion.
- Ta skjuts → skogsscen och extra flyktuppdrag. Ingen bakåtförflyttning förrän uppdraget bekräftas.
- Bekräfta 15 extrasquats → ruta 43, inga poäng. Nästa vanliga träningssteg kan återföra pjäsen till 44 utan nytt möte.
- Fortsätt utan skjuts → godkänd ”Snyggt läst”-text, kvar på 44, ingen extra uppgift.
- Stäng/Escape under uppdraget bevarar pågående previewtillstånd; återöppna genom ”Fortsätt flyktuppdraget”.
- Båda valen kan testas med ”Prova från början”. Previewtillståndet finns bara i minnet och nollställs vid omladdning. Ingen Auth, API, lagring eller verklig resa berörs.
- Ingen ljuduppspelning. Ingen ny rasterbild eller AI-generering. Skogsscenen är SVG som fortsätter den befintliga spelgrafiken.
- Den fristående previewn är isolerad och exkluderas från ordinarie Vercelpublicering. Den godkända versionen publicerades separat 29 oktober genom adventure-return-ride.js, befintlig klientlogik och en riktad migration.

Liveversionen har eget permanent kontoval samt sparat pågående flyktuppdrag, servervaliderad bekräftelse och ett enda separat −1-bakslag. De tidigare valen på 21/28/33 får inte återställas. Återbesök får inte återutlösa uppdraget. Inga riktiga extrasquats eller poäng importeras från denna preview.

## Kontrollerat 28 oktober 2026

`node adventure/ride-return-preview-ui.test.cjs` passerar i Chrome: 320/390/768/1440 px, alla fem personliga pjäser och standardpjäs, båda val, 15 extrasquats innan bakslag, återkomst till 44 utan nytt möte, X/Escape och återupptagning via knappen eller kartan, tangentbord, minst 44 px tryckytor, ingen horisontell scroll samt inga API-anrop, ljud eller ändringar i localStorage/sessionStorage. Fysisk iPhone/Safari har inte provats.
