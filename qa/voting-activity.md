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

Inför publicering behövs den riktade
migreringen `20261019192912_add_voting_completion_activity_feed.sql` samt
frontend-deployen tillsammans. Publicera frontend först så att de nya
aktivitetstyperna stöds när databaskällan börjar returnera dem.
Kör inte generell `db push` och återspela inte den ursprungliga röstningsmigreringen.
Efter godkänd publicering: kontrollera befintliga klarmarkeringar via RPC och
kör Supabase security/performance advisors.

## Publicerat 19 oktober

Godkänt av användaren och publicerat på main (cba57e8), Vercel-deployment
`dpl_G2itC7dcdYH47fG5BVKWpV6WfC92`, båda soberoktober-domänerna.
Databasen registrerade migreringen som `20261019192912`; filnamnet följer
den registrerade versionen och SQL-innehållet är samma testade rättning.

Livekontrollen visar två befintliga röstningsaktiviteter. Hasharna för
leaderboard och sparade klarmarkeringar är identiska före/efter. Feedens
antal gick från 122 till 124. RLS och privata åtkomstspärrar består.
Läsande kontroll av den riktiga sidan/API:t vid 320/390/768/1440 visar rätt
texter, enbart avsedda publika fält, inget overflow och inga sidfel.
Security/performance advisors har samma befintliga fynd som före ändringen.

## Kortare text

Aktivitetstexten använder nu passets korta katalognamn: exempelvis
”MikeB klarade av 3 × 15 squats”. Stegalternativet visas som ”Erik gick
10 000 steg”. Varken temat eller poängen upprepas i raden.
Migration `20261019193324_shorten_voting_activity_labels.sql` ändrar endast
etiketterna i den befintliga källan, även för kudos. Sparade resultat,
leaderboard och aktivitetsnycklar verifierades oförändrade efter migreringen.
106 logiktester, befintligt mobil-/desktoptest och lokalt SQL-rollbacktest
passerar, inklusive kontroll av att etiketten är det korta katalognamnet.
