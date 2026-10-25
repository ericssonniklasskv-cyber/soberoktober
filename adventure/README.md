# Frestelsernas rike — lokal startsida för finalveckan

Finalveckans nya riktning: ett fantasybrädspel om att stå emot alkoholfrestelser. Alla färdas på samma bana. Övningar ger ett steg; de fem första bossarna stoppar fortsatt förflyttning tills spelaren bekräftat att bossens uppdrag är gjort och delat i gruppen. Riket ger inga poäng. När spelaren når Hangover castle på ruta 36 öppnas poängjakten för nya övningar. Bakrusbaronen väntar till den 31 oktober och blockerar inte poängregistreringen.

## Starta

```sh
cd ~/soberoktober-derby
npm run dev:adventure
```

Öppna http://localhost:3002/. Servern binder enbart loopback och kan endast läsa äventyrets egna HTML/CSS/JS, bildresurser och de sex bossljuden samt finalfanfaren. Inga konfigurations-, databas- eller authanrop görs. CSP förbjuder externa anslutningar och tillåter enbart lokalt ljud.

Derbyversionen är kvar i `derby/`, med egen sparning och startkommandot `npm run dev:derby` på port 3001. Återgång kräver inte återställningsskript eller att skriva över några filer. Den senaste sparade derbyversionen är commit `93d9713` på `feature/derby-local`. Äventyret utvecklas på `feature/final-adventure-local`; inget ska publiceras eller mergas till main utan uttryckligt godkännande.

## Vad som går att prova

- 36 rutor, sex kapitel och bossar vid ruta 6, 12, 18, 24, 30 och 36.
- Fyra övningstyper: squats, armhävningar, pull-ups och löpning. På banan ger 15, 10, 5 repetitioner respektive 1 km exakt en ruta och noll poäng.
- Vid ankomsten till ruta 36 ger nya 15 squats, 10 armhävningar, 5 pull-ups eller 1 km löpning 1 poäng per registrering. Pjäsen står kvar på ruta 36. Resans tidigare övningar och bossuppdrag ger inga poäng i efterhand.
- Poäng för testdagen och totalt, poängposter i resedagboken samt ångra senaste poängregistrering. Poäng och upplåsning sparas mellan dagar och omladdningar. Poäng kan registreras från dagen då spelaren nådde slottet till och med 31 oktober; en tidigare testdag låser knapparna.
- Bakrusbaronens bosskort och uppdrag är låsta före den 31 oktober, även via kartans förhandsvisning och direkt logikanrop. Poängjakten fungerar både före och efter slutbossen. I testverktygen kan du växla mellan 30 och 31 oktober för att prova datumlåset.
- En sammanhängande resa mellan dagarna 26–31 oktober. Bossen och positionen ligger kvar efter omladdning och byte av testdag.
- Större bossmöten som en arcadescen: spelarens valda djurryttare möter en hel bossfigur i samma tecknade SVG-stil, med VS-markering och en egen segerbild. Varje möte börjar med en kort berättelse om kapitlet och följs av två egna repliker från bossen, visuellt åtskilda från berättartexten. Därefter förklarar berättelsen varför just bossens uppdrag öppnar vägen vidare, exempelvis vin-gnomens dimma som bara går att se igenom upp och ner. Bossens alkoholkrav för att släppa förbi spelaren är uttryckligt. Varje boss har ett fast gruppuppdrag. Spelaren gör uppdraget, delar själv i gruppen och klarmarkerar sedan i spelet. Det finns inga A/B-val eller timer för dessa uppdrag, och inget skickas automatiskt.
- Bosslås både i gränssnittet och i den validerande spellogiken. Att stänga ett kort, byta dag eller skicka ett direkt logikanrop kan inte lägga till ett steg förbi en obeseg­rad boss.
- Valfri bossröst på varje bosskort. Den tydliga knappen **Spela ljud** startar ljudet; inget spelas eller hämtas automatiskt. Knappen blir **Stoppa ljud** under uppspelning. Ljudet stannar när kortet stängs (även Escape), bossen klaras, ett annat kort öppnas eller fliken lämnas. Efter avslut kan ljudet spelas om. Ljudfel visar en möjlighet att försöka igen och blockerar aldrig uppdraget. Bakrusbaronens datumlås gäller även hans ljudknapp.
- Segerkort efter varje boss med den sammanlagda ställningen: Pannben 1–0 efter första bossen, 2–0 efter andra och så vidare; finalfirandet visar 6–0. Antalet kommer från sparade besegrade bossar, så ångra och omladdning påverkar ställningen korrekt. När Bakrusbaronen klaras den 31 oktober tar ett eget firande över hela skärmen: 31 dagar av Sober Oktober, vald djurryttare i guldkrans, tät konfetti med flera kanoner och en egen brass- och trumfanfar på full spelarvolym. Fanfaren startar direkt från klarmarkeringen och har en tydlig stoppknapp. Fira igen startar om effekterna. Stängning, sidbyte och byte av flik stannar både ljud och animation; omladdning startar inget firande. Vid reducerad rörelse visas ett stilla konfettiregn. Bossseger ger inga extra poäng eller träningssteg.
- Fem personliga, bildbaserade fantasiryttare för MikeB, Jerka, Zellmani, Elliott da bomb och Nillebae. Dessa deltagare har tilldelad pjäs och kan inte öppna eller använda pjäsvalet. Övriga väljer bland de sex vanliga djurryttarna. Alla färdas på samma karta och har olika pjäser. [Bilder, tilldelning och fullständiga bildprompter](assets/players/README.md).
- Högst tre synliga miniatyrer på samma ruta och en tydlig +N-knapp som visar alla på rutan. Ingen deltagare försvinner ur listan för att rutan är trång.
- På mobil viks samma rutordning om till tre kolumner. Kartan kan rullas, har ”Hitta min pjäs” och kapitelgenvägar. Fyra träningsknappar direkt under kartan låter spelaren se rörelsen medan den registreras.
- Ångra den senaste händelsen, resedagbok och lokal återläsning. Ångrad boss blir åter blockerande; ångrat träningssteg flyttar tillbaka en ruta. Ångrade poäng påverkar bara poängsumman, en ångrad slutboss lämnar poängjakten öppen. Först om själva ankomsten till ruta 36 ångras låses poängjakten igen.

