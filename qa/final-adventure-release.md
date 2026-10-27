# Frestelsernas rike — releaseunderlag 25 oktober 2026

Status: **PUBLICERAT 25 oktober 2026** med användarens uttryckliga godkännande. Databasmigrationen är installerad och aktiverad; startsidan är live direkt. Träningsregistreringar öppnar först 26 oktober kl. 00.00 svensk tid. Releasekoden finns på main i `ba6898a53b1651bab59bd805dd1c9f1ae851be72`. Senaste inhämtade main: ed288a7; införlivad i utvecklingsbranchen genom 5f1703d. Designversionen före releasearbetet är b6d15e6 och kan granskas utan att återställa några arbetsfiler.

## Ändringen

En aktiverad release skickar startsidans besökare till `/adventure/?live=1` **direkt**, enligt användarens publiceringsgodkännande den 25 oktober. Deltagarna kan logga in, se sin pjäs/introduktion, kartan, topplistan och senaste aktivitet redan på söndagen. Träningsregistreringar, bossmarkeringar och finalveckans bonus är serverlåsta fram till **26 oktober 2026 kl. 00.00 svensk tid** (25 oktober kl. 23.00 UTC, efter omställningen till vintertid). En öppen startsida kontrollerar bytet var 30:e sekund och när fliken återaktiveras. Före gränsen ligger röstveckan kvar. Efter 31 oktober kl. 23.59.59 sparas resan och poängen läsbara, men nya spelregistreringar och ångra stoppas. Den synliga designen, humorn, bossuppdragen, valfria bossljuden och finalfirandet är kvar.

Tre huvuddelar: riket, topplista, senaste aktivitet. Kompakt bonus, konto, regler och resedagbok finns kvar. Endast verifierad admin får adminlänken; den befintliga adminmiljöns RLS skyddar skrivningarna. Lokala testverktyg och exempelpoäng används inte i anslutet läge.

## Databas

Endast den nya filen `supabase/migrations/20261025202041_prepare_final_adventure.sql` är den planerade schemaändringen utöver nuvarande main. Den skapar privata inställningar, konto-/pjäsbindningar, spel, händelser och idempotensposter; ett autentiserat RPC; serverstyrda datum/bossar/poäng; uppdaterad poängsumma, dagshistorik och aktivitet; samt spärr för gamla dagens pass under aktiverad finalvecka. Inga äldre resultat raderas eller räknas om. Inställningen `enabled` börjar på **false**.

Konto-ID:n är verifierade genom godkänd läsning från production den 25 oktober och binds uttryckligen i migrationen. Det omfattar även kontot ”Elliott da bomb 💣”. Ingen namnmatchning eller namnbaserad reservväg används. Aktiveringssteget stoppar om inte exakt de fem verifierade konto-/pjäsparen finns. Nya eller ändrade visningsnamn kan inte ta över någon annans personliga pjäs. Enbart serverns `auth.uid()` väljer vems resa som ändras; namn och klientdata bestämmer aldrig poäng, roll eller användare.

Resan: 15 squats / 10 armhävningar / 5 pull-ups / 1 km löpning = en ruta, 0 poäng. Efter ruta 36 ger samma mängder 1 poäng per ny registrering. De fem första bossarna måste klaras i turordning. Bakrusbaronen öppnar enbart 31 oktober och blockerar inte poängjakten. Bonus är separat och använder adminvärdet. Ingen återregistrering av tidigare resövningar som poäng. Ingen automatisk utslagning för missade dagar har återinförts.

## Verifierat lokalt

- 137 enhetstester och samtliga webbläsarregressioner för tidigare teman och finaläventyret.
- Riktig lokal Auth → PostgREST → privat spellagring → svar → karta/topplista/historik.
- Isolerad återläsning av lokal baseline och full körning av migrationsfilen i en separat QA-databas. Cron i den kopian är en avstängd teststub; finalveckan kräver inget cronjobb.
- Datum vid start, 30/31 oktober och 1 november, inklusive svensk vintertid.
- Anonyma och direkta skrivningar nekas; andra konton påverkas inte; fel användar-ID/datum/poäng i klientpayload ignoreras.
- Samtidiga revisioner, dubbla anrop, samma ID med ändrad payload, tappat svar efter genomförd databastransaktion och återförsök.
- Ångra boss och slottsankomst, återlåst poängjakt, sparad position och bonus mellan sessioner.
- Personlig pjäs är låst och första-besöksintroduktionen följer kontot mellan webbläsare.
- 320/390/768/1440 px, långa namn, förstagångsinloggning utan profil, frivilliga ljud och finalfirande. De aktiva porträtten är komprimerade från cirka 20,2 MiB till 0,97 MiB (95,2 % mindre); originalen är bevarade.
- Supabase security advisors körd med `--local --type security --level warn`: inga problem rapporterades.

