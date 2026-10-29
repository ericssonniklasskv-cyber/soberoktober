# Den sista sträckan — separat designpreview

Öppna `http://localhost:3002/adventure/final-approach-preview.html` efter `npm run dev:adventure` i repot. Befintliga bossfigurer och personliga pjäser återanvänds. Previewn börjar med orcens popup på ruta 55. Stäng den och välj **Testa nästa ruta** för att gå igenom hela förslaget. **Börja om** startar på ruta 54. Klicka på en boss för att läsa om hälsningen utan att flytta testpjäsen.

| Ruta | Besegrad boss |
| --- | --- |
| 55 | Attraktiva Öl-Orcen |
| 56 | Sexiga vin-gnomen |
| 57 | Shotsdraken |
| 58 | Proseccohäxan |
| 59 | Nattklubbsgollum |
| 60 | Bakrusbaronen — befintlig final, inte ändrad |

Det är en hederskorridor: bossarna minns respektive uppdrag, erkänner spelarens seger och peppar inför finalen. Ingen ny frestelse, uppgift, bonus, förflyttning eller poäng. Spelarens pjäs står mitt emot bossen i samma figurstil. Varje ruta får en egen text och ett tydligt sätt att gå vidare. Allt är ett minnesbaserat test; omladdning återställer previewn. De fem personliga pjäserna och den vanliga reservpjäsen går att förhandsgranska. Tilltalet följer vald deltagare, exempelvis ”Mästare Zellmani”. Reservpjäsen använder demonamnet ”Äventyraren”.

Endast dessa previewfiler och exkluderingen i `.vercelignore` hör till ändringen. Ingen koppling till riktiga konton, Supabase, spelprogression, bossljud eller finalfanfar. Previewfilerna är fortsatt lokala. Den godkända designen är från 29 oktober inkopplad i livespelet genom adventure-salutes.js och adventure-salutes.css.

Den separata liveversionen har: automatisk visning en gång per konto och hälsning, endast efter respektive boss har besegrats, samt bakåtkompatibel hantering av deltagare som redan passerat rutorna. Befintlig finaldatumspärr och poängupplåsning är bevarade. Denna preview implementerar inte dessa produktionsskrivningar.
