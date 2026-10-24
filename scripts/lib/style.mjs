// House style for new posts: sentences start in lowercase, names keep their
// capitals ("earth is round. in India, ...").
//
// A sentence-initial word is lowercased only when it is clearly an ordinary word:
//   - it is in COMMON (frequent English words), or
//   - the same word appears in lowercase elsewhere in the post.
// It is kept when it looks like a name:
//   - it is in site.config.json -> style.keepCapitalized, or
//   - it appears capitalized mid-sentence elsewhere in the post ("in Bihar"), or
//   - it has more capitals inside it (LLMs, IIT, iPhone).
// Anything else is kept and reported as "unsure", so a name is never lowered by mistake.
//
// Untouched: quotations (text starting with a quote mark), link text, code,
// block quotes (">"), tables ("|"), comments, and the pronoun "I" mid-sentence.
// `context` (title, description, body) is evidence only; pass separate parts joined by blank lines.

const COMMON = new Set(
  `a about above across after again against all almost along already also although always am among an and another any anyone
anything are around as at away back be because been before being below best better between both but by can cannot could
did do does doing done down during each either else enough even ever every everyone everything few first for from further
get gets given go goes going good got great had has have having he her here hers herself him himself his how however i if
in instead into is it its itself just last later least less let like little long many may maybe me might more most much must
my myself never new next no none nor not nothing now of off often on once one only or other others otherwise our ours
ourselves out over own perhaps quite rather really same say see seem seems several shall she should since so some someone
something sometimes still such than that the their theirs them themselves then there therefore these they thing things this
those though through thus to today together too toward towards under unless until up upon us very was we well were what
whatever when whenever where whether which while who whoever whole whom whose why will with within without would yes yet you
your yours yourself yourselves
also anyway besides consider imagine look note remember say suppose take think yesterday tomorrow tonight
life time people world day days year years man men woman women human humans person way work home thing word words
moment moments mind minds question questions answer answers problem problems idea ideas reason truth love fear hope
change choice choices decision decisions belief beliefs game games story stories road roads lamp lamps moon earth sun
light dark night morning evening water money power place places part parts end beginning start
one two three four five six seven eight nine ten first second third last next
there's here's it's that's what's who's i'm i've i'd i'll we're we've you're you've they're they've don't doesn't didn't
isn't aren't wasn't weren't can't couldn't won't wouldn't shouldn't let's`.split(/\s+/)
);