## Krävs före production

1. **Godkänd läskontroll genomförd 25 oktober.** Projekt soberoktober (`usbcwnirgkkfmluukria`), samtliga fem konto-ID:n, inga gamla passresultat eller bonusmarkeringar 26–31 oktober och båda missade-dagar-funktionerna kontrollerades. Topplistans, dagssummeringens och aktivitetens basdefinitioner matchar de lokalt testade versionerna. Resultatet finns i `qa/adventure-production-read-audit.json`. Läs om relevanta uppgifter precis inför en godkänd release; aktuella poäng kan naturligt ändras medan deltagarna använder sajten.
2. **Kör inte generell `supabase db push`, inte heller som standardmetod för denna release.** Tolv äldre migrationsnamn har olika versioner lokalt och i production. Production har även sin historiska bingoaktivering, medan den lokala retroaktiva `is_admin`-filen saknas i production-historiken trots att kolumnen finns. Ingen historik ska ändras och inga äldre filer ska återspelas. Applicera efter godkännande enbart den nya granskade SQL-filen via en riktad migrationsoperation, som tidigare roulette-/röstreleaser. Läs den registrerade versionen efteråt och anpassa det nya filnamnet om servern tilldelar en annan version, utan att ändra SQL-innehållet. Den nya filens SHA-256 ska kontrolleras precis före operationen.
3. Bekräfta Vercel-team/projekt, production-gren, commit och Supabase-URL. `SOBER_ADVENTURE_ENABLED=1` behövs för release; `SOBER_ADVENTURE_LOCAL_PREVIEW` får inte sättas i production. Inga env-filer ska dras in i detta lokala worktree. Google-inloggning återanvänder sajtens befintliga callback `/`. Startsidan vidarebefordrar auth-fragment eller kod till finaläventyret på samma origin när temat är aktivt; ingen ny callback-adress behöver införas för temat. Detta är regressionstestat utan att logga några riktiga sessionstoken. Testa verklig Google-inloggning och utloggning på den förberedda releasen.
4. Begär explicit godkännande för **exakt migration, aktivering och frontend-release**. Tidigare publiceringsgodkännanden för röstning/roulette gäller inte denna release.
5. Applicera bara den granskade nya migrationen. Kontrollera tabellgrants och serverns verkliga klockfunktion, konto-/pjäsbindningar och att aktiveringen fortfarande är avstängd. Läsförfrågningar med ett riktigt testkonto ska fungera före aktivering; poängskrivning ska nekas.
6. Aktivera databasen med den separat granskade `qa/adventure-activate.sql`. Den stoppar om fem personliga bindningar saknas eller gamla framtida passresultat finns. Skapa och testa Vercels stage:ad production-build innan domänen flyttas, eller använd godkänd main-release med verifierade inställningar. Ingen lokal testklocka eller lokal spelprogress får migreras.
7. Gör slutkontrollen på samma build: inloggning, rätt pjäs/intro, inga demodata/testverktyg, adminbonus, serverpoäng, två enheter, månadslista/aktivitet, mobil och ljudfel. Publicering/merge/promote utförs först efter användarens uttryckliga godkännande.

## Återgång

Behåll föregående fungerande production-build och commit. Vid problem: stäng databasens `private.adventure_settings.enabled` och återgå till föregående frontend-build/flagga. **Radera inte de nya tabellerna, händelserna eller tidigare poäng.** Tabellen kan ligga kvar och en rättad release återuppta deltagarnas resor. Enbart avstängd frontendflagga lämnar befintliga API-skrivningar möjliga, så både databasspärr och frontend behöver hanteras. Kontrollera hur gamla startsidan ska visas under finalveckan innan en full återgång; den kan annars visa gamla dagens pass.

