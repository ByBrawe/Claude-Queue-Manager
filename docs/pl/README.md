# Claude Queue Manager (QM) — Instrukcja użytkownika

[🌐 Polish / Polski](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager) · [MIT](../../LICENSE)

QM ustawia zadania w kolejce w Claude Desktop (**Code**) lub Claude Code CLI. Każde zadanie rozpoczyna się jako osobna tura po zakończeniu poprzedniej, bez przerywania aktualnego zadania.

## “kontynuuj”

`kontynuuj` to zwykły tekst zadania, nie specjalna komenda. Słowa kluczowe `/qm` pozostają angielskie, ale treść zadań może być w dowolnym języku.

```text
/qm repeat 5 kontynuuj
```

## Instalacja

Zainstaluj marketplace i wtyczkę poniższymi poleceniami. Potem otwórz nową lokalną sesję **Code** lub użyj `/reload-plugins`. Zwykła karta Chat nie jest obsługiwana.

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

## Bezpieczny start

Wstrzymaj kolejkę, dodaj zadania, sprawdź kolejność przez `/qm`, a następnie wznow.

```text
/qm pause
/qm batch Napraw nieudane testy || Uruchom kompilację || Podsumuj zmiany
/qm
/qm resume
```

## Komendy

| /qm | Komendy |
| --- | --- |
| `/qm` | Otwórz panel kolejki |
| `/qm add kontynuuj` | Dodaj jedno zadanie |
| `/qm repeat 5 kontynuuj` | Powtórz zadanie 1–200 razy |
| `/qm batch A \|\| B \|\| C` | Dodaj różne zadania po kolei |
| `/qm front kontynuuj` | Dodaj zadanie na początek |
| `/qm pause  /qm resume` | Wstrzymaj / wznów |
| `/qm mv 3 1` | Przenieś zadanie 3 na pozycję 1 |
| `/qm edit 2 kontynuuj` | Edytuj oczekujące zadanie 2 |
| `/qm rm 2` | Usuń oczekujące zadanie 2 |
| `/qm undo` | Cofnij ostatnią zmianę |
| `/qm clear` | Usuń tylko oczekujące zadania |
| `/qm recover` | Odzyskaj zadanie po awarii i wstrzymaj kolejkę |
| `/qm help` | Pokaż pomoc |

## Limity i uwagi

Maksymalnie **200 zadań na operację** i **500 oczekujących**. Zadania zużywają limit modelu i kontekst; nowa tura nie resetuje automatycznie kontekstu 200K. Nie powtarzaj „kontynuuj” bez jasnego warunku zakończenia. Odpowiedź nie gwarantuje sukcesu.

## Rozwiązywanie problemów

Jeśli `/qm` nie działa, sprawdź wtyczkę i otwórz nową lokalną sesję **Code**. Wyłącz inne wtyczki kolejek i przetestuj dwa krótkie zadania.

### ZIP

Rozpakuj ZIP, pozostaw folder `Claude-Queue-Manager` w stałym miejscu i uruchom:

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

> Uwaga: ten przewodnik jest przetłumaczony, ale panel QM nadal ma angielski interfejs.
