# Claude Queue Manager (QM) — Guía de usuario

[🌐 Spanish / Español](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager) · [MIT](../../LICENSE)

QM pone tareas en cola en Claude Desktop (**Code**) o Claude Code CLI. Cada tarea se envía en un turno independiente al finalizar el anterior, sin intervenir en la tarea activa.

## “continúa”

`continúa` es texto normal de la tarea, no una palabra clave de QM. Los comandos `/qm` se escriben en inglés, pero puedes redactar las tareas en cualquier idioma.

```text
/qm repeat 5 continúa
```

## Instalación

Instala el marketplace y el plugin con estos comandos. Después abre una sesión **Code** local nueva o usa `/reload-plugins`. No funciona en la pestaña Chat normal.

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

## Inicio seguro

Pausa la cola, añade varias tareas, comprueba el orden con `/qm` y reanuda.

```text
/qm pause
/qm batch Corregir las pruebas fallidas || Ejecutar la compilación || Resumir los cambios
/qm
/qm resume
```

## Comandos

| /qm | Comandos |
| --- | --- |
| `/qm` | Abrir el panel de cola |
| `/qm add continúa` | Añadir una tarea |
| `/qm repeat 5 continúa` | Repetir una tarea entre 1 y 200 veces |
| `/qm batch A \|\| B \|\| C` | Añadir varias tareas por orden |
| `/qm front continúa` | Colocar una tarea al principio |
| `/qm pause  /qm resume` | Pausar / reanudar |
| `/qm mv 3 1` | Mover la tarea 3 a la posición 1 |
| `/qm edit 2 continúa` | Editar la tarea 2 pendiente |
| `/qm rm 2` | Eliminar la tarea 2 pendiente |
| `/qm undo` | Deshacer el último cambio |
| `/qm clear` | Vaciar solo las tareas pendientes |
| `/qm recover` | Recuperar una tarea tras un cierre inesperado y pausar |
| `/qm help` | Mostrar ayuda |

## Límites y precauciones

Máximo **200 tareas por operación** y **500 pendientes**. Cada tarea puede gastar cuota y contexto; los turnos nuevos no limpian automáticamente el contexto de 200K. No repitas « continúa » muchas veces sin un criterio de parada. Una respuesta no prueba el éxito de la tarea.

## Solución de problemas

Si no aparece `/qm`, comprueba el plugin y abre otra sesión **Code** local. Desactiva otros plugins de cola y prueba primero con dos tareas.

### ZIP

Descomprime el ZIP, conserva la carpeta `Claude-Queue-Manager` en una ubicación fija y ejecuta:

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

> Nota: esta guía está traducida, pero el panel de QM sigue en inglés.
