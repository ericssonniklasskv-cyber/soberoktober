# Efterregistrering under röstningsveckan

## Bekräftat fel i live 21 oktober

`workout_vote_action` krävde att resultatets datum var exakt dagens svenska
datum. Min oktober dolde samtidigt editorn för 19–25 oktober. Därför gick
varken gårdagens pass eller 10 000-stegsalternativ att registrera där.

## Rättning

- Återanvänd dagdialogen: välj det framröstade passet (3 poäng), 10 000 steg
  (1 poäng), eller Inte registrerat för att ångra. Bonusen hanteras separat.
- Datumet måste vara en avgjord dag 19–25 oktober och högst dagens svenska
  kalenderdatum. Historiska rättningar fungerar även efter oktober.
- Samma val sparas utan att tidpunkt/aktivitetsnyckel ändras. Byte mellan
  alternativen sker atomiskt i befintlig autentiserad RPC, utan nya tabeller.
  Misslyckad ersättning återställer det tidigare resultatet.
- Ägarskap, poängmappning, alkoholutslagning och röstningsdeadlines är
  oförändrade. Klienten skickar ett val, aldrig poäng eller användar-ID.
- Min oktober uppdaterar poäng/dagar/rapporter efter sparning. Sparat pass
  och misslyckad bonussparning skiljs tydligt i återkopplingen.
- Produktionsreleasen ändrar inte lokala testklockor eller experiment.
  En separat lokal testanpassning är bevarad utanför Git/deployment i
  `test-results/local-only/history-corrections/`.

## Verifierat

- 106 befintliga logiktester passerar.
- `qa/voting-history-ui.test.cjs`: faktisk Min oktober-kod vid
  320/390/768/1440. Gårdagen/äldre dagar, pass/steg, bonus, ångring, omladdning,
  saknad bonusrad, framtida datum, sparfel, delvis bonusfel, dubbelklick,
  Escape under sparning och utloggning medan en dag laddas. Inga sidfel.
- `min-oktober/self-corrections-ui.test.cjs`: vanliga tidigare pass och bonus
  fungerar fortsatt i samtliga fyra storlekar.
- `test-results/local-only/history-corrections/voting_history_corrections.sql`
  körd mot production-schema
  i lokal BEGIN/ROLLBACK: riktiga roller, gårdagens steg, exakt en dag/rad,
  fasta poäng, oförändrad identisk sparning, aktivitetsfeed, atomiskt byte,
  framtida dagar, svensk midnatt, låst röstning, andra konton, alkoholspärr,
  rättning efter oktober och anonym spärr.
- Lokala completion/steps-SQL-tester med lokal testanpassning passerar också;
  dessa lokala ändringar ingår inte i publiceringen. Alla databastester
  avslutades med ROLLBACK.

## Publicering 21 oktober

Användaren har godkänt livepublicering. Den riktade migrationen är applicerad
och registrerad som `20261021090117_allow_voted_workout_history_corrections.sql`.
Kontrollen efteråt visar oförändrade hashvärden för resultat, leaderboard,
röster och vinnare. Anonym RPC-åtkomst och direkta klientskrivningar till
den privata tabellen är fortsatt spärrade. Frontend publiceras från main
till det separata Vercel-projektet soberoktober.
Publicera inte `supabase/local-migrations/` till production och kör inte
generell db push. Befintliga deltagarresultat behöver inte ändras.
