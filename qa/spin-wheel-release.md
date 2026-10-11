# Release: Dagens Spinn The Wheel! 12–18 oktober 2026

Förberedd i `release/spin-wheel-20261012`, separat worktree, från senast kontrollerade `origin/main` **95fa3e89c177859cd81ce379982385c74cd9ebe7**. Den ordinarie lokala testbranchen och dess ocommittade ändringar är bevarade. Production-migrationen applicerades efter användarens uttryckliga godkännande den 11 oktober. Supabase registrerade version `20261011165533`; filnamnet är anpassat till den registrerade versionen utan att SQL-innehållet ändrats. Frontend-publiceringen återstår vid denna dokumentuppdatering.

## Tid och beteende

- Måldatum: **12 oktober 2026 kl. 00.01 Europe/Stockholm**, motsvarande **11 oktober kl. 22.01 UTC**.
- Koden kan publiceras före öppningen. Browser och server har en tidsgräns; servern godtar inga snurr före 00.01.
- Rouletten ersätter bingorutan. Gamla ”Dagens pass” hålls dolt hela 12–18 oktober, även 00.00–00.01. En öppen flik växlar automatiskt; detta har testats över midnatt.
- Roulettepoäng 2/3/4 per pass ersätter vanliga träningspoäng under veckan. Högst tre pass per dag sammanlagt, även över flera rundor. Checklistan är frivillig. Befintlig separat bonuslogik är bevarad.
- Dagens och gårdagens sparade runda kan klarmarkeras. Söndag 18 oktober kan slutföras måndag 19 oktober; inga nya snurr efter söndag. Äldre sparade dagar kan läsas via Min oktober.
- Humorn, den ljusa designen, stora hjulet, 21 pass och en tredjedels chans per tillgänglig nivå är bevarade.

## Granskad migration och produktionens historik

Endast `supabase/migrations/20261011165533_prepare_spin_wheel_release.sql` ska appliceras.

SHA-256: `d016cc27e0615e7f4538dc20de75e42e939fb3c9dd0a1efafe381611f1e23675`.

Den lägger till privat passkatalog, privata kontotillstånd och aktivitetslogg samt egna läsbara poängsummeringar. `my_training_roulette` validerar inloggning, datum, konkurrerande revisioner, lottning, fem frispinn och högst tre pass. Deltagare kan inte skriva egna poäng eller läsa andra kontons tillstånd.

Befintliga funktioner för genomförda tävlingsdagar, topplista och kudosflöde utökas med roulette. Deras definitioner jämfördes med aktuell produktion före ändringen; fristående bonuspoäng och kudos behålls. Ett nytt skydd blockerar gamla träningsregistreringar för 12–18 oktober. Inga befintliga tabeller, kolumner eller sparade resultat tas bort.

**Kör inte en generell `supabase db push`.** Lokal och remote migrationshistorik har olika tidsstämplar för flera äldre migrationer. Exempel: lokal pausmigration `20261005115143`, remote `20261005180436`; lokal kudosmigration `20261006193050`, remote `20261006195224`. Den retroaktiva lokala `20260920112000_add_is_admin_to_profiles.sql` ingår inte i denna release och ska inte appliceras mot production. Historiken ska redas ut separat.

Endast den nya SQL-migrationen applicerades via en riktad migrationsoperation. Inga historiska filer återspelades. Production-verifieringen visar 21 pass, tomma nya kontotillstånd/poängtabeller, aktiv RLS och korrekta behörigheter. Topplistan är identisk med före migrationen, och serverklockan använder `now()` med stängd roulette före 00.01.

## Verifiering

- 83 automatiska logiktester passerar.
- Alla 11 befintliga och nya webbläsarsviter passerar: adminbingo, adminrättningar, tävlingsbingo, egna rättningar, slutrapport, stegtopplista, kudos, popupsamordning, veckorapport, roulette och stegsparning.
- Lokal databas: 16 rollback-assertioner samt blockeringskontroller passerar. Bland annat öppningstid, kontoavskiljning, trepassgräns, fem frispinn, poäng/ångra, alkoholutslagning, gårdagen och söndagens sena klarmarkering. Anonym åtkomst, framtida/utgångna redigeringar, gamla poängformulär och direkt poängskrivning blockeras.
- Verkligt lokalt end-to-end: Supabase Auth → RPC → sparade rundor → poäng → topplista → Min oktober → aktivitetsflöde. Testar också samtidiga snurr, omladdning, frivilliga bockar, 1+2 pass och 320/390/768/1440 px.
- En öppen flik från 11 oktober 23.59.50 till 12 oktober 00.01 visar varken gamla Dagens pass eller bingo efter skiftet och öppnar rouletten automatiskt.
- Lokal Supabase security advisor: inga rapporterade problem. Testklockan återställd till `now()` och tillfälliga Auth-användare borttagna efter E2E.
- `.vercelignore` utesluter lokala miljöfiler, SQL, QA, skript, testfiler och backupmappar från uppladdning; frontend och `/api/config` ingår.

## Publicering — uttryckligen godkänd av användaren

Verifierade mål:

- Supabase `usbcwnirgkkfmluukria` (`soberoktober`).
- Vercel-projekt `prj_K1NPrNCCwBahc0ibjz5hy5udvOdQ`, team `team_d2H83EMrydYeuEmqK4Eu8FkT`.
- Domän `www.soberoktober.se`.
- Nuvarande production `dpl_3kBMui3U48CRxBudoNVk7ma8JGhU`, commit `95fa3e8`.

Ordning efter användarens godkännande:

1. Kontrollera att main/production och berörda databasfunktioner inte har ändrats sedan granskningen. Säkerställ att den nya migrationsversionen inte redan finns och att SQL-hashen matchar ovan.
2. Applicera endast den granskade migrationen mot målprojektet. Verifiera version, tabellbehörigheter, RPC och topplistans bevarade historiska poäng. Produktionsdata ska inte användas som testkonto eller få påhittade resultat.
3. Mergea releasebranchen till main och pusha uttryckligen main. Kontrollera Vercels deployment för den nya committen, bygglogg och production-domän.
4. Verifiera `/api/config` mot rätt Supabase utan att skriva ut nycklar, statiska tillgångar och den tidsstyrda starten. Före 00.01 ska inga nya snurr godtas; från 00.01 ska bingot ersättas och gamla Dagens pass fortsatt vara dolt.

Tidpunkten styrs av färdigpublicerad kod och serverns klocka. Ingen separat nattlig automationskörning behövs. Om publiceringen inte godkänns och genomförs före öppningen aktiveras funktionen inte live.

## Återställning

Releasebranchen och den befintliga production-deploymenten bevaras som återställningspunkter. Inga gamla lokala restore-skript ska köras på den nya releasebranchen.

Vid frontendfel kan nuvarande production-deployment `dpl_3kBMui3U48CRxBudoNVk7ma8JGhU` återpromoveras efter godkännande. De nya tabellerna och deltagarnas sparade roulettepass ska behållas. **Enbart frontend-rollback återställer inte gamla träningsformulär under rouletteveckan:** migrationsskyddet blockerar dem och topplistan använder roulettepoäng. Om hela tävlingsbeteendet ska återställas behövs en separat granskad kompensationsmigration som tar hänsyn till redan intjänade poäng. Gör ingen destruktiv databasrollback eller historikreparation som del av en akut frontendåterställning.
