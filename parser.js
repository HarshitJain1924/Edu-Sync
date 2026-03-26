const inferCompany = (text = "") => {
  const lower = text.toLowerCase();
  if (lower.includes("wipro") || lower.includes("nlth")) return "wipro";
  if (lower.includes("tcs") || lower.includes("nqt")) return "tcs";
  if (lower.includes("infosys") || lower.includes("infytq")) return "infosys";
  if (lower.includes("amazon")) return "amazon";
  if (lower.includes("microsoft")) return "microsoft";
  if (lower.includes("google")) return "google";
  return "general";
};

const normalizeText = (text) =>
  (text || "")
    .replace(/Testbook Solution/gi, "")
    .replace(/Page\s*-\s*\d+/gi, "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .filter((line) => !/https?:\/\/\S+/i.test(line))
    .join("\n")
    .trim();

const stripNoise = (value = "") =>
  String(value)
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/Page\s*-\s*\d+/gi, "")
    .replace(/testbook\s*solution/gi, "")
    .replace(/\s+/g, " ")
    .trim();

const trimBleed = (value = "") => {
  const text = String(value);
  const cues = [
    /\bQue\.\s*\d+\b/i,
    /\bDirections?\s*[:\-]/i,
    /\bSelect the most appropriate\b/i,
    /\bIdentify the segment\b/i,
    /\bIn the given question\b/i,
  ];

  let cutIndex = -1;
  for (const cue of cues) {
    const m = cue.exec(text);
    if (m && m.index > 0) {
      cutIndex = cutIndex === -1 ? m.index : Math.min(cutIndex, m.index);
    }
  }

  return cutIndex > 0 ? text.slice(0, cutIndex).trim() : text.trim();
};

const normalizeQuestionText = (value = "") => {
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const isPassageBlock = (block = "") => {
  const lower = block.toLowerCase();
  return (
    lower.includes("following 5 items") ||
    lower.includes("based on the following passage") ||
    lower.includes("do not have hindi version") ||
    block.length > 800
  );
};

const parseAnswerKey = (text) => {
  const out = new Map();
  const idx = text.search(/answer\s*key|correct\s*options?/i);
  if (idx < 0) return out;

  const tail = text.slice(idx);
  const pairRegex = /(\d{1,3})\s*[).:\-]?\s*([1-4A-Da-d])/g;
  let m;
  while ((m = pairRegex.exec(tail)) !== null) {
    out.set(Number(m[1]), m[2].toUpperCase());
  }
  return out;
};

const extractOptions = (block) => {
  const clean = (block || "")
    .replace(/\r/g, "")
    .replace(/Correct\s*Option\s*-\s*\d+/gi, "")
    .replace(/(?:Answer|Ans|Solution)\s*[:-]\s*[\s\S]*$/i, "");

  // Primary: detect numeric option markers and slice by marker positions.
  // This is resilient when PDF extraction collapses options into a single line.
  const numericMarkers = [];
  const markerRegex = /(?:^|\n|\s)([1-4])\.\s*/g;
  let markerMatch;

  while ((markerMatch = markerRegex.exec(clean)) !== null) {
    numericMarkers.push({
      label: Number(markerMatch[1]),
      // Use regex cursor position as option text start index.
      start: markerRegex.lastIndex,
      markerIndex: markerMatch.index,
    });
  }

  if (numericMarkers.length >= 2) {
    const options = [];
    for (let i = 0; i < numericMarkers.length; i += 1) {
      const start = numericMarkers[i].start;
      const end = i + 1 < numericMarkers.length ? numericMarkers[i + 1].markerIndex : clean.length;
      const optionText = clean
        .slice(start, end)
        .replace(/\n/g, " ")
        .replace(/Correct\s*Option\s*-\s*\d+/gi, "")
        .replace(/\d+\.\s*$/g, "")
        .replace(/\s+/g, " ");
      const fixedOption = stripNoise(trimBleed(optionText));
      if (fixedOption) options.push(fixedOption);
    }

    if (options.length >= 2) return options.slice(0, 4);
  }

  // Fallback: alphabetic options (A/B/C/D) with multiline support.
  const alphaOptions = [];
  const alphaRegex = /(?:^|\n)\s*\(?([A-Da-d])\)?[).:-]?\s*([\s\S]*?)(?=(?:\n\s*\(?[A-Da-d]\)?[).:-]?\s*)|$)/g;
  let alphaMatch;

  while ((alphaMatch = alphaRegex.exec(clean)) !== null) {
    const optionText = (alphaMatch[2] || "")
      .replace(/\n/g, " ")
      .replace(/\d+\.\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const fixedOption = stripNoise(trimBleed(optionText));
    if (fixedOption) alphaOptions.push(fixedOption);
  }

  return alphaOptions.slice(0, 4);
};

