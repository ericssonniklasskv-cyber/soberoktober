# Personliga spelpjäser

Skapade med det inbyggda bildverktyget (`image_gen`) utifrån deltagarnas inskickade bilder och spelets befintliga tecknade ryttare som stilreferens. PNG-filerna har riktig transparens; originalbilderna är orörda och kopieras inte in i projektet.

| Deltagare | Personlig pjäs | Bildfil |
| --- | --- | --- |
| MikeB | Grip | [mikeb.png](mikeb.png) |
| Jerka | Bergsbagge | [jerka.png](jerka.png) |
| Zellmani | Enhörning | [zellmani.png](zellmani.png) |
| Elliott da bomb | Skogssköldpadda | [elliott-da-bomb.png](elliott-da-bomb.png) |
| Nillebae | Kungsgås | [nillebae.png](nillebae.png) |

De fullständiga slutprompterna, referensfilernas sökvägar och bildverktygets ursprungliga utdata finns i [generation-prompts.json](generation-prompts.json). Varje figur genererades separat med deltagarfotot som identitetsreferens och samma ryttare som stilreferens. Ansikte, frisyr och tydliga kännetecken behölls: exempelvis Elliotts glasögon/mustasch och Nillebaes röda presentrosett.

Tilldelningen finns i `adventure-personal-pawns.js`. Alla fem har låsta personliga pjäser. Bara deltagare utan tilldelad bild får välja någon av de sex vanliga djurryttarna. Den personliga figuren används på kartan, i listor, på bosskort och i finalfirandet.

Detta är en lokal prototyp. Testdeltagaren väljs i testverktygen; det är ingen riktig inloggning och samma testresa behålls när visningsdeltagaren byts. Inför en framtida liveintegration ska tilldelningen knytas till verifierad användaridentitet. Inget har publicerats.
