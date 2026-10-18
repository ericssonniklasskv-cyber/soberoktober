# Dagens val – lokal prototyp

Branch `feature/voting-week-local`. Start: `npm run seed:vote` följt av `npm run dev:vote`. Lokal testinloggning finns på `/dev/login.html`; välj admin för testkontrollerna. Docker Desktop måste köra. Befintlig roulette nås i stället med `npm run dev:local` efter att frontend stoppats.

## Versioner och säker återgång

Första versionen är sparad i commit `2898f99`, taggen `voting-v1-20261016` och säkerhetsbranchen `safety/voting-v1-20261016`. Den versionen kan återtas utan gamla filkopior eller återställningsskript.

Efter att pågående ändringar sparats i Git kan versionerna växlas så här:

```sh
# Första versionen
git switch safety/voting-v1-20261016

# Den vidareutvecklade versionen
git switch feature/voting-week-local
```

Starta vid behov `npm run dev:vote` och ladda om webbsidan. Grenbyte ändrar inte röster, vinnare eller testklocka i den lokala databasen. Båda gränssnitten använder samma röstningsregler och tabeller.

Den vidareutvecklade designen har illustrerade passkort, markering av favorit före röstning, tre tydliga steg, tid kvar enligt serverns klocka, en kort firning efter sparad röst och aktuell ledning/lika i resultatvyn. Vinnarpasset har en öppningsbar redovisning av rösterna. Tidigare vinnare ligger hopfällda, utan att dagens pass upprepas. Tangentbordsfokus bevaras när röster uppdateras; minskad rörelse stänger av firningen. Befintliga testdata bevarades när designen ändrades.

## Beteende

- Första omröstningen öppnar söndag 18 oktober 2026 kl. **21.00 Europe/Stockholm**, för måndag 19 oktober.
- Efter första söndagen öppnar röstningen kl. **15.00 svensk tid** dagen före passet, måndag–lördag.
- Fyra slumpade pass visas. Välj ett och klicka ”Lägg min röst”. Valet kan ändras innan det skickas; den sparade rösten är låst.
- Unik databasnyckel per dag och användare stoppar dubbla röster, även från två flikar samtidigt. Bara inloggade aktiva deltagare kan rösta.
- Omröstningen stänger exakt kl. 00.00 svensk tid. Flest röster vinner utan krav på antal deltagare. Vid lika lottas ett av de högst placerade alternativen. Vid noll röster lottas bland alla fyra.
- Vinnaren lagras en gång. Resultatet räknas när testklockan passerar midnatt eller vid första anropet efter verklig midnatt. En sen röst accepteras aldrig, även om resultatet ännu inte hunnit sparas.
- Dagens vinnare och röstningen för morgondagen visas tillsammans. Sista passdagen är söndag 25 oktober. Datum hanteras med svensk tidszon, även över vintertidsbytet.
- Sidan uppdaterar röster var femte sekund. Manuellt uppdateringsknapp finns också. Efter din röst visas fördelningen.
- Bara aggregerade röstetal och den egna rösten skickas till deltagaren. Andras identiteter och individuella röster lämnar inte databasen.
- Som alternativ kan deltagaren markera **10 000 steg för 1 poäng**. Det räknas som en genomförd dag. Steg och pass utesluter varandra: klicka ur stegen för att välja passet, eller ångra passet för att välja steg. En gammal avmarkering från en annan flik kan inte radera det nya valet.
- Dagens vinnande pass kan klarmarkeras under passdagen för exakt 3 poäng och en genomförd dag, även om man inte röstat. Dubbelklick ger inga extra poäng. Ångra tar bort poängen. Resultatet visas i lokal topplista, Min oktober och rapporternas poäng/dagar. Ordinarie träningsregistrering spärras lokalt 19–25 oktober för att undvika dubbelräkning.

## Prova

1. Logga in som Lokal admin. Tryck ”Återställ omröstningstestet”: en ny testvecka slumpas, klockan blir söndag 20.59 och den gamla roulettevyn är kvar.
2. Tryck ”Öppna söndag kl. 21”. Röstvyn ersätter roulettekortet.
3. Rösta som Anna och Erik. Använd separata webbläsarprofiler för samtidiga konton, eller byt via `/dev/login.html`. Välj samma hostname hela tiden.
4. Som admin: ”Gå till nästa midnatt”. Måndagens vinnare syns, och röstning för tisdag öppnar kl. 15.00. Använd knappen ”Öppna röstningen kl. 15” för att testa. Deltagarsidan uppdateras inom fem sekunder.
5. Återställ och testa lika genom att lägga en röst på två olika pass. Testa även midnatt utan röster.

