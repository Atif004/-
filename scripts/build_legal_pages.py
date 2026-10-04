#!/usr/bin/env python3
"""يحوّل مستندات Qudra/Resources/Legal/*.md إلى صفحات ويب في docs/
(تُستخدم روابطها في App Store Connect، ويمكن نشرها عبر GitHub Pages).

المصدر واحد: نفس ملفات Markdown تُعرض داخل التطبيق.

الاستخدام:
    pip install markdown
    python3 scripts/build_legal_pages.py
"""
import html
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "Qudra/Resources/Legal"
OUTPUT = ROOT / "docs"

PAGES = [
    ("privacy_policy.md", "privacy.html", "سياسة الخصوصية"),
    ("terms_of_use.md", "terms.html", "شروط الاستخدام"),
]

TEMPLATE = """<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — قُدرة</title>
<style>
  :root {{
    --bg: #f7f5f0; --surface: #ffffff; --text: #171b26; --muted: #5d6576;
    --gold: #9a7a3c; --border: #e6e1d6;
  }}
  @media (prefers-color-scheme: dark) {{
    :root {{
      --bg: #0a0e1a; --surface: #131a2b; --text: #f5f3ee; --muted: #9aa3b5;
      --gold: #c9a86a; --border: #232c40;
    }}
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; background: var(--bg); color: var(--text);
    font: 17px/1.8 -apple-system, "SF Arabic", "Geeza Pro", "Noto Naskh Arabic", Tahoma, sans-serif;
  }}
  header, main, footer {{ max-width: 720px; margin: 0 auto; padding: 0 16px; }}
  header {{ padding-top: 32px; }}
  .brand {{ color: var(--gold); font-weight: 800; font-size: 28px; text-decoration: none; }}
  nav {{ display: flex; gap: 16px; margin-top: 8px; flex-wrap: wrap; }}
  nav a {{ color: var(--muted); text-decoration: none; }}
  nav a[aria-current] {{ color: var(--gold); font-weight: 600; }}
  main {{
    background: var(--surface); border: 1px solid var(--border); border-radius: 20px;
    padding: 8px 24px 24px; margin-top: 24px;
  }}
  h1 {{ font-size: 28px; margin: 24px 0 4px; }}
  h2 {{ font-size: 20px; margin-top: 32px; color: var(--gold); }}
  blockquote {{
    margin: 16px 0; padding: 8px 16px; border-inline-start: 4px solid var(--gold);
    background: color-mix(in srgb, var(--gold) 10%, transparent); border-radius: 8px;
  }}
  li {{ margin: 6px 0; }}
  footer {{ color: var(--muted); font-size: 14px; padding-top: 24px; padding-bottom: 40px; }}
</style>
</head>
<body>
<header>
  <a class="brand" href="index.html">قُدرة</a>
  <nav>{nav}</nav>
</header>
<main>
{body}
</main>
<footer>© قُدرة — النتائج في التطبيق تقديرية ولا تمثل عرضًا تمويليًا.</footer>
</body>
</html>
"""


def nav(current):
    links = []
    for _, out, title in PAGES:
        attr = ' aria-current="page"' if out == current else ""
        links.append(f'<a href="{out}"{attr}>{html.escape(title)}</a>')
    return "".join(links)


def main():
    OUTPUT.mkdir(exist_ok=True)
    for source, out, title in PAGES:
        text = (SOURCE / source).read_text(encoding="utf-8")
        body = markdown.markdown(text, extensions=["extra"])
        (OUTPUT / out).write_text(TEMPLATE.format(title=title, nav=nav(out), body=body), encoding="utf-8")
        print(f"docs/{out}")

    index_body = "<h1>قُدرة</h1><p>تطبيق لتقدير القدرة التمويلية للتمويل الشخصي والعقاري.</p><ul>" + "".join(
        f'<li><a href="{out}">{html.escape(title)}</a></li>' for _, out, title in PAGES
    ) + "</ul>"
    (OUTPUT / "index.html").write_text(
        TEMPLATE.format(title="قُدرة", nav=nav("index.html"), body=index_body), encoding="utf-8"
    )
    print("docs/index.html")


if __name__ == "__main__":
    main()