Lokala backupen före databasförberedelsen finns i `/private/tmp/sober-before-adventure.dump`. Det är lokal testdata; publicera eller committa aldrig backupen.

## Resultat av godkänd production-läsning

- Fem korrekta konton hittades; Elliott har en bombemoji i sitt visningsnamn. Den upptäckta namnmissen är rättad lokalt genom uttryckliga konto-ID:n.
- Automatisk utslagning för missade dagar är fortfarande avstängd i båda berörda databasfunktionerna.
- 0 gamla vanliga passresultat och 0 bonusmarkeringar finns för finalveckan.
- Inga bonusuppgifter är ännu upplagda för 26–31 oktober. Admin kan lägga till dem efter releasen, separat från riket.
- Finaläventyrets tabeller är inte installerade i production.
- 43 production-migrationer granskades. Historiska versionsskillnader kräver en riktad release, inte en generell db push. Ingen reparation eller SQL-skrivning utfördes i production.

## Granskat SQL-innehåll

SHA-256 för `20261025202041_prepare_final_adventure.sql`: `71fc5df7675604e7053919c2cf40c6a01e706308a80c759a48dcda2245e43b7e`. SQL har kontrollerats med verklig klocka efter kontolåset; ett anrop som startar den 31 oktober men väntar över midnatt nekas utan registrering. Callback-testet använder riktig lokal Auth och en ny webbläsare, och bekräftar att återkomsten via startsidan öppnar rätt konto utan att lämna token i adressen.

## Publiceringsgodkännande

Användaren godkände 25 oktober uttryckligen databasrelease, publicering och byte av startsida direkt, med träningsstart först 26 oktober kl. 00.00 svensk tid. Pjäsintroduktionen ska fungera redan på söndagen.

## Genomförd release och slutkontroll

- Migration `20261025202041_prepare_final_adventure.sql` applicerad riktat; SHA-256 oförändrad. Den registrerade production-versionen ersatte utkastets tidsstämpel, utan SQL-ändringar. Historiska migrationer reparerades inte.
- Aktiverad med `qa/adventure-activate.sql` efter verifiering av exakt fem personliga konto-/pjäspar och noll gamla framtida passresultat. Production använder `clock_timestamp()` och Europe/Stockholm; ingen testklocka eller lokal testprogress importerades.
- `SOBER_ADVENTURE_ENABLED=1` endast i Vercels production-miljö. Inget lokalt previewläge i live-konfigurationen.
- Först publicerad och kontrollerad som `dpl_9txWj1fdzfbXCbnPLwxUVHJiw2PF`. Main-bygget `dpl_5X41M6a1wDuzUP5Dqi4amVfJxC7E` följer releasecommitten `ba6898a53b1651bab59bd805dd1c9f1ae851be72`. Git-trädet `f234633318658ef5bb6160626ecdf2d143961253` är identiskt med den testade lokala releaseversionen.
- Den riktiga domänen omdirigerar direkt till riket. Nillebaes riktiga konto visade sin personliga introduktion redan på söndagen. Production-RPC hämtade rätt pjäs, tio deltagare, topplista och tidigare aktivitet; träningsförsök före måndag nekades. Databaskontrollen rullades tillbaka utan testregistreringar.
- Lokal regression: 137 enhetstester, mobil-/ljudtester och verklig lokal Auth/PostgREST/databas. Nytt test bekräftar söndagens startsida + pjäsintro, serveravslag före midnatt och upplåsning på samma öppna sida vid midnatt.
- Skrivskyddat live-test: startsida/inloggning på 320/390/768/1440 px utan horisontell scroll eller sidfel. Alla elva WebP-porträtt och sju M4A-filer är byte-identiska med releasen. Samtliga sju ljud avkodas/spelas i Chrome. HTTP byte ranges fungerar. Interna QA-/migrations-/env-filer returnerar 404.
- Automatisk utslagning för missade dagar är fortfarande avstängd. Inga bonusuppgifter för 26–31 oktober lades till av releasen; de kan läggas in via admin.
- Fysisk iPhone/Safari och subjektiv ljudnivå/ljudkvalitet är inte verifierade. Fanfaren har manuell startknapp som reserv om webbläsaren blockerar ljudstart.
- Återgång vid behov: tidigare fungerande build `dpl_GSfwxLdgCLHJQSFuJFjxw29G1no8`/main `ed288a75439072f5d07374aba68fc0402ef4e66f`, tillsammans med avstängd databasinställning och frontendflagga. Bevara nya speldata.

