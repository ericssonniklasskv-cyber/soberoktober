# Oktoberderbyt – lokal prototyp

Starta från denna worktree:

```sh
cd ~/soberoktober-derby
npm run dev:derby
```

Öppna http://localhost:3001/. Befintlig testmiljö på port 3000 och production påverkas inte.

Branchen `feature/derby-local` startar från samma filinnehåll som main `0f6f201` (verifierad tree `53eb48c`). Inga migrationsfiler eller databasanslutningar tillkommer. Servern binder endast loopback och levererar enbart Derby-filer och design-systemets CSS. CSP blockerar nätverksanrop från sidan. Demon sparas i localStorage, separat från alla riktiga poäng. Motståndarnas poäng är fasta exempel, inte en live-topplista.

Period: 26 oktober 2026 kl. 00.00 till 31 oktober kl. 23.59.59 svensk tid. Slutgränsen i koden är 1 november kl. 00.00, exklusivt. Testverktygen låter oss prova framtida dagar innan premiären.

15 squats, 10 armhävningar, 5 pull-ups eller 2,5 km löpning ger ett demosteg per omgång. Prototypen antar 1 demopoäng per steg och 20 steg per visuellt varv utan att stoppa fortsatt registrering. Slutliga tävlingspoäng, dagliga gränser, bekräftelseregler, delade tävlingsdata och alternativa övningar återstår inför release. Ingen publicering eller main-merge ingår.

Desktop har en stor oval med ryttare. Mobil har fyra tydliga raka banor med samma poäng och placeringar. Historik, ångra, byte av testdag, återläsning, fliksynkning och minskad rörelse stöds. Fliksynkning är enkel lokal demosynkning; serverlagring med samtidighetsskydd behövs inför en riktig tävling.

Tester:

```sh
npm test
SOBER_BROWSER_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node derby/derby-ui.test.cjs
SOBER_BROWSER_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node derby/derby-audio-ui.test.cjs
```

Webbläsartestet startar en egen tillfällig server och kontrollerar 320, 390, 768 och 1440 px, registrering, placeringar, ångra, omladdning, testdagar, fliksynkning, varvning, tangentbord och skadad sparning. Skärmbilder sparas i `/private/tmp/derby-preview`.


Rösterna följer dagens mängd separat per övning: squats 15/30/45, armhävningar 10/20/30, pull-ups 5/10/15/20. Löpning ger Spring 1–5 efter respektive registrerad runda på 2,5 km. Det är tyst när dagens antal passerat sista inspelningen; ett lägre antal läses aldrig upp igen. Byte av testdag börjar en ny ljudserie. Ångra räknar tillbaka, och nästa registrering använder det korrigerade antalet. Omladdning eller uppdatering från en annan flik spelar inget ljud.

En ljudknapp stänger av eller slår på rösterna och sparar valet lokalt. Bara en röst spelas åt gången. Ljudfel påverkar inte en redan sparad övning. Originalfilerna på skrivbordet är orörda; kopior av de 15 valda filerna finns i `derby/audio/`. Inspelningar av typen Erik/Leader ingår inte. Den lokala servern levererar M4A som `audio/mp4` med byte-range-stöd för Safari.

Rösttestet kontrollerar faktisk AAC-uppspelning i Chrome, samtliga 15 filer, byte ranges, nivåval per dag, löpsträcka, ångra, sparat ljudval och att uppspelningsfel inte tappar en registrerad övning.
