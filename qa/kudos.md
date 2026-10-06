# Kudos – lokal förhandsvisning

Kudos finns i huvudsidan (max fyra aktiviteter) och `/aktivitet/`.
Deltagaren kan skicka en enkel kudos eller en privat hälsning, högst 300 tecken.
Egna aktiviteter har ingen knapp. En avsändare kan skicka en kudos per feed-händelse.
Mottagaren öppnar **Dina kudos**; olästa hälsningar markeras i inkorgsknappen.
Läststatus lagras i databasen och återanvänds på andra enheter.

## Databas och integritet

Migreringen `20261006193050_add_private_activity_kudos.sql` är applicerad endast på lokal Supabase.
`private.activity_kudos` har RLS och inga direkta klientprivilegier. Auth-kontrollerade privata funktioner bakom begränsade publika RPC:er avgör avsändare/mottagare på servern.
Aktivitetsnyckeln identifierar en händelse, aldrig en användare. Inga användar-UUID:n eller e-postadresser läggs till i feed-payloaden.
Publika `get_activity_feed` behåller exakt samma fält och sortering. Ett gemensamt privat event-underlag används även för den autentiserade feeden och mottagarsökningen.
Texten i en hälsning returneras endast till mottagaren. Avsändaren får bara skickatstatus.
Dubbla/konkurrerande skickningar skapar en rad och ersätter inte tidigare text eller läststatus.
Avmarkerade bingohändelser tar inte emot nya kudos. Redan skickade privata hälsningar ligger kvar.
Poäng, utslagsregler och aktivitetsregistrering påverkas inte.

## Verifiering

- 19 SQL-kontroller med tre isolerade användare i BEGIN/ROLLBACK: ägarskap, egen aktivitet, dubbletter, trimmad text, maxlängd, rå tabellåtkomst, RPC-behörigheter, läststatus, tillbakadragen bingoaktivitet och oförändrad publik payload.
- `qa/kudos-local-e2e.cjs`: verklig lokal Auth och PostgREST; åtta samtidiga skickningar ger en notis; privat text och XSS-säker rendering; läststatus på två enheter; omladdning, nätverksfel/retry, utloggning, båda flöden och 320/390/768/1440 px. Alla tillfälliga testkonton tas bort efter körning.
- Befintliga logiktester (41) passerar: bingo, bonus, rapporter, datum, aktivitetsformatering och stegtrappa.
- Befintlig steg-sparning och adminbingo testade separat med Chrome-fixtures.
- Adminrättnings-testets mock-route uppdaterad för befintlig versionsparameter i script-URL:n; ingen adminfunktion ändrad.
- Lokala Supabase security/performance advisors: `No issues found`.
- Manuell visuell kontroll med lokal Test Anna: knappar, skickruta, valfri text, privattextförklaring och bibehållen design.

## Förhandsvisning

Separat server på `http://localhost:3842/dev/login.html`, med befintliga lokala testkonton och lokal Supabase på 54321. Den andra arbetskopian och port 3000 ändras inte.
Startskript på denna dator: `/private/tmp/sober-kudos-preview.mjs`.

Ingen push eller produktion-deploy gjord. Vid godkänd publicering behöver migreringen appliceras på **soberoktober** (projekt `usbcwnirgkkfmluukria`) och frontend deployas tillsammans. Den tidigare lokala steg-sparfixen är också kvar på main och ska följa med när detta godkänns för live.