## Banförlängning 26 oktober

Godkänt av användaren för direkt livepublicering: sex extra rutor i vart och ett av mellanrummen efter boss 2. Ny bana: 60 rutor, bossar på 6, 12, 24, 36, 48 och 60. Befintliga övningar, bossar och poäng behålls. Redan uppnådda gamla kontrollpunkter får interna kartkrediter; dessa är inte övningar och ger inte poäng. Gamla öppna klienter ombeds ladda om innan fler registreringar. Nya klienter anger board_size=60. Dagens bonus, personliga pjäser, nästa-boss-spärren och finaldatumet 31 oktober behålls.

Ändringen genomförs mot production enligt användarens förtydligande. Docker och lokal databas används inte för denna release. Enhets-/webbläsartester körs mot koden; databasändringen kontrolleras i production med tillfälliga, återställda transaktioner. Efter att nya steg har registrerats ska en eventuell återgång göras med datakompatibel kod, inte genom att återställa den gamla 36-rutorslogiken.

Banförlängningens riktade production-migration registrerades som `20261026101514_extend_final_adventure_after_second_boss.sql`. Befintlig produktionshistorik var oförändrad efter körningen: 20 övningar, två bossar och noll poängregistreringar.

## Glassfynd på ruta 18

Godkänt för livepublicering av användaren. Samma godkända design som den isolerade previewen används med spelarens verkliga tilldelade pjäs. Popupen köas efter andra öppna dialoger och visas efter ruta 18; deltagare som redan passerat får den vid nästa besök. Visningsstatus sparas per konto. Den kosmetiska kvitteringen ändrar inga övningar, poäng eller spelrevisioner och använder inte träningsregistreringens återförsökskö. Ett nätverksfel i kvitteringen hindrar inte nästa övning. Inga ljud spelas av popupen. Fokus, Escape, stängknapp och mobilstorlekar är kontrollerade.

Glassfyndet: riktad production-migration `20261026140345_add_icecream_discovery_at_tile_eighteen.sql` installerad. Den återställda production-kontrollen verifierar spärr före ruta 18, sparad visningsstatus, idempotens, oförändrade händelser/poäng/revision och nästa övning med samma revision. 139 enhetstester samt ruta-18- och hela 60-rutorsflödet passerar i webbläsaren.

## Engångsval på ruta 21 — 26 oktober

Godkänt för live av användaren, med särskilt krav på att båda alternativen bara ska kunna väljas en gång per konto. Ny popup med den godkända skogsbilden och spelarens verkliga pjäs. ”Ta genvägen” ger en extra kartposition (21 → 22), noll poäng och ingen extra träningsregistrering. ”Fortsätt på samma väg” visar den godkända fegis-/squats-texten, sparar valet och behåller ruta 21. Att bara stänga en obesvarad popup gör inget val; den kan öppnas igen via ”Välj din väg” i spelet. Träningen väntar på vägvalet när pjäsen står på ruta 21. Inga nya ljud.

Kontobeslutet `private.adventure_games.shortcut_choice` är permanent. Samma autentiserade, låsta RPC och revisionskontroll används som för övningar. Request-ID ger idempotens; nytt ID får inte ändra eller upprepa ett sparat val. En unik partiell indexregel tillåter högst en extra genvägskredit per konto. Krediten kopplas till ankomstövningen och räknas separat från övningar/poäng. Ångra får ta bort övningen och dess kartkredit, men beslutet återställs aldrig. Vid ny registrering till samma plats återfås samma engångskredit, aldrig flera eller ett nytt val. Så bevaras ångra utan att extrarutor går att stapla.

Riktade production-migrationer: `20261026202110_add_one_time_shortcut_at_tile_twenty_one.sql` och `20261026202243_qualify_shortcut_arrival_event.sql`. Den andra kvalificerar en kolumnreferens som det verkliga RPC-testet fångade innan frontend publicerades. Befintliga registreringar och poäng räknas inte om. Ny klient anger `shortcut_version:1`; gamla klienter på/efter ruta 21 ombeds ladda om. Min oktober anger också versionen. Vid läskontrollen före release hade ingen deltagare passerat ruta 21 (högsta position 18). Ingen retroaktiv bonus delas ut längre fram på banan.

