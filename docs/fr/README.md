# Claude Queue Manager (QM) — Guide d'utilisation

[🌐 French / Français](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager) · [MIT](../../LICENSE)

QM met les tâches en attente dans Claude Desktop (**Code**) ou Claude Code CLI. Chaque tâche démarre dans un nouveau tour lorsque le précédent se termine, sans détourner la tâche en cours.

## “continue”

`continue` est du texte de tâche ordinaire, pas une commande spéciale. Les mots-clés `/qm` restent en anglais, mais les instructions peuvent être rédigées dans n'importe quelle langue.

```text
/qm repeat 5 continue
```

## Installation

Installez le marketplace puis le plugin avec les commandes ci-dessous. Ouvrez ensuite une nouvelle session **Code** locale ou utilisez `/reload-plugins`. L'onglet Chat classique n'est pas pris en charge.

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

## Démarrage sûr

Mettez la file en pause, ajoutez vos tâches, vérifiez l'ordre avec `/qm`, puis reprenez.

```text
/qm pause
/qm batch Corriger les tests en échec || Lancer la compilation || Résumer les changements
/qm
/qm resume
```

## Commandes

| /qm | Commandes |
| --- | --- |
| `/qm` | Ouvrir le panneau de file d'attente |
| `/qm add continue` | Ajouter une tâche |
| `/qm repeat 5 continue` | Répéter une tâche 1 à 200 fois |
| `/qm batch A \|\| B \|\| C` | Ajouter plusieurs tâches dans l'ordre |
| `/qm front continue` | Placer une tâche en tête |
| `/qm pause  /qm resume` | Mettre en pause / reprendre |
| `/qm mv 3 1` | Déplacer la tâche 3 en position 1 |
| `/qm edit 2 continue` | Modifier la tâche 2 en attente |
| `/qm rm 2` | Supprimer la tâche 2 en attente |
| `/qm undo` | Annuler la dernière modification |
| `/qm clear` | Vider les tâches en attente uniquement |
| `/qm recover` | Récupérer une tâche interrompue après un plantage, puis mettre en pause |
| `/qm help` | Afficher l'aide |

## Limites et précautions

Maximum **200 tâches par ajout** et **500 en attente**. Chaque tâche peut consommer du quota et du contexte ; le contexte 200K n'est pas réinitialisé automatiquement entre les tours. Évitez de répéter « continue » sans condition d'arrêt claire. Une réponse ne garantit pas la réussite.

## Dépannage

Si `/qm` est absent, vérifiez le plugin et rouvrez une session **Code** locale. Désactivez les autres gestionnaires de file. Testez d'abord deux petites tâches.

### ZIP

Décompressez l'archive ZIP, gardez le dossier `Claude-Queue-Manager` à un emplacement fixe, puis exécutez :

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

> Remarque : ce guide est traduit, mais l'interface du panneau QM reste en anglais.
