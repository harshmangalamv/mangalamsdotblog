# Writing guide

How to write for mangalams.blog, from a two-line thought to a long, sourced series.
For a working example of every feature, open `posts_raw/16-10-2026-1.txt` next to its preview (`npm.cmd run dev`, then http://localhost:5500/why-bihar-stayed-poor-1/).

## The loop

```powershell
npm.cmd run new -- "Title of the essay"   # creates today's draft in posts_raw\
npm.cmd run dev                           # preview with drafts at http://localhost:5500
```

Write, refresh the browser, repeat. If something is wrong (a missing footnote, an uneven table, a bad link), the build stops and says which file and what to fix.

When it is ready, delete the `Status: draft` line, then commit and push. The site updates in about a minute.

## Header

```txt
Title: Why Bihar stayed poor, part 2: land and caste
Status: draft
Series: Why Bihar stayed poor
Slug: why-bihar-stayed-poor-2
Description: One or two sentences for search results and link previews.
```

| Line | Needed? | What it does |
|---|---|---|
| `Title:` | always | The essay's title. |
| `Date:` | no | Must match the filename date if you include it. |
| `Status: draft` | while writing | Keeps the essay off the live site. |
| `Series:` | for a series | Essays with exactly the same series name are linked as Part 1, Part 2, … in date order. |
| `Slug:` | recommended for series | A short, permanent URL. Set it before the first publish; changing it later leaves a redirect behind. |
| `Description:` | for long essays | What Google, WhatsApp and LinkedIn show. Without it, the opening lines are used. |

## Body

| Write | Get |
|---|---|
| a blank line | new paragraph |
| `## Section` | section heading, linkable; 4 or more add a Contents list at the top |
| `### Sub-section` | smaller heading, not in Contents |
| `**key phrase**` / `*emphasis*` | bold / italic |
| `[text](https://…)` | link |
| `[^name]` … `[^name]: source` | numbered footnote, listed under Notes |
| `\| a \| b \|` rows with `\|---\|--:\|` | table (`--:` right-aligns numbers) |
| `> text` | block quote |
| `- item` / `1. item` | list (blank line before it) |
| `![caption](/assets/file.png)` | image with caption (file goes in `assets/`) |
| `---` | short divider |
| `\` at line end | line break (poetry) |
| `<!-- note -->` | a note to yourself, never published |

## Long, sourced essays (the Bihar series)

**Before writing**
- Decide the series name and each part's slug up front (`why-bihar-stayed-poor-1`, `-2`, …). URLs are permanent.
- Keep a source list as you research: the claim, the number, the link, the date you checked it.

**Structure**
- Open with one paragraph that states the question in plain words. It becomes the excerpt and the link preview.
- 4 to 6 `##` sections, each answering one sub-question. Headings should read as a summary when listed in Contents.
- One idea per paragraph. If a paragraph needs a table, the table comes right after the sentence that introduces it.
- End with what the next part will cover, so the series reads as one argument.

**Sources**
- Every number gets a footnote: who published it, which year, and a link. Prefer primary sources (Census, NSSO/MoSPI, RBI, state budgets) over articles about them.
- Say when figures are provisional, revised, or disputed. Readers trust a writer who shows the seams.
- Put the source name in the footnote, not in the sentence: "Bihar had the lowest literacy rate.[^census]" reads better than "According to the Census of India 2011…".

**Tables**
- Keep them small: 3 to 8 rows, 2 to 4 columns. A table that needs scrolling on a phone is two tables.
- Put units in the header (`Literacy rate, 2011`), right-align numbers with `--:`, and use the same decimal places in a column.
- Order rows by the point you are making (highest to lowest, or Bihar next to its comparison).

**Before publishing**
- Read it once on your phone (`npm.cmd run dev`, then open your computer's address on the phone's browser, or just read it after publishing).
- Click every footnote number once.
- Check that `Description:` reads well on its own.
- Delete the leftover `<!-- notes -->`, or keep them; they never show.