Verifierat: 145 enhetstester; anslutet webbläsarflöde med den riktiga klientadaptern och isolerade RPC-svar på 320/390/768/1440; båda val, permanens efter omladdning/ångra, tappat svar efter sparat val, identiskt request-ID vid återförsök, andra enhetens val, alla personliga pjäser, standardpjäs och stäng/återöppning. Alla 60 rutor, sex bossar, datumspärr, slutlig poängjakt, bossljud, fanfar och konfetti passerar. Glassfyndet och nästa-boss-spärren passerar regression. `qa/adventure-shortcut-production-check.sql` spelar båda vägarna genom den verkliga production-RPC:n och rullar tillbaka samtliga tillfälliga konton/registreringar. Kontroll efteråt: noll testkonton kvar.

Säkerhetsadvisorn visar inga nya genvägsrelaterade fynd. Befintliga informationspunkter om RLS utan policy är avsiktlig nekad direktåtkomst till privata tabeller. Befintliga varningar om publika leaderboard-/bonusfunktioner och lösenordsskydd är oförändrade: [funktionsbehörigheter](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [lösenordsskydd](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Den här releasen ändrar inga sådana behörigheter eller Auth-inställningar.

Stående datum, bonusadmin, automatiskt avstängd utslagning vid missade dagar, personliga pjäsbindningar och bossarnas ljudregler är oförändrade. Den fristående designpreviewens HTML/JS/CSS/anteckningar exkluderas från production; den riktiga komponenten använder egna filer. Efter att någon fått en genvägskredit ska återgång ske med kompatibel klientkod, inte genom att återinföra en klient som bara kan läsa sexrutorskrediter.

## Skjuts på ruta 28 — 27 oktober

Användaren godkände livepublicering efter att ha sett previewen med de tecknade SVG-figurerna och förtydligandet om missad extraruta. Mötet använder samma konturer, färgfält och scenkänsla som bossarna samt deltagarens verkliga personliga/valda pjäs. Ja ger 28 → 29 och det trevliga samtalet. Nej behåller ruta 28, visar gubbens godkända avskedsreplik och den tydliga rutan ”Du missade en gratis extraruta. Du står kvar på ruta 28.” Inga ljud eller nya poäng.

Beslutet `private.adventure_games.ride_choice` sparas per konto. Autentiserad aktör, kontolås, förväntad revision och request-ID skyddar även detta val. Det kan inte ändras eller upprepas med ett nytt request-ID. Ett obesvarat, stängt möte kan öppnas igen via spelmenyn; träningen väntar på svaret på ruta 28. Ångra behåller båda besluten; om ankomstövningen ångras och görs om återkommer samma bonus, utan ett nytt val eller staplade bonusar.

Riktad production-migration: `20261027074512_add_one_time_ride_at_tile_twenty_eight.sql` (SHA-256 `e1f30f066b05e9e4ae43e48605ef439c099e0fe58f1cfe79abd68b6ce263533d`). Tidigare bonuskrediter klassificeras som genväg/äldre banförlängning utan omräkning. Skjutsen får en separat kreditkälla. En unik indexregel begränsar varje bonuskälla till en extraruta per konto, så båda mötena kan ge varsin ruta. Klienten validerar att bonusrutorna bara förekommer vid ankomst till 22 respektive 29 och kräver rätt sparat beslut. `ride_version:1` skyddar mot äldre klienter på/efter ruta 28; även Min oktober anger versionen. Befintliga registreringar, bossar, månads- och finalpoäng bevaras. Vid förkontrollen hade ingen passerat ruta 28 (max 18).

Verifierat: 150 enhetstester, anslutet webbläsartest med riktig klientadapter och isolerade RPC-svar vid 320/390/768/1440 px, alla personliga pjäser/standardpjäs, båda svaren, tydlig missad bonus, omladdning/ångra, långsamt svar/dubbelklick, tappat svar efter skrivning, identiskt request-ID vid återförsök och beslut från annan enhet. Hela spelresan med alla bossar, datumspärrar, poängjakt, valfria bossljud, fanfar och konfetti passerar. Genvägen på ruta 21 och glassfyndet passerar regression.

`qa/adventure-ride-production-check.sql` spelar genom den verkliga production-RPC:n för samtliga fyra kombinationer av val på ruta 21/28. Kontrollerar idempotens, permanent beslut, byte av val, klientversion, revision, felaktiga ID-/poängfält, ångra, separata kreditgränser, senare bossar och att först nya övningar vid slottet ger poäng. All testdata rullas tillbaka; efterkontroll visar noll testkonton. RLS/nekad direktåtkomst kvar. Säkerhetsadvisorn har samma tidigare fynd som ovan, utan nya för skjutsen.

Den gamla rasterillustrationen och den fristående previewen är bevarade i Git men exkluderade från production. Live laddar `adventure-ride.js`, `adventure-ride.css` och `ride-characters.js`. Ingen lokal testklocka, demodata eller previewväljare läggs på live. Docker används inte. Efter nya skjutsregistreringar ska eventuell återgång använda en klient som kan läsa båda bonuskällorna; äldre klienter ska inte återinföras över nya speldata.


## Glassfälla på ruta 33 — 27 oktober

Användaren godkände livepublicering efter den lokala previewn. Den tillhandahållna teckningen används utan censurruta; originalet är bevarat och runtimebilden är en förlustfri WebP med identiska RGB-pixlar. Samma glass som ruta 18 är först synlig. ”Ta upp och njut” avslöjar förtrollningen och flyttar 33 → 32. ”Strunta i den” visar lycklig-undanflykt-texten och behåller 33. Inga poäng eller träningsregistreringar tas bort. Inga nya ljud.

`private.adventure_games.icecream_choice` är permanent per konto. Samma autentiserade RPC, profil-/spellås, revisionskontroll och request-idempotens används. Svar från en annan enhet vinner över en äldre popup. En förlorad respons återförsöks med samma request-ID och låst val. Ett −1-kartbakslag av källan `icecream` binds till ankomstövningen, med högst en sådan rad per konto. Ångra behåller beslutet; om ankomsten ångras och görs om återställs samma enda bakslag. Normal återkomst från 32 till 33 visar ingen popup och ger inte ett nytt bakslag. Obesvarad stängning gör inget val och spelmenyn kan öppna kortet igen. Spelet väntar på svaret vid 33.

Riktad migration `20261027193153_add_one_time_icecream_trap_at_tile_thirty_three.sql`, SHA-256 `1e6d2c020224db627f1ad882fdb09900df29196b02d1b0122dfb4a3417d1551e`. Filen fick den registrerade servertidsstämpeln utan ändrat SQL-innehåll. Befintliga +1- och äldre +6-krediter bevaras. `icecream_version:1` krävs av äldre klienter på/efter 33 och efter valet; även Min oktober skickar versionen. Aktuell maxposition före och efter migration/test var 29. Alla 75 deltagarhändelser, tio deltagare och fem personliga bindningar bevarades. Inga riktiga minusposter eller testkonton skapades av releasen.

Verifierat: 159 enhetstester; hela lokala spelresan med bossar, opt-in-ljud, poängjakt och finalfirande; riktig klientadapter på 320/390/768/1440 med båda val, alla personliga/standardpjäser, dubbelklick, tappad respons, stale revision/andra enheten, gate/stäng/återöppning, omladdning, ångra och återkomst. `qa/adventure-icecream-production-check.sql` verifierar alla åtta kombinationer av 21/28/33 med autentiserad route setup och verklig publik RPC för nya valet. Den första provningen med publik topplisteberäkning även för alla hundratals uppbyggnadsanrop avbröts av testets 60-sekunderstimeout och rullades tillbaka. Den slutliga provningen använder samma autentiserade kommandofunktion för uppbyggnaden och passerar; inga tillfälliga Auth-/profilkonton finns kvar. Datum, 0 poäng under resan, bossblockering och poäng först vid slottet kontrollerades. Advisors visar inga nya fynd; tidigare dokumenterade befintliga varningar är oförändrade.

Testat och promoverat oförändrat production-bygge: `dpl_EY8pP27E21K634ANTH5Ha785YtRM`, `soberoktober-1nua30cvq-nuisance.vercel.app`. Rätt Supabaseprojekt och produktionsflagga verifierade, inget lokalt previewläge. Fristående ruta-33-preview, original-PNG, QA och migrationer exkluderas från drift. Återgång ska göras med datakompatibel klient/server; återinför inte klienten som inte kan läsa −1-poster när sådana väl finns.
