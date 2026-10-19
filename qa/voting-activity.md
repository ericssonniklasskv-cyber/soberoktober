# Röstningspass i aktivitetsflödet

## Bekräftat fel

Den 19 oktober fanns två sparade klarmarkeringar av röstningspass i production,
men inga aktiviteter för dagens datum. `private.kudos_feed_events()` innehöll
vanliga pass, bingo och roulette, men saknade `workout_vote_completions`.
Startsidan lyssnade dessutom inte på `vote-result-changed`.

## Rättning

- Den befintliga privata klarmarkeringen återanvänds direkt i den gemensamma
  aktivitets-/kudoskällan; ingen separat eventtabell eller poängändring.
- En privat identity-kolumn identifierar aktiviteten utan deltagarens UUID.
  Den tilldelas även befintliga klarmarkeringar, vars ursprungliga tid bevaras.
- Pass och stegalternativ har separata texter. Ångring tar bort aktiviteten
  eftersom källraden tas bort. Ommarkering får en ny aktivitetsnyckel, medan
  upprepade identiska sparanrop behåller samma nyckel.
- Befintliga RPC-payloads och behörigheter behålls. Kudos använder samma
  mottagarkontroll och idempotens som tidigare. Tidigare skickade kudos raderas inte.
- Startsidan hämtar om flödet direkt vid sparning/ångring, med befintlig
  30-sekunderspollning som reserv för andras aktiviteter.

## Verifiering

- `npm test`: 106 godkända tester.
- `qa/voting-activity-ui.test.cjs`: verklig aktivitetskod med simulerade RPC-svar,
  omedelbar uppdatering, ångring, max fyra poster, säkra textfält och full feed.
  Bredder 320, 390, 768 och 1440; inga sidfel eller horisontellt overflow.
- Lokal SQL i en transaktion som avslutades med ROLLBACK: production-röstningen,
  en registrering skapad före rättningen, rättningen och
  `supabase/tests/voting_activity_feed.sql`.
  Kontrollerar oförändrad leaderboard, oförändrad tid för äldre registrering,
  pass/steg, dubbelsparning, ångring/ommärkning, privata behörigheter, publik
  payload utan e-post/UUID, egenmarkering och kudos exakt en gång.

Inga production-data har ändrats. Inför publicering behövs den riktade
migreringen `20261019192359_add_voting_completion_activity_feed.sql` samt
frontend-deployen tillsammans. Publicera frontend först så att de nya
aktivitetstyperna stöds när databaskällan börjar returnera dem.
Kör inte generell `db push` och återspela inte den ursprungliga röstningsmigreringen.
Efter godkänd publicering: kontrollera befintliga klarmarkeringar via RPC och
kör Supabase security/performance advisors.
