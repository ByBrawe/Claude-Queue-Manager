# Claude Queue Manager (QM) — Användarguide

[🌐 Swedish / Svenska](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager) · [MIT](../../LICENSE)

QM köar uppgifter i Claude Desktop (**Code**) eller Claude Code CLI. Varje uppgift startar som en separat tur först när den förra har avslutats, utan att styra om pågående arbete.

## “fortsätt”

`fortsätt` är vanlig uppgiftstext, inte ett särskilt QM-kommando. Kommandona `/qm` skrivs på engelska, men uppgifter kan vara på valfritt språk.

```text
/qm repeat 5 fortsätt
```

## Installation

Installera marketplace och plugin med kommandona nedan. Öppna sedan en ny lokal **Code**-session eller använd `/reload-plugins`. Den vanliga Chat-fliken stöds inte.

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

## Säker start

Pausa kön, lägg till uppgifter, kontrollera ordningen med `/qm` och fortsätt sedan.

```text
/qm pause
/qm batch Fixa tester som misslyckas || Kör bygget || Sammanfatta ändringarna
/qm
/qm resume
```

## Kommandon

| /qm | Kommandon |
| --- | --- |
| `/qm` | Öppna köpanelen |
| `/qm add fortsätt` | Lägg till en uppgift |
| `/qm repeat 5 fortsätt` | Upprepa en uppgift 1–200 gånger |
| `/qm batch A \|\| B \|\| C` | Lägg till olika uppgifter i ordning |
| `/qm front fortsätt` | Placera en uppgift först |
| `/qm pause  /qm resume` | Pausa / återuppta |
| `/qm mv 3 1` | Flytta uppgift 3 till plats 1 |
| `/qm edit 2 fortsätt` | Redigera väntande uppgift 2 |
| `/qm rm 2` | Ta bort väntande uppgift 2 |
| `/qm undo` | Ångra senaste ändringen |
| `/qm clear` | Rensa endast väntande uppgifter |
| `/qm recover` | Återställ en uppgift efter krasch och pausa |
| `/qm help` | Visa hjälp |

## Gränser och säkerhet

Högst **200 uppgifter per gång** och **500 väntande uppgifter**. Uppgifter kan förbruka modellkvot och kontext; en ny tur nollställer inte automatiskt 200K-kontexten. Upprepa inte ”fortsätt” utan tydligt slutvillkor. Ett svar garanterar inte framgång.

## Felsökning

Om `/qm` saknas, kontrollera pluginet och öppna en ny lokal **Code**-session. Inaktivera andra köplugin och prova först två korta uppgifter.

### ZIP

Packa upp ZIP-filen, behåll mappen `Claude-Queue-Manager` på en fast plats och kör:

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

> Obs: guiden är översatt, men QM-panelens gränssnitt är fortfarande på engelska.