## Bossar

| Kapitel | Ruta | Frestelse |
| --- | ---: | --- |
| Beer o' forest | 6 | Attraktiva Öl-Orcen |
| Boulevard of wine | 12 | Sexiga vin-gnomen |
| Ravine of shots | 18 | Shotsdraken |
| The prosecco mountains | 24 | Proseccohäxan |
| The last dance | 30 | Nattklubbsgollum |
| Hangover castle | 36 | Bakrusbaronen |

På kartan och i kapitelöversikten används användarens originalbild `assets/beer-orc.png` och fem nya porträtt skapade med det inbyggda image_gen-verktyget med orcen som stilreferens. Varje boss har en egen miljö i samma detaljrika fantasyvärld. [Alla bildfiler och slutliga prompter](assets/boss-portrait-prompts.md) finns sparade i projektet. Den tidigare atlasen `assets/temptation-bosses.png` finns kvar som referens. I själva mötesscenen används sex egna helkroppsfigurer från `adventure-bosses.js`, med samma konturer och färgstil som spelarpjäserna. Kartan, landmärken och djurpjäserna är också kodbaserad SVG; DOM-knappar ger tangentbordsåtkomst och läsbara namn.

## Vad som är testvärden eller återstår

Banlängden 36 rutor är fortsatt ett testvärde. Övningsmängderna och poängfasen följer de senast valda reglerna ovan. Temats avsedda period är måndag 26 oktober till lördag 31 oktober 2026 kl. 23.59.59 svensk tid; lokal prototyp kan provas i förväg och blockerar inte på verklig klocka.

Namn och personliga pjäser kommer från de fem deltagarna, men medspelarnas positioner är fasta demonstrationsexempel, inte inloggade deltagare. Databaskopplingen är nu förberedd och testad lokalt i ett separat anslutet läge, beskrivet nedan. 3002-demot behåller sin lokala sparning och sina exempeldata. Nuvarande localStorage-fliksynkning är enkel demosynkning, inte ett system för samtidig flerspelardata. Ingen riktig tävlingspoäng ändras av prototypen.

## Tester

```sh
npm test
SOBER_BROWSER_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node adventure/adventure-ui.test.cjs
```

