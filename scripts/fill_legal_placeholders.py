#!/usr/bin/env python3
"""يملأ الحقول بين الأقواس المربعة في المستندات القانونية، ثم يعيد توليد صفحات docs/.

الاستخدام (يعمل على Windows وmacOS وLinux):
    python scripts/fill_legal_placeholders.py --check            # يعرض الحقول المتبقية
    python scripts/fill_legal_placeholders.py legal/fields.json  # يملؤها ويولّد docs/

الحقول المدعومة هي مفاتيح legal/fields.example.json. الاستبدال يتم في ملفات
Qudra/Resources/Legal/*.md نفسها (المعروضة داخل التطبيق)، ثم تُولَّد صفحات الويب منها.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEGAL = ROOT / "Qudra/Resources/Legal"
PLACEHOLDER = re.compile(r"\[([^\]\n]+)\](?!\()")  # يتجاهل روابط Markdown [نص](رابط)


def remaining():
    found = {}
    for path in sorted(LEGAL.glob("*.md")):
        for match in PLACEHOLDER.finditer(path.read_text(encoding="utf-8")):
            found.setdefault(match.group(1), set()).add(path.name)
    return found


def check():
    found = remaining()
    if not found:
        print("لا توجد حقول متبقية. المستندات مكتملة.")
        return 0
    print("حقول متبقية في المستندات القانونية:")
    for name, files in sorted(found.items()):
        print(f"  [{name}]  ←  {', '.join(sorted(files))}")
    return 1


def fill(config_path):
    values = json.loads(Path(config_path).read_text(encoding="utf-8"))
    values = {k: v for k, v in values.items() if not k.startswith("_")}
    problems = [k for k, v in values.items() if not str(v).strip() or "[" in str(v) or "مثال" in str(v)]
    if problems:
        print("قيم غير مكتملة في الملف:", ", ".join(problems))
        return 1
    for path in sorted(LEGAL.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        new = PLACEHOLDER.sub(lambda m: str(values.get(m.group(1), m.group(0))), text)
        if new != text:
            path.write_text(new, encoding="utf-8")
            print(f"updated {path.relative_to(ROOT)}")

    sys.path.insert(0, str(ROOT / "scripts"))
    import build_legal_pages  # noqa: E402

    build_legal_pages.main()
    return check()


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--check":
        sys.exit(check())
    if len(sys.argv) == 2:
        sys.exit(fill(sys.argv[1]))
    print(__doc__)
    sys.exit(2)
