# Smart Diff функціонал 

# Що вже є

## Як отримати дані про PR
PR Details Getter GET /pulls/:id. Дає список змінених файлів зі шляхом, +/- і патчем (prFiles: path, additions, deletions, patch). Це єдине джерело, потрібне для класифікації та розкладки (core/wiring/boilerplate), напишемо функцію для класифікації по типу файла нижче в документі. Працює одразу після імпорту PR — без жодного виклику моделі.

як це працює на бекенді - @server/docs/specs/pull-detail-import.md

## Отримуємо finding з посиланням на код
Structured AI PR Reviewer — GET /pulls/:id/reviews (модуль reviews). Дає findings із точними file:line і severity. Це джерело накладки: бейджів «N findings», підсвітки рядків і авто-розгортання карток. 

З'являється лише після першого Run Review тому що ми це все достаємо з LLM моделі; до запуску рев'ю розкладка працює, накладки немає.

як це працює на бекенді - @server/docs/specs/structured-pr-reviewer.md

## Сам контракт SmartDiff
Контракт SmartDiff (zod-схема у vendor/shared/contracts/brief.ts). Задає цільову форму відповіді: groups[{role, files[]}] + split_suggestion.
Ключовий принцип: на самому кроці Smart Diff нового виклику моделі немає. Дорогий LLM-виклик уже стався у Structured Reviewer; Smart Diff лише детерміновано компонує готові файли + готові findings.

# Що треба додати

## Функція класифікації файлів
classifyFile(path) це чистий код, regex-паттерни, нуль мережевих викликів: спочатку перебирає BOILERPLATE_PATTERNS (lock-файли, dist/, snapshots, міграції) — якщо збіг → "boilerplate"; потім WIRING_PATTERNS (index.ts, config файли, схеми, routes) → "wiring"; якщо нічого не спрацювало → "core" (бізнес-логіка).

це функція classifyFile(). Вона приймає шлях до файлу і повертає одну з трьох категорій: core, wiring або boilerplate. Саме вона визначає куди потрапить кожен файл у Smart Diff.

### Скрипт і тести для перевірки
щоб тестити функцію додати скрипт verify:l03 — це скрипт який запускає тести саме на цю функцію. Потрібно зробити дві речі:

1. Додати скрипт у server/package.json:
"verify:l03": "vitest run src/modules/pulls/classifier.test.ts"

2. Написати тест-файл server/src/modules/pulls/classifier.test.ts з кейсами:
classifyFile("pnpm-lock.yaml") → boilerplate
classifyFile("0001_migration.sql") → boilerplate
classifyFile("src/modules/reviews/service.ts") → core
classifyFile("src/index.ts") → wiring
15 таких перевірок достатньо — по 5 на кожну категорію.

Патерни  у окремому файлі classifier-patterns.ts (constants), функція classifyFile в classifier.ts. Жодного LLM тільки re.test(path).

## Новий роут GET /pulls/:id/smart-diff
Зроби роут GET /pulls/:id/smart-diff: бере файли з GET /pulls/:id, findings з останнього рев'ю, складає у форму контракту SmartDiff.

## Новий компонент SmartDiffViewer (скриншот буде додано)

- Має показувати групи файлів розподілених по Core/Wiring/Boilerplatу як на скриншоті, якщо бойлерплейт то згорнутий за замовчуванням
- зліва підсвічена полоска де була знайдено locker/warning/suggestion
- бейдж blocker/warning/suggestion на конкретному рядку, click по бейджу має вести на вкладку Findings на конкретний Finding.
Юзер клікає — відбувається навігація на вкладку Review Runs → Findings (через router.push або зміну URL-параметра, але без hard reload)
Відповідний FindingCard автоматично розгортається або підсвічується
Найпростіший спосіб реалізувати: передавати findingId як search-параметр у URL (?findingId=xxx), а у FindingCard при маунті перевіряти чи збігається — і якщо так, розгортати.