const toSentenceCase = (str) => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const cleanStem = (block) => {
  const clean = (block || "")
    .replace(/\r/g, "")
    .replace(/Correct\s*Option\s*-\s*\d+/gi, "")
    .replace(/^\s*directions?\s*[:\-]?\s*/i, "")
    .trim();

  const firstOptionIndex = clean.search(/(?:^|\n|\s)[1-4]\.\s+/);
  let stem = firstOptionIndex > 0 ? clean.slice(0, firstOptionIndex) : clean.split(/\n?\d+\./)[0];
  if (!stem || !stem.trim()) {
    stem = clean.split(/(?:\n|\s)\(?([A-Da-d])\)?\s*[).:-]?\s+/)[0] || clean;
  }

  return stripNoise(trimBleed(stem));
};

const resolveCorrectAnswer = (block, options, answerKey, qNo) => {
  const ans = block.match(/(?:correct\s*option|answer|ans)\s*[:-]\s*([1-4A-Da-d])/i);

  let correctAnswer = options[0];
  if (ans) {
    const token = ans[1].toUpperCase();
    const idx = /^[1-4]$/.test(token) ? Number(token) - 1 : token.charCodeAt(0) - 65;
    if (options[idx]) correctAnswer = options[idx];
  } else if (answerKey.has(qNo)) {
    const token = String(answerKey.get(qNo)).toUpperCase();
    const idx = /^[1-4]$/.test(token) ? Number(token) - 1 : token.charCodeAt(0) - 65;
    if (options[idx]) correctAnswer = options[idx];
  }

  return correctAnswer;
};

const parseWithQueBlocks = (text, answerKey, company) => {
  const questions = [];
  const queRegex = /Que\.\s*(\d+)/gi;
  const qNumbers = [...text.matchAll(queRegex)].map((m) => Number(m[1]));
  const blocks = text.split(/Que\.\s*\d+/gi).slice(1);
  let currentPassage = null;
  let rcQuestionBudget = 0;

  blocks.forEach((rawBlock, idx) => {
    const block = (rawBlock || "").trim();
    if (!block) return;
    if (block.length > 5000) return;

    if (isPassageBlock(block)) {
      currentPassage = cleanStem(block);
      rcQuestionBudget = 5;
      return;
    }

    const options = extractOptions(block)
      .map((o) => o.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 4);
    if (options.length !== 4) return;

    let question = cleanStem(block);
    if (!question || question.length < 10 || question.length > 2500) return;
    if (/^directions?:?$/i.test(question)) return;
    if (question.length > 300) return;
    if (question.toLowerCase().includes("following 5 items")) return;

    if (currentPassage && question.length < 200) {
      rcQuestionBudget -= 1;
      if (rcQuestionBudget <= 0) {
        currentPassage = null;
      }
    } else if (currentPassage) {
      currentPassage = null;
      rcQuestionBudget = 0;
    }

    question = toSentenceCase(question);
    const fixedOptions = options.map((opt) => toSentenceCase(opt));

    const qNo = qNumbers[idx] || idx + 1;
    const correctAnswer = resolveCorrectAnswer(block, fixedOptions, answerKey, qNo);

    questions.push({
      question,
      options: fixedOptions,
      correctAnswer,
      explanation: "Imported from PDF",
      company,
      difficulty: "placement",
    });
  });

  return { blocksCount: blocks.length, questions };
};

const parseWithGenericRegex = (text, answerKey, company) => {
  const questions = [];

  const qRegex = /(?:^|\n)(?:que\.?|q(?:uestion)?)?\s*(\d{1,3})\s*[).:-]\s*([\s\S]*?)(?=(?:\n(?:que\.?|q(?:uestion)?)?\s*\d{1,3}\s*[).:-]\s*)|$)/gi;
  const blocks = [...text.matchAll(qRegex)];

  for (const m of blocks) {
    const qNo = Number(m[1]);
    const block = (m[2] || "").trim();
    if (!block) continue;
    if (block.length > 5000) continue;
    if (isPassageBlock(block)) continue;

    const options = extractOptions(block).map((o) => o.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 4);
    if (options.length !== 4) continue;

    let question = cleanStem(block);
    if (!question || question.length < 10 || question.length > 2500) continue;
    if (/^directions?:?$/i.test(question)) continue;

    if (question.length > 300) continue;
    if (question.toLowerCase().includes("following 5 items")) continue;

    question = toSentenceCase(question);
    const fixedOptions = options.map((opt) => toSentenceCase(opt));

    const correctAnswer = resolveCorrectAnswer(block, fixedOptions, answerKey, qNo);

    questions.push({
      question,
      options: fixedOptions,
      correctAnswer,
      explanation: "Imported from PDF",
      company,
      difficulty: "placement",
    });
  }

  return questions;
};

export const parseQuestionsFromText = (rawText) => {
  const text = normalizeText(rawText);
  const answerKey = parseAnswerKey(text);
  const company = inferCompany(text);

  const queParsed = parseWithQueBlocks(text, answerKey, company);
  let questions = queParsed.questions;

  if (questions.length < 5) {
    const fallback = parseWithGenericRegex(text, answerKey, company);
    questions = [...questions, ...fallback];
  }

  // De-duplicate by normalized stem
  const seen = new Set();
  const deduped = questions.filter((q) => {
    const key = q.question.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log("[PDF parser] Total blocks:", queParsed.blocksCount, "Parsed:", deduped.length);
  return deduped.slice(0, 50);
};