const QUOTE_OR_LINK = /^["“‘'\[`]/;
const ENDS_SENTENCE = /[.!?…]["”’')\]]*\s*$/;

// Splits a line into [prefix, content] where prefix is a heading/list/footnote marker.
function linePrefix(line) {
  const m = /^(\s*(?:#{1,3}\s+|[-*]\s+|\d+[.)]\s+|\[\^[A-Za-z0-9_-]+\]:\s*)?)(.*)$/s.exec(line);
  return [m[1], m[2]];
}

// Offsets (within `content`) where a sentence begins.
function sentenceStarts(content, startsSentence) {
  const starts = [];
  if (startsSentence) starts.push(0);
  const re = /[.!?…]["”’')\]]*\s+/g;
  let m;
  while ((m = re.exec(content))) starts.push(m.index + m[0].length);
  return starts;
}

// The word at a sentence start, skipping emphasis markers and an opening "(".
function wordAt(content, offset) {
  let i = offset;
  while (content[i] === "*" || content[i] === "_" || content[i] === "(") i += 1;
  if (QUOTE_OR_LINK.test(content.slice(i))) return null;
  const m = /^([A-Z])([a-z]*)(?=[^A-Za-z]|$)/.exec(content.slice(i));
  if (!m) return null;
  return { index: i, word: m[0] };
}

function splitComments(text) {
  // Returns segments [{text, comment}] so comments are never touched.
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(/<!--[\s\S]*?-->/g)) {
    parts.push({ text: text.slice(last, m.index), comment: false });
    parts.push({ text: m[0], comment: true });
    last = m.index + m[0].length;
  }
  parts.push({ text: text.slice(last), comment: false });
  return parts;
}

// Walks the non-comment lines of a text, yielding each line with the offsets of
// its sentence-initial words. Used both to gather evidence and to make changes.
function* walk(text) {
  let startsSentence = true;
  for (const seg of splitComments(text)) {
    if (seg.comment) continue;
    startsSentence = true;
    for (const line of seg.text.split("\n")) {
      if (line.trim() === "") {
        startsSentence = true;
        continue;
      }
      const skip = /^\s*(>|\|)/.test(line);
      const [prefix, content] = linePrefix(line);
      const starts = new Set(
        sentenceStarts(content, startsSentence || prefix.trim() !== "")
          .map((s) => wordAt(content, s)?.index)
          .filter((x) => x !== undefined)
      );
      yield { content, starts, skip };
      startsSentence = ENDS_SENTENCE.test(line) || skip;
    }
  }
}

// Evidence per word: used in lowercase anywhere, or capitalized mid-sentence (a name).
function evidence(text) {
  const lower = new Set();
  const midSentenceCapital = new Set();
  for (const { content, starts, skip } of walk(text)) {
    for (const m of content.matchAll(/[A-Za-z][A-Za-z'’]*/g)) {
      const w = m[0];
      if (m.index > 0 && /[A-Za-z0-9]/.test(content[m.index - 1])) continue;
      if (/^[a-z]/.test(w)) lower.add(w.toLowerCase().replace(/['’].*$/, ""));
      else if (!skip && /^[A-Z][a-z]+/.test(w) && !starts.has(m.index)) {
        // A name only if it follows running text ("in Bihar"), not a quote mark,
        // bracket or code tick, where a capital may just open a quotation or a link.
        const before = content.slice(0, m.index).trimEnd();
        if (/[A-Za-z0-9,;:]$/.test(before)) midSentenceCapital.add(w.replace(/['’].*$/, ""));
      }
    }
  }
  return { lower, midSentenceCapital };
}

function decide(word, ev, keep) {
  if (word.length === 1 && word !== "I" && word !== "A") return "keep";
  const key = word.toLowerCase();
  if (keep.has(key)) return "keep";
  if (ev.midSentenceCapital.has(word)) return "keep";
  if (COMMON.has(key) || ev.lower.has(key)) return "lower";
  return "unsure";
}

/**
 * Lowercases sentence starts in a post body.
 * @returns {{ text: string, changes: string[], unsure: string[] }}
 */
export function lowercaseBody(body, { keepCapitalized = [], context = "" } = {}) {
  const keep = new Set(keepCapitalized.map((w) => w.toLowerCase()));
  const ev = evidence(`${context}\n\n${body}`);
  const changes = [];
  const unsure = [];

  const segments = splitComments(body).map((seg) => {
    if (seg.comment) return seg.text;
    const lines = seg.text.split("\n");
    let startsSentence = true; // a segment begins a paragraph or follows a comment
    return lines
      .map((line) => {
        if (line.trim() === "") {
          startsSentence = true;
          return line;
        }
        const skip = /^\s*(>|\|)/.test(line);
        const [prefix, content] = linePrefix(line);
        const isBlockStart = prefix.trim() !== "";
        let out = content;
        if (!skip) {
          const starts = sentenceStarts(content, startsSentence || isBlockStart);
          const lineChanges = [];
          // Work right to left so offsets stay valid.
          for (const s of starts.reverse()) {
            const hit = wordAt(out, s);
            if (!hit) continue;
            const verdict = decide(hit.word, ev, keep);
            if (verdict === "lower") {
              const lowered = hit.word.toLowerCase();
              out = out.slice(0, hit.index) + lowered + out.slice(hit.index + hit.word.length);
              lineChanges.unshift(`${hit.word} → ${lowered}`);
            } else if (verdict === "unsure") {
              unsure.push(hit.word);
            }
          }
          changes.push(...lineChanges);
        }
        startsSentence = ENDS_SENTENCE.test(line) || skip;
        return prefix + out;
      })
      .join("\n");
  });

  return { text: segments.join(""), changes, unsure: [...new Set(unsure)] };
}

// Titles and descriptions: lowercase the first word under the same rules.
export function lowercaseLine(line, { keepCapitalized = [], context = "" } = {}) {
  return lowercaseBody(line, { keepCapitalized, context });
}
