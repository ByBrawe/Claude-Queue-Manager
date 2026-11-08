# Claude Queue Manager (QM) — 利用ガイド

[🌐 Japanese / 日本語](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager) · [MIT](../../LICENSE)

QM は Claude Desktop の **Code** タブと Claude Code CLI でタスクをキューに登録します。実行中の作業を変更せず、前のターンが終了してから次のタスクを別のターンで開始します。

## “続けて”

`続けて` は QM の特別なコマンドではなく、Claude に送る通常のタスク文です。`/qm repeat` などのコマンド名は英語のままですが、タスク本文は任意の言語で書けます。

```text
/qm repeat 5 続けて
```

## インストール

以下のコマンドでマーケットプレイスとプラグインを追加します。その後、ローカルの **Code** セッションを新しく開くか `/reload-plugins` を実行してください。通常の Chat タブには対応しません。

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

## 安全な開始手順

キューを一時停止し、タスクをまとめて追加して `/qm` で順番を確認してから再開してください。

```text
/qm pause
/qm batch 失敗したテストを修正 || ビルドを実行 || 変更点を要約
/qm
/qm resume
```

## コマンド一覧

| /qm | コマンド一覧 |
| --- | --- |
| `/qm` | キューパネルを開く |
| `/qm add 続けて` | タスクを1件追加 |
| `/qm repeat 5 続けて` | 同じタスクを1〜200件追加 |
| `/qm batch A \|\| B \|\| C` | 複数の異なるタスクを順番に追加 |
| `/qm front 続けて` | 先頭に追加 |
| `/qm pause  /qm resume` | 一時停止 / 再開 |
| `/qm mv 3 1` | 待機中の3番を1番へ移動 |
| `/qm edit 2 続けて` | 待機中の2番を編集 |
| `/qm rm 2` | 待機中の2番を削除 |
| `/qm undo` | 直前の変更を取り消す |
| `/qm clear` | 待機中のタスクだけを消去 |
| `/qm recover` | クラッシュ後の実行中タスクを復元して一時停止 |
| `/qm help` | ヘルプを表示 |

## 制限と注意

1回につき最大 **200件**、待機タスクは合計 **500件** まで。各タスクでモデル使用量とコンテキストを消費します。200K のコンテキストも各ターンで自動リセットされません。終了条件がないまま「続けて」を何百回も繰り返さないでください。応答があっても成功したとは限りません。

## トラブルシューティング

`/qm` が表示されない場合はプラグインを確認し、新しいローカル **Code** セッションを開いてください。他のキュープラグインは無効にし、最初に短いタスク2件でテストしてください。

### ZIP

ZIP を展開し、`Claude-Queue-Manager` フォルダーを移動しない場所に置いて次を実行します：

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

> 注：日本語化されているのはこのガイドです。QM パネルの表示言語は英語のままです。
