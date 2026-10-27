# Ruta 33 — lokal preview av glassfällan

Öppna http://localhost:3002/adventure/icecream-trap-preview.html efter `npm run dev:adventure`.

- Samma spelkomponent används i previewn och i den vanliga lokala spelresan.
- Den först visade glassen är samma SVG som på ruta 18. Avslöjandet använder användarens bifogade teckning, utan censurruta.
- Original: `assets/enchanted-icecream.png`. Runtime: förlustfri WebP med samma bildinnehåll, `assets/enchanted-icecream.webp`.
- Ingen bildgenerering eller AI-redigering användes för den bifogade bilden.
- Ta glassen: 33 → 32. Träningsregistreringar finns kvar, inga poäng ändras.
- Avstå: stanna på 33. Ingen extra ruta ges.
- Valet blir permanent i respektive lokal sparning. Återbesök vid 33 ger ingen ny popup eller ytterligare förlust.
- Att ångra ankomstövningen tar bort dess förflyttning men behåller valet. När ankomsten registreras igen återställs samma enda bakslag. Ingen stapling.
- Previewn använder ett separat localStorage-prefix per testpjäs och påverkar inte den vanliga spelresan. Endast knappen ”Återställ bara detta test” nollställer previewvalet.
- X/Escape utan svar innebär inget val. Spelets lokala träningsknappar väntar fortfarande på beslutet.
- Previewns egna testknappar påverkar inte production. Den anslutna funktionen har släppts separat efter godkännande; se releaseavsnittet nedan.

## Release 27 oktober 2026

Användaren godkände livepublicering. Den vanliga spelresan använder nu samma kort i connected mode med autentiserad `icecream`-åtgärd. `private.adventure_games.icecream_choice` sparas permanent per konto. Ett källmärkt −1-bakslag binds till ankomstövningen. Kontolås, revision, request-ID och en unik indexregel skyddar mot upprepade val eller bakslag. `icecream_version:1` krävs på/efter 33 och efter ett sparat val; även Min oktober skickar versionen. Denna fristående preview är fortsatt lokal och läser ingen produktionsprogress.

Migration: `20261027193153_add_one_time_icecream_trap_at_tile_thirty_three.sql`, SHA-256 `1e6d2c020224db627f1ad882fdb09900df29196b02d1b0122dfb4a3417d1551e`. Installerad riktat utan generell db push, Docker eller ändring av tidigare migrationer. Alla åtta kombinationer med tidigare val på 21/28 verifierades genom återställda transaktioner. Testresans uppbyggnad går via samma autentiserade kommandofunktion; själva nya valet går genom den publika RPC:n. Inga testkonton sparades.

## Kontrollerat 27 oktober 2026

- `npm test`: 159 tester passerar, inklusive nio nya testfall för glassfällan.
- `node adventure/adventure-icecream-trap-ui.test.cjs`: båda valen i 320/390/768/1440 px, alla fem personliga pjäser samt standardpjäs, återkomst/omladdning, två flikar, X/Escape, långsam sparning/dubbelklick och blockerad localStorage. Även den riktiga lokala startsidan spelas från ruta 32 genom valet och vidare till 34.
- `node adventure/adventure-ui.test.cjs`: hela lokala 60-rutorsresan, bossar, valbara ljud, poängöppning och finalfirande passerar med den nya rutan.
- Original och WebP har identiska RGB-pixlar. Bilden visas med CSS-blandning mot spelbakgrunden; originalet är orört.
- Webbläsartesterna kördes i Chrome med mobila skärmstorlekar. Ingen fysisk iPhone/Safari har verifierats.
