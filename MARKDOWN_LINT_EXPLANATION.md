# Markdown Lint Konfiguration - Förklaring

## Varför får du lint-problem i Markdown-filer?

VS Code har en inbyggd Markdown-linter som kontrollerar att dina `.md` filer följer specifika stilregler. Dessa regler är bra för enkel dokumentation, men kan vara för restriktiva för komplexa projektdokument.

## Inaktiverade regler i `.markdownlint.json`:

| Regel | Beskrivning | Varför inaktiverad |
|-------|-------------|-------------------|
| `MD025` | Endast en H1 (`#`) per dokument | Du behöver flera H1 för olika sektioner |
| `MD013` | Begränsa radlängd till 80 tecken | Teknisk dokumentation behöver längre rader |
| `MD033` | Ingen rå HTML i Markdown | Du använder HTML för styling och struktur |
| `MD041` | Första raden måste vara H1 | Flexibilitet för metadata och kommentarer |
| `MD024` | Inga duplicerade rubriker | Dokumentation kan ha liknande sektioner |
| `MD026` | Inga skiljetecken i slutet av rubriker | Tekniska rubriker kan behöva `:` eller `!` |
| `MD036` | Inga kursiva rubriker | Används för emphasis i teknisk dokumentation |
| `MD001` | Rubriknivåer måste vara inkrementella | Flexibilitet för komplex struktur |
| `MD003` | Konsekvent rubrikstil | Blandar `#` och `===` för olika ändamål |
| `MD022` | Rubriker måste ha blanka rader runt sig | Tätare formatering för tekniska dokument |
| `MD032` | Listor måste ha blanka rader runt sig | Tätare formatering för tekniska dokument |

## Alternativ lösning:

Om du vill behålla linting men bara för specifika filer, kan du lägga till en kommentar överst i Markdown-filer för att inaktivera specifika regler:

```markdown
<!-- markdownlint-disable MD025 MD013 -->
# Din dokumentation här
```

## För att helt inaktivera Markdown-linting i VS Code:

Lägg till i dina VS Code settings (`.vscode/settings.json`):

```json
{
  "markdownlint.config": {
    "MD025": false,
    "MD013": false
  }
}
```

## Resultat:

Med `.markdownlint.json` filen kommer du inte längre att få lint-varningar för dina tekniska dokumentationsfiler, medan du fortfarande behåller fördelarna med ESLint för JavaScript-kod.