Enhetstester granskar händelsesekvenser, bosslås, ångra, datum, skadad sparning och finalgränsen samt att poäng är låsta fram till slottet, att nya registreringar ger poäng före finalen och att finalbossen bara kan öppnas och klaras den 31 oktober. Webbläsartestet startar en egen tillfällig lokal server, provar 320/390/768/1440 px, djurval, trånga rutor, mobilknappar, alla 36 steg och sex bossar, gruppuppdrag och klarmarkering, omladdning, dagsskifte, ångra, final, resedagbok, tangentbord, skadad sparning och hela poängfasen med rätt löpsträcka, dagssummor, ångra, återlåsning vid ångrad ankomst och finalens datumlås. Skärmbilder finns i `/private/tmp/adventure-preview`. Webbläsartestet spelar och avkodar samtliga sex lokala bossljud, kontrollerar frivillig start, stopp/omspelning/slut, stängning, bossseger och återhämtning vid ljudfel samt HTTP byte ranges för Safari. Finalen provas också med automatisk segerfanfar, stopp/omspelning/ljudfel, helskärm på alla fyra bredder, animerad och stilla konfetti samt att ljud och animation stannar vid stängning utan att ändra poängen. Ingen extern API-trafik tillåts.


## Aktuella gruppuppdrag

1. Attraktiva Öl-Orcen: filma en kullerbytta och dela klippet i gruppen.
2. Sexiga vin-gnomen: filma ett försök att stå på händer och dela klippet i gruppen. Försöket räknas.
3. Shotsdraken: ta en tidig morgonpromenad och dela en bild eller ett klipp i gruppen.
4. Proseccohäxan: kicka en boll 10 gånger och dela ett klipp i gruppen. Inget krav på tio i följd.
5. Nattklubbsgollum: gör en kreativ bottle flip med vattenflaska och dela klippet i gruppen.
6. Bakrusbaronen: filma ditt finaste glädjeskutt som en sann soktoberian och dela klippet i gruppen.

Äldre lokala sparningar med de tidigare A/B-valen läses in och normaliseras till de nya uppdrags-ID:na utan att förlora position eller besegrade bossar. Pensionerade val kan inte användas för ny klarmarkering. Delning i gruppen är en egen handling utanför prototypen; knappen bekräftar deltagarens egen uppgift och verifierar inte videon.

Nya löprutor sparas som 1 km. Tidigare registrerade löprutor på 2 km behåller sin distans; äldre lokala löprutor utan sparad distans behåller 2,5 km i historiken. Äldre sparningar med en för tidigt klarad Bakrusbaron läses in som framme vid slottet med fem besegrade bossar. Redan insamlade poäng bevaras; finalbossen öppnas igen den 31 oktober. Sparformatet uppdateras från version 1 till 2.

## Bossljud

Användarens sex slutversioner från `~/Desktop/Finalveckan/` har konverterats till AAC i M4A-behållare (stereo, 48 kHz, cirka 128 kbit/s). Originalen är orörda och kopieras inte in i Git. De sex webbversionerna väger sammanlagt cirka 5,3 MB och laddas först vid uttryckligt klick. Servern svarar med `audio/mp4`, `Accept-Ranges: bytes` och stöd för delhämtning.

| Boss | Original | Webbfil | Längd |
| --- | --- | --- | ---: |
| Attraktiva Öl-Orcen | attraktiva öl orcen - final.aifc | `audio/beer-orc.m4a` | 61 s |
| Sexiga vin-gnomen | Vin-gnome final.aifc | `audio/wine-gnome.m4a` | 60 s |
| Shotsdraken | Shotsdrake - final.aifc | `audio/shots-dragon.m4a` | 56 s |
| Proseccohäxan | prosecco - final.aifc | `audio/prosecco-witch.m4a` | 59 s |
| Nattklubbsgollum | gollum - final.aifc | `audio/nightclub-gollum.m4a` | 66 s |
| Bakrusbaronen | bakrus - final.aifc | `audio/hangover-baron.m4a` | 67 s |

Konvertering på macOS:

```sh
afconvert -f m4af -d aac -b 128000 -q 127 'original.aifc' 'boss.m4a'
```

## Finalfirandet

