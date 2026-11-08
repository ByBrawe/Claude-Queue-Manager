# Claude Queue Manager (QM) — Guia do usuário

[🌐 Portuguese (Brazil) / Português (Brasil)](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager) · [MIT](../../LICENSE)

O QM organiza tarefas em fila no Claude Desktop (**Code**) ou Claude Code CLI. Cada tarefa inicia em um turno separado quando a anterior termina, sem redirecionar a tarefa atual.

## “continue”

`continue` é texto normal da tarefa, não um comando especial. Os comandos `/qm` permanecem em inglês, mas as tarefas podem ser escritas em qualquer idioma.

```text
/qm repeat 5 continue
```

## Instalação

Instale o marketplace e o plugin com os comandos abaixo. Depois abra uma nova sessão local **Code** ou use `/reload-plugins`. A aba Chat comum não é compatível.

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

## Início seguro

Pause a fila, adicione as tarefas, confira a ordem com `/qm` e retome.

```text
/qm pause
/qm batch Corrija os testes com falha || Execute o build || Resuma as alterações
/qm
/qm resume
```

## Comandos

| /qm | Comandos |
| --- | --- |
| `/qm` | Abrir o painel da fila |
| `/qm add continue` | Adicionar uma tarefa |
| `/qm repeat 5 continue` | Repetir uma tarefa de 1 a 200 vezes |
| `/qm batch A \|\| B \|\| C` | Adicionar várias tarefas na ordem definida |
| `/qm front continue` | Colocar uma tarefa no início |
| `/qm pause  /qm resume` | Pausar / retomar |
| `/qm mv 3 1` | Mover a tarefa 3 para a posição 1 |
| `/qm edit 2 continue` | Editar a tarefa pendente 2 |
| `/qm rm 2` | Remover a tarefa pendente 2 |
| `/qm undo` | Desfazer a última alteração |
| `/qm clear` | Limpar apenas as tarefas pendentes |
| `/qm recover` | Recuperar uma tarefa após falha e pausar |
| `/qm help` | Mostrar ajuda |

## Limites e cuidados

Até **200 tarefas por operação** e **500 pendentes**. Cada tarefa pode consumir cota e contexto; um novo turno não redefine automaticamente o contexto de 200K. Evite repetir « continue » sem condição de parada. Uma resposta não garante o sucesso.

## Solução de problemas

Se `/qm` não aparecer, confira o plugin e abra uma nova sessão **Code** local. Desative outros plugins de fila e teste primeiro duas tarefas pequenas.

### ZIP

Extraia o ZIP, mantenha a pasta `Claude-Queue-Manager` em um local permanente e execute:

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

> Nota: este guia foi traduzido, mas o painel QM continua em inglês.
