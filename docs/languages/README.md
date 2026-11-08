# Claude Queue Manager — 20 language guides / 20 dilde rehber

Choose your language below. **Commands are always in English** (`/qm`, `repeat`, `batch`, `pause`, `resume`); the *task text* may be written in any language.

**Türkçe:** Komut kelimeleri İngilizce kalır; `devam et`, `continue` vb. ifadeler Claude'a gönderilen normal görev metnidir. Bu rehberler paneli çevirmiyor.

| Language | English name | Localized example |
| --- | --- | --- |
| [English](../en/README.md) | English | `/qm repeat 5 continue` |
| [Türkçe](../tr/README.md) | Turkish | `/qm repeat 5 devam et` |
| [Deutsch](../de/README.md) | German | `/qm repeat 5 mach weiter` |
| [Français](../fr/README.md) | French | `/qm repeat 5 continue` |
| [Español](../es/README.md) | Spanish | `/qm repeat 5 continúa` |
| [Italiano](../it/README.md) | Italian | `/qm repeat 5 continua` |
| [Português (Brasil)](../pt-BR/README.md) | Portuguese (Brazil) | `/qm repeat 5 continue` |
| [Русский](../ru/README.md) | Russian | `/qm repeat 5 продолжай` |
| [Українська](../uk/README.md) | Ukrainian | `/qm repeat 5 продовжуй` |
| [Polski](../pl/README.md) | Polish | `/qm repeat 5 kontynuuj` |
| [Nederlands](../nl/README.md) | Dutch | `/qm repeat 5 ga verder` |
| [Svenska](../sv/README.md) | Swedish | `/qm repeat 5 fortsätt` |
| [日本語](../ja/README.md) | Japanese | `/qm repeat 5 続けて` |
| [한국어](../ko/README.md) | Korean | `/qm repeat 5 계속해` |
| [简体中文](../zh-CN/README.md) | Chinese (Simplified) | `/qm repeat 5 继续` |
| [العربية](../ar/README.md) | Arabic | `/qm repeat 5 تابع` |
| [हिन्दी](../hi/README.md) | Hindi | `/qm repeat 5 जारी रखो` |
| [Bahasa Indonesia](../id/README.md) | Indonesian | `/qm repeat 5 lanjutkan` |
| [Tiếng Việt](../vi/README.md) | Vietnamese | `/qm repeat 5 tiếp tục` |
| [فارسی](../fa/README.md) | Persian | `/qm repeat 5 ادامه بده` |

## Quick comparison / Hızlı karşılaştırma

```text
/qm pause
/qm repeat 5 continue
/qm resume
```

```text
/qm pause
/qm repeat 5 devam et
/qm resume
```

Both examples work identically; the content of the queued message differs.

**Limits:** 200 tasks per addition, 500 pending tasks in total. Tasks can use model quota and context, and each turn does not automatically reset the context. Test with two short tasks before large batches.

[Repository](https://github.com/ByBrawe/Claude-Queue-Manager) · [Download latest source ZIP](https://github.com/ByBrawe/Claude-Queue-Manager/archive/refs/heads/main.zip) · [MIT license](../../LICENSE)
