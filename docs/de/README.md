# Claude Queue Manager (QM) — Benutzerhandbuch

[🌐 German / Deutsch](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager) · [MIT](../../LICENSE)

QM verwaltet Aufgaben in Claude Desktop (**Code**) oder Claude Code CLI. Jede Aufgabe startet erst nach Abschluss des vorherigen Hauptdurchlaufs als eigener Durchlauf – ohne die laufende Aufgabe umzulenken.

## “mach weiter”

`mach weiter` ist normaler Aufgabentext, kein spezieller QM-Befehl. Befehle wie `/qm repeat` bleiben auf Englisch; den Aufgabentext kannst du in jeder Sprache schreiben.

```text
/qm repeat 5 mach weiter
```

## Installation

Installiere den Marketplace und das Plugin mit den folgenden Befehlen. Öffne danach eine neue lokale **Code**-Sitzung oder verwende `/reload-plugins`. Der normale Claude-Chat unterstützt dieses Plugin nicht.

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

## Sicherer Schnellstart

Warteschlange pausieren, mehrere Aufgaben hinzufügen, mit `/qm` prüfen und anschließend fortsetzen.

```text
/qm pause
/qm batch Fehlgeschlagene Tests beheben || Build ausführen || Änderungen zusammenfassen
/qm
/qm resume
```

## Befehle

| /qm | Befehle |
| --- | --- |
| `/qm` | Warteschlangen-Panel öffnen |
| `/qm add mach weiter` | Eine Aufgabe hinzufügen |
| `/qm repeat 5 mach weiter` | Gleiche Aufgabe 1–200 Mal hinzufügen |
| `/qm batch A \|\| B \|\| C` | Unterschiedliche Aufgaben der Reihe nach hinzufügen |
| `/qm front mach weiter` | Aufgabe an den Anfang setzen |
| `/qm pause  /qm resume` | Pausieren / fortsetzen |
| `/qm mv 3 1` | Wartende Aufgabe 3 auf Platz 1 verschieben |
| `/qm edit 2 mach weiter` | Wartende Aufgabe 2 bearbeiten |
| `/qm rm 2` | Wartende Aufgabe 2 entfernen |
| `/qm undo` | Letzte Änderung rückgängig machen |
| `/qm clear` | Nur wartende Aufgaben löschen |
| `/qm recover` | Nach einem Absturz aktive Aufgabe wiederherstellen und pausieren |
| `/qm help` | Hilfe anzeigen |

## Grenzen und Hinweise

Höchstens **200 Aufgaben pro Aufruf** und **500 wartende Aufgaben**. Jede Aufgabe verbraucht möglicherweise Modellkontingent und Kontext; neue Durchläufe leeren das 200K-Kontextfenster nicht automatisch. Wiederhole „mach weiter“ nur mit einem klaren Endkriterium. Eine Antwort bestätigt nicht automatisch den Erfolg.

## Fehlerbehebung

Wenn `/qm` fehlt, Plugin aktivieren und eine neue lokale **Code**-Sitzung öffnen. Andere Queue-Plugins deaktivieren. Zuerst mit zwei kurzen Aufgaben testen.

### ZIP

Entpacke das ZIP-Archiv, behalte den Ordner `Claude-Queue-Manager` an einem festen Ort und führe Folgendes im Terminal aus:

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

> Hinweis: Diese Übersetzung betrifft die Anleitung, nicht die Oberfläche des QM-Panels.