`adventure-finale.js` och `finale.css` sköter helskärmsfinalen inom dialogens översta lager. Konfetti ritas på canvas med högst 1 000 aktiva partiklar på mobil / 1 600 på stor skärm, nya kanonsalvor och regn i 14 sekunder och en avslutande uttoning efter cirka 23 sekunder. Effekter och lyssnare städas vid stängning och omspelning. Reducerad rörelse ger ett stilla konfettifält med 240 partiklar.

`audio/final-fanfare.m4a` är en egen, syntetiserad fanfar med 24 slag i C-dur med brass, trummor och cymbaler (cirka 13 sekunder). Den bygger inte på externa ljud eller kompositioner. Originalmixen ligger på 94 % toppnivå utan klippning; spelaren använder volym 1 och ändrar inte enhetens volym. Källan finns i `scripts/generate-adventure-fanfare.py` (NumPy), följt av AAC-konvertering med `afconvert -f m4af -d aac -b 192000 -q 127`. Bossarnas sex inspelningar är orörda.

## Prova personlig pjäs

Öppna **Testverktyg och om den här skissen → Testdeltagare**. Välj MikeB, Jerka, Zellmani, Elliott da bomb eller Nillebae: den personliga bilden visas överallt och knappen Byt din pjäs försvinner. Välj **Utan personlig bild · välj pjäs** för de sex vanliga valen. Tilldelningen styrs av registret och ignorerar sparat vanligt djurval för en deltagare med bild. Namnmatchningen hanterar versaler, gemener och extra mellanslag. Ett tidigare vanligt val finns kvar när du går tillbaka till deltagare utan bild. Vald testdeltagare sparas lokalt; testresa och poäng behålls vid bytet.

Deltagarväljaren är en lokal visningsfunktion, inte behörighetskontroll för en inloggad tjänst. Före publicering behöver tilldelningen kopplas till den verifierade användaren, helst stabilt användar-ID. Ingen databas eller production har ändrats.

```sh
SOBER_BROWSER_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node adventure/adventure-pawns-ui.test.cjs
```

## Startsidan på 3002

Den befintliga lokala sidan på `http://localhost:3002/` visar tre huvuddelar: Frestelsernas rike, topplistan och senaste aktivitet. Menyn ger genvägar till alla tre och ett konto med regler, resedagbok och möjlighet att återvisa sin pjäs. Dagens bonus ligger i en kompakt utfällbar del av spelpanelen. Den gamla sidokolumnen med samma deltagarlista är ersatt av topplistan; alla pjäser kan fortfarande visas via länken vid riket eller när flera delar en ruta.

Topplistan visar **demopoäng**, med val för hela oktober eller bara finalveckan. Tidigare oktoberpoäng är fasta exempelvärden och representerar inte deltagarnas riktiga poäng. Den valda testdeltagarens nya poäng från poängjakten och lokala bonusmarkeringar uppdaterar listan direkt. Förflyttningar och bosssegrar ger fortfarande 0 poäng. Lika resultat delar placering, med genomförda exempeldagar som sekundär ordning för månadsvyn. Aktivitetsflödet blandar tydligt märkta exempel från medspelarna med den egna testresans händelser. Nya aktiviteter, bonus och ångra uppdaterar flödet.

**Testverktyg → Testroll** växlar mellan Deltagare och Administratör. Admin-knappen är dold för deltagaren och öppnar en lokal bonusredigerare i administratörsläget. Redigeraren sparar endast en testbonus per testdag i localStorage. Bonus kan klarmarkeras/ångras och ger 1 testpoäng, separat från resan. En återställd testresa nollställer också den valda testdeltagarens lokala bonuspoäng.

Detta är en visuell, fungerande lokal förhandsvisning. Rollen är ett testval, inte riktig behörighetskontroll. Riktig topplista, aktivitetsström, adminbehörighet, konto och utloggning ska använda befintlig verifierad inloggning/backend inför en framtida release. Den riktiga `index.html`, adminmiljön, Supabase och production är inte ändrade.

## Första besöket med personlig pjäs

När en deltagare med personlig pjäs visas första gången öppnas en stor presentation: **”[Namn], din hjälte är här!”**, den egna figuren och en egen humoristisk text. Den visas en gång per deltagare och finalvecka i samma webbläsare, med localStorage och minne som reserv. Vanliga deltagare utan bild får ingen sådan popup. Kontomenyns **Visa min pjäs igen** öppnar den manuellt.

