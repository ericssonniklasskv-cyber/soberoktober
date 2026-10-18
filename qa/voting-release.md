# Dagens val: release 18 oktober 2026

Godkänd av användaren att publicera live. Releasebranchen bygger på senaste main 3861c3e och den lokalt testade röstningsversionen 54f7d14. Tidigare production: dpl_Do5EafSz5vmp5rYjqFfxsQ5ZsXXg.

## Övergång och regler

- Söndag 18 oktober kl. 21 Europe/Stockholm öppnar omröstningen för måndag. Dagens roulette visas nedanför röstningen, går att snurra och klarmarkera till midnatt och stängs inte när röstningen öppnar.
- Från måndag 19 oktober visas dagens vinnare och nästa röstning (öppnar kl. 15). Den gamla Dagens pass-rutan är dold. Söndagens sparade roulette kan fortfarande nås via Min oktober för sen klarmarkering enligt befintlig roulettefunktion.
- En låst röst per aktiv deltagare/dag. Vid svensk midnatt vinner flest röster; lika eller inga röster avgörs med en engångslottning som sparas. Ingen miniminivå för valdeltagande.
- Fyra gemensamma slumpade alternativ per dag, 20 aktiviteter i utbudet. Exakt samma pass kan inte visas två gånger samma dag eller de två följande dagarna. Olika varianter räknas var för sig.
- Dagens pass ger 3 poäng eller 10 000 steg ger 1 poäng. Alternativen utesluter varandra och kan ångras under passdagen. Min oktober, rapporter och topplista räknar poäng och genomförd dag.

## Databas

Bara migrationen launch_daily_workout_voting ska appliceras genom en riktad operation. Ingen generell db push: gamla lokala migrationsversioner avviker från remote, och den retroaktiva is_admin-migrationen ska inte återspelas.

Migrationen skapar privata workout_vote-tabeller och en autentiserad my_workout_vote-RPC. Den utökar competition_day_complete/get_leaderboard med nya poäng och blockerar gamla daily_results-formulär 19–25 oktober. Roulette, bingo, bonusar och tidigare poäng behålls. Inga befintliga resultat tas bort. Alla privata tabeller har RLS och saknar klientbehörigheter; deltagaren får aggregerade röster och sina egna registreringar.

Production använder verklig serverklocka och har ingen testklocka, återställnings-RPC eller lokal testinloggning. pg_cron avslutar förfallna omröstningar varje minut, med samma idempotenta reservlogik vid läsning. Jobbet tar bort sig självt efter veckan. Deadlinekontrollen görs på nytt efter transaktionslåset så en väntande röst inte släpps igenom efter midnatt.

## Verifiering

104 logiktester, lokala miljötester, produktionens SQL med rollback (tidsgränser, låsta röster, poäng/steg/ångring, behörigheter och 50 slumpade veckor), samt webbläsarflöden för söndag 21 → måndag 00 och utloggat läge. Befintliga webbläsarregressioner körs också inför release. Uppladdningskontrollen utesluter miljöfiler, SQL, testdata, skript, backupmappar och dev-inloggningen.

## Återgång

Behåll tidigare deployment och releasebranch. Frontend kan återpromoveras vid fel. Nya tabeller/röster/poäng ska bevaras. En full återgång till gamla träningsformulär kräver en granskad kompensationsmigration; gör ingen destruktiv rollback. Lokala testversionen finns kvar på feature/voting-week-local.

## Productionkontroll efter migration

Supabase registrerade version 20261018134749. Filnamnet följer serverns registrerade version; SQL-innehållet är oförändrat. Production har 20 katalogpass, 28 alternativ, fyra unika per dag och noll överträdelser av tvådagarsspärren. Nya röster, vinnare och registreringar är tomma inför öppningen. Topplistans hash är identisk före och efter migrationen (5e099a716919083eab457baf1fa17b5c), och roulettpoängen bevaras. Cron-jobbet är aktivt och första öppningen är 18 oktober kl. 19 UTC = kl. 21 svensk tid.

Security advisor: privata tabeller har avsiktligt RLS utan klientpolicyer och nås via kontrollerad RPC. Kvarvarande varningar gäller redan befintliga, avsiktligt publika topplistan/bonus-RPC samt Auth-inställningen för läckta lösenord; inga nya exponerade SECURITY DEFINER-funktioner för röstningen.
