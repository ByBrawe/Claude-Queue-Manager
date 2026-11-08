# Claude Queue Manager (QM) — Gebruikershandleiding

[🌐 Dutch / Nederlands](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager) · [MIT](../../LICENSE)

QM zet taken in een wachtrij in Claude Desktop (**Code**) of Claude Code CLI. Iedere taak start als afzonderlijke beurt nadat de vorige is afgerond, zonder de lopende taak bij te sturen.

## “ga verder”

`ga verder` is gewone taaktekst, geen speciaal commando. `/qm`-sleutelwoorden blijven Engels, maar opdrachten kunnen in elke taal worden geschreven.

```text
/qm repeat 5 ga verder
```

## Installatie

Installeer de marketplace en plug-in met onderstaande opdrachten. Open daarna een nieuwe lokale **Code**-sessie of gebruik `/reload-plugins`. Het gewone Chat-tabblad wordt niet ondersteund.

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

## Veilige start

Pauzeer de wachtrij, voeg taken toe, controleer de volgorde met `/qm` en hervat.

```text
/qm pause
/qm batch Herstel falende tests || Voer de build uit || Vat de wijzigingen samen
/qm
/qm resume
```

## Opdrachten

| /qm | Opdrachten |
| --- | --- |
| `/qm` | Open het wachtrijpaneel |
| `/qm add ga verder` | Voeg één taak toe |
| `/qm repeat 5 ga verder` | Herhaal een taak 1–200 keer |
| `/qm batch A \|\| B \|\| C` | Voeg verschillende taken op volgorde toe |
| `/qm front ga verder` | Plaats een taak vooraan |
| `/qm pause  /qm resume` | Pauzeren / hervatten |
| `/qm mv 3 1` | Verplaats taak 3 naar positie 1 |
| `/qm edit 2 ga verder` | Bewerk wachtende taak 2 |
| `/qm rm 2` | Verwijder wachtende taak 2 |
| `/qm undo` | Maak de laatste wijziging ongedaan |
| `/qm clear` | Wis alleen wachtende taken |
| `/qm recover` | Herstel een taak na een crash en pauzeer |
| `/qm help` | Toon hulp |

## Limieten en aandachtspunten

Maximaal **200 taken per keer** en **500 wachtende taken**. Taken verbruiken mogelijk modelquotum en context; een nieuwe beurt wist de 200K-context niet automatisch. Herhaal 'ga verder' niet zonder duidelijke stopvoorwaarde. Een antwoord garandeert geen geslaagde uitvoering.

## Problemen oplossen

Ontbreekt `/qm`? Controleer de plug-in en open een nieuwe lokale **Code**-sessie. Schakel andere wachtrijplug-ins uit en test eerst met twee kleine taken.

### ZIP

Pak het ZIP-bestand uit, bewaar de map `Claude-Queue-Manager` op een vaste locatie en voer uit:

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

> Opmerking: deze handleiding is vertaald; de interface van het QM-paneel blijft Engels.