Introduktionen kommer före ett automatiskt väntande bossmöte. När presentationen stängs eller bekräftas visas bossen, och alla spelregelspärrar består. Klarmarkeringar, resa och poäng påverkas inte. Introduktionen spelar inget ljud automatiskt. Första-besöksflaggan behöver knytas till verifierad användare om den senare ska gälla över flera enheter.

```sh
SOBER_BROWSER_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node adventure/adventure-home-ui.test.cjs
```

Hemsidestestet kontrollerar de tre sektionerna, fyra bredder, deltagar-/adminvisning, testbonus, direkt uppdatering av topplista och aktivitet, ångra, alla fem personliga introduktioner, första-besökslagring, manuell återvisning och att väntande bossar inte kan kringgås. De befintliga spel- och pjäsregressionerna är också körda på den nya startsidan.

## Förberedd datakoppling inför publicering

Den isolerade designversionen på 3002 finns kvar. En ny ansluten version använder samma karta och gränssnitt, men riktig lokal Supabase Auth och serverlagring. Starta efter den lokala migrationen:

```sh
cd ~/soberoktober-derby
npm run dev:adventure:connected -- --date=2026-10-26
```

Öppna `http://localhost:3003/dev/login.html`, välj ett befintligt lokalt testkonto och öppna sedan `http://localhost:3003/adventure/?live=1`. Start utan `--date` använder verklig svensk servertid. Datumargumentet ersätter **bara den lokala äventyrsklockan** medan servern kör; den riktiga klockan återställs vid Ctrl+C. Ingen production-konfiguration eller hemlig nyckel exponeras. Första start kräver att migrationen är applicerad lokalt; inga migrationskommandon körs automatiskt.

Anslutet läge accepterar enbart den verifierade inloggade användaren. Det läser aldrig testresan, testrollen eller deltagarväljaren från localStorage. De fem personliga pjäserna binds uttryckligen till de verifierade production-konto-ID:na i den förberedda migrationen; en ändrad namnskylt överför inte pjäsen. Välkomstintroduktionen sparas på kontot och följer med mellan webbläsare. Admin leder till den befintliga adminmiljön med serverkontrollerad behörighet. Dagens bonus använder den riktiga adminuppgiften och dess konfigurerade poäng.

Privata tabeller har RLS och saknar direkt klientåtkomst. Ett autentiserat kommando (`my_adventure`) beräknar serverdatum, bosslås och poäng, låser kontot vid skrivning och använder revisionskontroll och unika registrerings-ID:n. Samma anrop kan skickas igen efter ett tappat svar utan en extra registrering. Fel och synkproblem nollställer aldrig resan. Andra deltagares positioner och aktivitet uppdateras normalt var 15:e sekund, när fliken får fokus eller via Uppdatera resan.

Topplistan återanvänder månadens riktiga tidigare poäng och lägger till nya poängjaktsregistreringar och bonusar. Resan och bossar ger 0 poäng, men räknas som aktivitet för dagen. Min oktober och slutrapporten räknar också de nya resultaten. Äldre teman och deras kudos ligger kvar i aktivitetsflödet. Det gamla dagens pass spärras på servern under den aktiverade finalveckan. Utslagning för missade dagar förblir avstängd; alkoholstatus hanteras som tidigare.

De sex aktiva bossporträtten och fem personliga pjäserna har komprimerade WebP-kopior. PNG-originalen finns kvar. Ljud hämtas fortfarande först när det spelas.

```sh
npm run test:adventure:connected
```

Testet skapar tillfälliga lokala Auth-konton och städar dem, bonusfixturen, klockan och aktiveringen efteråt. Det testar verkliga RPC-anrop, samtidiga registreringar, återförsök efter tappat svar, 36 rutor, bossar, poäng, ångra, start/slutdatum, bonus, inloggning, mobil, flera webbläsare, finalfirande och Min oktober. Kör inte samtidigt med manuella anslutna tester som ändrar äventyrsklockan.

[Releaseunderlag och kvarvarande production-kontroller](../qa/final-adventure-release.md). Ingen publicering, push eller production-migration har utförts under förberedelsen.
