# Dagens Spinn The Wheel!

Rouletten ersätter startsidans bingo under 12–18 oktober 2026. Den tidigare rutan ”Dagens pass” är också dold hela veckan, inklusive minuten före öppningen. Nya snurr öppnar måndag 12 oktober kl. 00.01 svensk tid. En redan öppen flik växlar automatiskt. Söndagens sparade pass kan klarmarkeras under måndagen den 19 oktober; inga nya pass kan snurras då.

## Deltagarens flöde

1. Välj styrka, kondition eller rörlighet. Den befintliga kategorikommentaren visas i en egen ruta före hjulet. Humorn och blinkningarna behålls.
2. Snurra det stora hjulet. Resultatet sparas innan animationen. Vinstvyn visar passets namn och leder vidare till passöversikten.
3. Kombinera upp till tre pass. Instruktioner och ändringsalternativ öppnas separat. Att gå tillbaka i menyn kostar inget.
4. Öppna den gemensamma checklistan. Bockarna är frivilliga och sparas; klarmarkering fungerar även utan bockar och fyller inte automatiskt checklistan.
5. Klarmarkera rundan. Efter ett eller två genomförda pass går det att starta en ny runda med dagens återstående platser. Efter tre pass går det inte. Ångra gäller den aktuella rundan och behåller bockarna.

Ljus beige popup, gröna knappar, orange detaljer och grönt runt hjulet. Innehållet visas utan fade. Anpassning för minskad rörelse påverkar animationer men gör inte humorn valbar.

## Poäng och lottning

- 21 pass: nio styrka, nio kondition, tre rörlighet. Lugn ger 2, medel 3 och utmaning 4 poäng. Ingen separat roulettebonus.
- Roulettepoängen ersätter vanliga träningspoäng 12–18 oktober och summeras för högst tre klara pass per dag, även över flera rundor. Befintliga fristående bonusar ändras inte.
- Nivåerna har en tredjedels chans vardera (33,33 %). Därefter väljs pass inom nivån. Senaste passet och andra pass i kombinationen undantas. Om en nivå saknar valbart pass delas chansen jämnt mellan återstående nivåer.
- Första snurren per kategori och passplats på dagen är gratis. Omsnurr i en tidigare använd kategori på samma plats kostar ett frispinn. Fem frispinn delas över veckan och alla passplatser. Borttagning återställer inte snurrhistoriken.
- Styrka: lugn två kroppsviktsövningar med två set; medel tre övningar med tre set; utmaning tre eller fem övningar med tre set. Motsvarande övningar på gym är tillåtna.
- Kondition: lugn promenad, medel sammanhängande jogg, utmaning tuffare pass. Medel och utmaning tillåter motsvarande i annan konditionsform, exempelvis simning/cykling.
- Rörlighet: 10, 20 eller 30 minuter med en Youtubevideo som deltagaren väljer själv.

## Server och lokal testning

I produktion används `my_training_roulette`: databasen lottar, validerar frispinn/dagsgräns och lagrar tillstånd per inloggat konto. Klarmarkering uppdaterar egna poäng, topplista, Min oktober, rapporter och aktivitetsflöde. Gamla formulär kan inte registrera vanliga träningspoäng under rouletteveckan. Sparade pass kan klarmarkeras idag eller igår. Äldre dagar är läsbara. Alkoholutslagning ger inte rätt att fortsätta; gårdagens pass kan rättas vid utslagning för två missade dagar.

Serverns revisionsnummer förhindrar att samtidiga snurr i flera flikar/enheter skriver över varandra. Checklistor och snurrhistorik ligger i privata tabeller; deltagaren kan endast läsa sina egna summerade resultat. Uppgifterna stannar kvar över omladdning och mellan enheter.

På loopback med lokal Supabase används den tidigare webbläsarprototypen som standard. Dess testpoäng påverkar inte databasen. QA-serverns `/api/config` sätter `rouletteMode: 'server'` för att testa det riktiga produktionsflödet mot lokal Supabase. Det ska aldrig kräva production-nycklar.

## Verifiering

```bash
npm test
npm run test:ui
```

`qa/roulette-local-e2e.cjs` kräver ett uttryckligt `SOBER_LOCAL_ENV_MODULE` som exporterar den lokala stackadaptern. Testet använder verklig lokal Auth, RPC och databassparning, tillfälliga användare och en testklocka som återställs i `finally`. Kör inte samtidigt som databasens rollback-test.

`supabase/roulette-rollback-tests.sql` ska köras mot lokal databas inom `BEGIN`/`ROLLBACK`. Det prövar behörigheter, tider, frispinn, poäng och dagsgräns utan att lämna testdata.

Se [releaseunderlaget](../qa/spin-wheel-release.md) för migration, produktionens historikskillnader, godkännande och återställning. Använd inte gamla lokala restore-skript på releasebranchen: de skriver över nyare serverintegration.
