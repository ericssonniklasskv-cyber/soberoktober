# Lokal utveckling

Miljön i `~/soberoktober` är uppdaterad 16 oktober 2026 från `origin/main` vid commit `3861c3e`.
Aktuell lokal branch: `feature/voting-week-local`, skapad från `local/dev-main-20261016`.

## Starta

```sh
cd ~/soberoktober
npm run dev:local
```

- App: http://localhost:3000/
- Lokal testinloggning: http://localhost:3000/dev/login.html
- Supabase API: http://127.0.0.1:54321
- Studio: http://127.0.0.1:54323

Starta Docker Desktop först. Kommandot startar lokal Supabase vid behov och Vercel lokalt. En redan körande frontend återanvänds bara om den använder rätt lokala API-adress, nyckel och serverstyrd roulette. Ctrl+C stoppar frontend; databasens data ligger kvar.

## Nästa veckas röstningstest

```sh
cd ~/soberoktober
npm run seed:vote
npm run dev:vote
```

Om en annan frontend redan kör på port 3000, stoppa den först med Ctrl+C. `seed:vote` installerar endast lokala testtabeller och RPC:er och bevarar befintliga röster. Vid en helt ny lokal installation, kör också `npm run seed:local` för testkontona.

Öppna http://localhost:3000/dev/login.html och välj Lokal admin. Testklockan börjar söndag 18 oktober kl. 21.00 så att omröstningen är öppen direkt. Admin kan återställa testet till kl. 20.59, öppna kl. 21 och gå till nästa midnatt. Test Anna och Test Erik kan rösta i separata webbläsarprofiler, eller genom att byta konto på inloggningssidan. Alla ser samma lokala testklocka.

Testet gäller 19–25 oktober: fyra slumpade pass per dag ur ett utbud på 20, en låst röst per deltagare och omröstning, flest röster vinner vid svensk midnatt. Lika röster lottas, även om ingen röstat; resultatet sparas. Alternativen är gemensamma och sparas i databasen. Samma exakta pass får inte visas två gånger samma dag eller under de två följande dagarna (måndag → tidigast torsdag). Övningsvarianter räknas som olika pass. Redan öppnade omröstningar bevaras vid seed; adminåterställning slumpar en ny testvecka. Nästa omröstning öppnar kl. 15.00. Fram till dess visas dagens pass och nästa öppningstid. På söndagen visas sista vinnaren utan ytterligare omröstning. Röstningen ersätter roulettrutan i detta testläge från söndag kl. 21. Dagens vinnare kan klarmarkeras för exakt 3 poäng och en genomförd dag. Som alternativ finns 10 000 steg för 1 poäng och en genomförd dag. Man får antingen passpoäng eller stegpoäng och kan klicka ur sitt val för att byta. Klarmarkeringen kan ångras och syns i lokal topplista, Min oktober och rapporternas poäng/dagar.

Tillbaka till nuvarande main-tema: stoppa frontend och kör `npm run dev:local`. Röstningens data ligger separat. Test-SQL finns avsiktligt i `supabase/local-migrations/`, **utanför** ordinarie migrationskedja eftersom det innehåller testklocka och återställning. Det får inte deployas till production. Ingen publicering eller söndagsautomation har skapats.

Första röstningsversionen är bevarad som `voting-v1-20261016` (commit `2898f99`) och på `safety/voting-v1-20261016`. Nuvarande branch innehåller den gladare vidareutvecklingen. Grenbyte påverkar inte röster eller vinnare; återgång beskrivs i guiden nedan.

Mer om flödet och tester: [voting/README.md](voting/README.md).

## Vad som följer main

Webbgränssnitt, bonusredigering, roulette, 10 000-stegsalternativ, poäng, aktivitet/kudos, topplistor och rapporter använder main-koden. Roulette använder nu samma databas-RPC som live, med upp till tre pass per dag, fem frispinn under veckan och möjlighet att registrera gårdagen. Automatisk utslagning för missade dagar är avstängd; adminutslagning för alkohol finns kvar.

Kontrollen den 16 oktober jämförde samtliga 69 applikationsfunktioner, 120 tabellkolumner, 85 begränsningar och 25 RLS-policyer med production. Klockfunktionen hade endast en skillnad i blanksteg. Inga production-deltagare eller production-resultat kopieras till testmiljön.

Lokala tillägg är start-/seedverktyg, testinloggning, testdata, Supabase-konfiguration och låsta utvecklingsberoenden. `/api/config` skickar `rouletteMode: server` endast när det lokala startkommandot satt `SOBER_ROULETTE_MODE=server` och API-adressen är loopback på port 54321. Så används den riktiga serverlogiken även lokalt. Det äldre läget med enbart webbläsarlagring används inte av `npm run dev:local`.

## Testkonton och testdata

```sh
npm run seed:local
```

Kommandot använder bara lokal Auth och lokal databas. Befintliga pass- och resultatändringar skrivs inte över. Exempelpass, bonusar, bingo och konton är fiktiva.

| Konto | E-post | Behörighet |
| --- | --- | --- |
| Lokal admin | admin@local.soberoktober.test | Admin |
| Test Anna | anna@local.soberoktober.test | Deltagare |
| Test Erik | erik@local.soberoktober.test | Deltagare |

Testsidans lösenord är `SoberLocal-2026!`, en offentlig fixture endast för lokal utveckling. Välj samma hostname hela tiden: localhost och 127.0.0.1 har separata webbläsarsessioner. Dagens datum och rouletteveckans datumgränser gäller som live.

## Kontroller

```sh
npm test
npm run test:local
npm run test:ui
```

`npm test` använder mains logiktester; äldre `.local-backups` testas inte. Lokal E2E kan köras med `SOBER_LOCAL_ENV_MODULE` satt till den absoluta sökvägen till `scripts/local-env.mjs`; då spärras alla databasanrop utanför loopback. Webbläsartesterna använder Playwright.

## Uppdatera inför fortsatt arbete

```sh
git fetch origin main
git log --oneline HEAD..origin/main
```

En tom lista betyder att branchen innehåller senast hämtade main. Nya main-commits behöver integreras innan jämförelsen görs igen. Kör inte en blind reset eller återställning från en äldre backup.

Den tidigare lokala versionen finns säkert bevarad på branchen `safety/local-before-main-sync-20261016`, commit `f2e68dd`. Den gamla branchen `feature-roulette-local` finns också kvar. `.env.local`, `.vercel-linked-backup/`, `node_modules/` och gamla filbackuper är bevarade lokalt och gitignored.

## Databasmigreringar

Veckans fyra redan applicerade ändringar har registrerats i lokal migrationshistorik efter strukturell verifiering. Databasen återställdes inte. Historiska tidsstämplar kan skilja mellan lokala filer och production; den retroaktiva `20260920112000_add_is_admin_to_profiles.sql` är fortsatt en lokal grund för att kunna skapa databasen från noll. Det är inte en instruktion att köra den mot production.

Arbeta och testa lokalt. Ingen `supabase db push`, remote-migrering eller merge till main utan uttryckligt godkännande. Återanslut inte `.vercel` till production och hämta inte production-miljövariabler till denna miljö. Startverktygen stoppar fjärradresser, behåller nycklar i minnet och skickar aldrig service-role-nyckeln till webbläsaren.