Testklockan är gemensam och går bara framåt. Återställ för att börja om. Återställning raderar prototypens röster, vinnare och klarmarkeringar inklusive deras testpoäng. Övriga poäng bevaras. ”Använd verklig tid” använder väggklockan; gamla testresultat finns kvar, så återställ först om du vill börja från noll. Seed uppdaterar funktionerna och aktivitetsutbudet, men skriver inte över klocka, röster, vinnare eller klarmarkeringar. Framtida, ännu oöppnade omröstningar får nya alternativ om utbudet har ändrats. Samma utbud ger samma sparade alternativ vid upprepad seed.

## Slumpade alternativ

Utbudet innehåller **20 pass**: 17 av de tidigare bingopassen och **3 × 15 squats**, **3 × 10 armhävningar**, **3 × 5 pull-ups**. Racketsport, ”Något nytt” och ”Träna ihop” har tagits bort från röstningsutbudet. Bingot ändras inte.

Varje passdag får fyra olika, slumpade alternativ. Alla deltagare ser samma alternativ, även efter omladdning och på andra enheter. Hela veckans dragning sparas i databasen; klienten slumpar inte. Ett pass som visas på måndagen kan inte visas på tisdagen eller onsdagen, men får återkomma på torsdagen. Spärren gäller alla fyra presenterade pass, oavsett vilka som får röster eller vinner.

Bara exakt samma pass spärras: **100 squats** och **3 × 15 squats** har skilda identiteter och kan visas samma dag. Databasen stoppar dubbletter per dag. Dragningen har ett transaktionslås så samtidiga seed-anrop inte kan skapa olika alternativ.

Befintliga öppnade omröstningar, röster, vinnare och klarmarkeringar behålls när uppdateringen installeras. Äldre alternativ kan därför finnas kvar i redan öppnade omröstningar. ”Återställ omröstningstestet” tömmer testresultaten och slumpar en helt ny vecka med det aktuella utbudet och tvådagarsspärren.

## Kontroller

```sh
npm test
npm run test:local
npm run test:ui
npm run test:vote
```

Det riktade gränssnittstestet `node voting/voting-ui.test.cjs` använder isolerade fixturer och skriver aldrig till Supabase. Det ingår även i `test:ui`.

`test:vote` kräver att `dev:vote` kör på port 3000 och att prototypen är tom på röster/vinnare. Testet vägrar radera befintliga testomröstningar. Det skapar tillfälliga Auth-konton, provar databasbehörigheter, dubbla samtidiga röster, tidsgränser, lottning, oförändrad topplista och riktiga webbläsarflöden. Tillfälliga konton raderas och startklockan återställs. Kör inte samtidigt som du själv röstar. Chrome kan väljas med `SOBER_BROWSER_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:vote` om Playwrights egen webbläsare saknas.

## Gräns mot production

Detta är inte en production-migration. `supabase/local-migrations/20261016073107_create_local_workout_voting_preview.sql` innehåller testfunktioner som inte får följa med en framtida remote-push. Bara `seed:vote` installerar filen, via verifierad lokal Docker/Supabase. Frontendens flagga kräver både ett uttryckligt lokalt startläge och loopback-API. Ingen automation, deploy, main-merge eller production-skrivning ingår.

Inför en eventuell release behövs en separat production-migration utan testklocka/reset och schemalagd midnattsavslutning med samma idempotenta reservlogik vid läsning. Vinnarlottning och röstning delar ett transaktionslås, så sena/samtidiga anrop inte kan ändra resultatet.

Klarmarkering testas med `npm run test:vote-completion` mot riktiga localhost och lokal Auth. Testet använder ett tillfälligt konto, simulerar vid behov en passdag och återställer testläget. Befintliga röster, vinnare, klarmarkeringar och klockan bevaras. Kör när ingen annan använder testmiljön. SQL-gränsfall provas med rollback i `supabase/tests/local_vote_completion.sql`, `local_vote_steps.sql` och `local_vote_schedule.sql`. `supabase/tests/local_vote_randomization.sql` kontrollerar 50 veckodragningar, fyra unika alternativ, exakt två dagars spärr, skilda övningsvarianter, stabila alternativ, bevarade öppna omröstningar/resultat, behörigheter och atomisk återställning vid för litet utbud. Stegtestet kontrollerar 1 poäng, ångring, byte mellan pass/steg, felaktiga poäng och kontoisolering. `test:vote-completion` omfattar även stegalternativet, samtidiga val och 1 poäng i Min oktober.
