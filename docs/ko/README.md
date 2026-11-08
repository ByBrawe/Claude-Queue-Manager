# Claude Queue Manager (QM) — 사용 안내서

[🌐 Korean / 한국어](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager) · [MIT](../../LICENSE)

QM은 Claude Desktop의 **Code** 탭과 Claude Code CLI에서 작업을 대기열에 넣습니다. 진행 중인 작업을 방해하지 않고 이전 턴이 끝난 뒤 다음 작업을 별도 턴으로 실행합니다.

## “계속해”

`계속해`는 특별한 QM 명령이 아니라 Claude에 보낼 일반 작업 문구입니다. `/qm repeat` 같은 명령어는 영어로 유지되지만 작업 내용은 모든 언어로 작성할 수 있습니다.

```text
/qm repeat 5 계속해
```

## 설치

아래 명령으로 마켓플레이스와 플러그인을 설치하세요. 이후 새로운 로컬 **Code** 세션을 열거나 `/reload-plugins`를 실행하세요. 일반 Chat 탭에서는 사용할 수 없습니다.

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

## 안전한 시작

대기열을 일시 중지하고 작업을 추가한 다음 `/qm`에서 순서를 확인하고 재개하세요.

```text
/qm pause
/qm batch 실패한 테스트 수정 || 빌드 실행 || 변경 사항 요약
/qm
/qm resume
```

## 명령어

| /qm | 명령어 |
| --- | --- |
| `/qm` | 대기열 패널 열기 |
| `/qm add 계속해` | 작업 하나 추가 |
| `/qm repeat 5 계속해` | 같은 작업을 1~200번 추가 |
| `/qm batch A \|\| B \|\| C` | 여러 작업을 순서대로 추가 |
| `/qm front 계속해` | 작업을 맨 앞으로 이동 |
| `/qm pause  /qm resume` | 일시 중지 / 재개 |
| `/qm mv 3 1` | 대기 중인 3번 작업을 1번으로 이동 |
| `/qm edit 2 계속해` | 대기 중인 2번 작업 편집 |
| `/qm rm 2` | 대기 중인 2번 작업 삭제 |
| `/qm undo` | 마지막 변경 취소 |
| `/qm clear` | 대기 중인 작업만 모두 삭제 |
| `/qm recover` | 충돌 후 진행 중이던 작업 복구 및 일시 중지 |
| `/qm help` | 도움말 표시 |

## 제한 및 주의사항

한 번에 최대 **200개**, 전체 대기 중 최대 **500개** 작업을 추가할 수 있습니다. 작업마다 모델 사용량과 컨텍스트가 소모되며, 200K 컨텍스트도 턴마다 자동 초기화되지 않습니다. 종료 조건 없이 '계속해'를 반복하지 마세요. 응답이 왔다고 성공한 것은 아닙니다.

## 문제 해결

`/qm`이 보이지 않으면 플러그인을 확인하고 새 로컬 **Code** 세션을 여세요. 다른 대기열 플러그인은 꺼두고 짧은 작업 2개로 먼저 시험하세요.

### ZIP

ZIP 압축을 풀고 `Claude-Queue-Manager` 폴더를 고정된 경로에 둔 다음 실행하세요:

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

> 참고: 이 안내서는 번역되었지만 QM 패널 자체의 언어는 영어입니다.
