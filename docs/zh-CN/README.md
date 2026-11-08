# Claude Queue Manager (QM) — 使用指南

[🌐 Chinese (Simplified) / 简体中文](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager) · [MIT](../../LICENSE)

QM 可在 Claude Desktop 的 **Code** 标签页和 Claude Code CLI 中管理任务队列。前一轮结束后才会以独立的新轮次执行下一项任务，不会干扰正在运行的任务。

## “继续”

`继续` 是发送给 Claude 的普通任务文本，不是 QM 的特殊命令。`/qm repeat` 等命令名称仍为英文，但任务内容可以使用任何语言。

```text
/qm repeat 5 继续
```

## 安装

使用下面的命令安装市场源和插件，然后打开新的本地 **Code** 会话，或执行 `/reload-plugins`。普通 Chat 标签页不支持此插件。

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

## 安全的入门步骤

先暂停队列，再批量添加任务，通过 `/qm` 检查顺序，最后恢复执行。

```text
/qm pause
/qm batch 修复失败的测试 || 运行构建 || 总结更改
/qm
/qm resume
```

## 命令说明

| /qm | 命令说明 |
| --- | --- |
| `/qm` | 打开队列面板 |
| `/qm add 继续` | 添加单个任务 |
| `/qm repeat 5 继续` | 重复添加同一任务 1–200 次 |
| `/qm batch A \|\| B \|\| C` | 按顺序添加不同任务 |
| `/qm front 继续` | 把任务放到队首 |
| `/qm pause  /qm resume` | 暂停 / 恢复 |
| `/qm mv 3 1` | 将等待中的第 3 项移到第 1 位 |
| `/qm edit 2 继续` | 编辑等待中的第 2 项 |
| `/qm rm 2` | 删除等待中的第 2 项 |
| `/qm undo` | 撤销上次更改 |
| `/qm clear` | 只清空等待中的任务 |
| `/qm recover` | 崩溃后恢复未完成任务并暂停 |
| `/qm help` | 显示帮助 |

## 限制与注意事项

每次最多添加 **200 个任务**，队列总计最多 **500 个待执行任务**。每项任务都可能消耗模型额度和上下文；即使拥有 200K 上下文窗口，新一轮也不会自动清空上下文。没有明确停止条件时，不要大量重复发送“继续”。模型回复不一定代表任务成功。

## 故障排查

如果看不到 `/qm`，请检查插件是否启用并重新打开本地 **Code** 会话。避免同时启用其他队列插件，并先用两个小任务测试。

### ZIP

解压 ZIP，将 `Claude-Queue-Manager` 文件夹放在固定位置，然后执行：

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

> 注意：这里翻译的是使用指南，QM 面板界面仍为英文。
