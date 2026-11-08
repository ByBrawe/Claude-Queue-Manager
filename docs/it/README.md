# Claude Queue Manager (QM) — Guida all'uso

[🌐 Italian / Italiano](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager) · [MIT](../../LICENSE)

QM mette in coda le attività in Claude Desktop (**Code**) o Claude Code CLI. Ogni attività parte come turno separato dopo la fine del precedente, senza modificare quella in corso.

## “continua”

`continua` è normale testo del compito, non un comando speciale. I comandi `/qm` restano in inglese; le istruzioni possono essere in qualsiasi lingua.

```text
/qm repeat 5 continua
```

## Installazione

Installa marketplace e plugin con i comandi seguenti. Poi apri una nuova sessione locale **Code** o usa `/reload-plugins`. La normale scheda Chat non è supportata.

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

## Avvio sicuro

Metti in pausa la coda, aggiungi le attività, controlla con `/qm` e riprendi.

```text
/qm pause
/qm batch Correggi i test non riusciti || Esegui la build || Riassumi le modifiche
/qm
/qm resume
```

## Comandi

| /qm | Comandi |
| --- | --- |
| `/qm` | Apri il pannello della coda |
| `/qm add continua` | Aggiungi un'attività |
| `/qm repeat 5 continua` | Ripeti un'attività da 1 a 200 volte |
| `/qm batch A \|\| B \|\| C` | Aggiungi più attività in ordine |
| `/qm front continua` | Sposta un'attività in cima |
| `/qm pause  /qm resume` | Metti in pausa / riprendi |
| `/qm mv 3 1` | Sposta l'attività 3 in posizione 1 |
| `/qm edit 2 continua` | Modifica l'attività 2 in attesa |
| `/qm rm 2` | Rimuovi l'attività 2 in attesa |
| `/qm undo` | Annulla l'ultima modifica |
| `/qm clear` | Svuota solo le attività in attesa |
| `/qm recover` | Ripristina un'attività dopo un arresto improvviso e metti in pausa |
| `/qm help` | Mostra la guida |

## Limiti e avvertenze

Massimo **200 attività per inserimento** e **500 in attesa**. Ogni attività può consumare quota e contesto; il contesto 200K non si azzera automaticamente tra i turni. Non ripetere « continua » senza una condizione di arresto. Una risposta non prova il completamento corretto.

## Risoluzione dei problemi

Se `/qm` non compare, verifica il plugin e riapri una sessione **Code** locale. Disattiva altri plugin per la coda e prova prima due attività brevi.

### ZIP

Estrai il file ZIP, mantieni la cartella `Claude-Queue-Manager` in una posizione stabile e poi esegui:

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

> Nota: questa guida è tradotta, ma l'interfaccia del pannello QM resta in inglese.
