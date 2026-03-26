export interface PlacementQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  company?: string;
  difficulty?: string;
}

export interface PlacementQuestionBank {
  companies: Record<string, PlacementQuestion[]>;
}

const COMPANY_ALIASES: Record<string, string> = {
  tcs: "tcs",
  "tcs digital": "tcs",
  "tcs nqt": "tcs",
  infosys: "infosys",
  infytq: "infosys",
  wipro: "wipro",
  nlth: "wipro",
  amazon: "amazon",
  microsoft: "microsoft",
  google: "google",
};

export const normalizeCompanyId = (value?: string): string => {
  if (!value) return "";
  const clean = value.toLowerCase().trim().replace(/\s+/g, " ");
  return COMPANY_ALIASES[clean] || clean.replace(/[^a-z0-9]/g, "");
};

const normalizeDifficulty = (value?: string): string => {
  if (!value) return "";
  const clean = value.toLowerCase().trim();
  if (clean.startsWith("easy")) return "easy";
  if (clean.startsWith("hard")) return "hard";
  if (clean.startsWith("placement")) return "placement";
  return "medium";
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
};

const toQuestion = (raw: unknown): PlacementQuestion | null => {
  const row = asRecord(raw);
  if (!row) return null;

  const question = String(row.question || "").trim();
  const correctAnswer = String(row.correctAnswer || row.answer || "").trim();
  const options = Array.isArray(row.options)
    ? row.options.map((o) => String(o).trim()).filter(Boolean)
    : [];

  if (!question || !correctAnswer || options.length < 2) return null;

  return {
    question,
    options,
    correctAnswer,
    explanation: String(row.explanation || "").trim() || "No explanation provided.",
    company: normalizeCompanyId(String(row.company || row.companyId || "")),
    difficulty: normalizeDifficulty(String(row.difficulty || "")),
  };
};

const addQuestionsToCompany = (
  target: Record<string, PlacementQuestion[]>,
  companyId: string,
  rows: unknown[]
) => {
  if (!companyId || !Array.isArray(rows)) return;
  for (const row of rows) {
    const q = toQuestion(row);
    if (!q) continue;
    target[companyId] = target[companyId] || [];
    target[companyId].push(q);
  }
};

export const parsePlacementQuestionBank = (raw: unknown): PlacementQuestionBank => {
  const companies: Record<string, PlacementQuestion[]> = {};
  const payload = asRecord(raw);

  // Format A: { companies: { tcs: [...], infosys: [...] } }
  const payloadCompanies = payload ? asRecord(payload.companies) : null;
  if (payloadCompanies) {
    for (const [company, rows] of Object.entries(payloadCompanies)) {
      if (!Array.isArray(rows)) continue;
      addQuestionsToCompany(companies, normalizeCompanyId(company), rows);
    }
  }

  // Format B: { questions: [{ company: "tcs", ... }] }
  const payloadQuestions = payload?.questions;
  if (Array.isArray(payloadQuestions)) {
    for (const row of payloadQuestions) {
      const q = toQuestion(row);
      if (!q) continue;
      const rowRecord = asRecord(row);
      const companyId = normalizeCompanyId(q.company || String(rowRecord?.company || ""));
      if (!companyId) continue;
      companies[companyId] = companies[companyId] || [];
      companies[companyId].push(q);
    }
  }

  // Format C: [{ company: "tcs", ... }, ...]
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const q = toQuestion(row);
      if (!q) continue;
      const rowRecord = asRecord(row);
      const companyId = normalizeCompanyId(q.company || String(rowRecord?.company || ""));
      if (!companyId) continue;
      companies[companyId] = companies[companyId] || [];
      companies[companyId].push(q);
    }
  }

  return { companies };
};

export const filterCompanyQuestionsByDifficulty = (
  questions: PlacementQuestion[],
  selectedDifficulty: string
): PlacementQuestion[] => {
  if (!questions.length) return [];

  const requested = normalizeDifficulty(selectedDifficulty);
  const tagged = questions.filter((q) => q.difficulty);
  if (!tagged.length) return questions;

  const filtered = questions.filter((q) => normalizeDifficulty(q.difficulty) === requested);
  return filtered.length > 0 ? filtered : questions;
};

export const inferCompanyId = (text: string): string => {
  const lower = text.toLowerCase();
  if (lower.includes("tcs") || lower.includes("nqt")) return "tcs";
  if (lower.includes("infosys") || lower.includes("infytq")) return "infosys";
  if (lower.includes("wipro") || lower.includes("nlth")) return "wipro";
  if (lower.includes("amazon")) return "amazon";
  if (lower.includes("microsoft")) return "microsoft";
  if (lower.includes("google")) return "google";
  return "";
};

const extractAnswerKeyMap = (text: string): Map<number, string> => {
  const map = new Map<number, string>();
  const idx = text.toLowerCase().search(/answer\s*key|answers?\s*:/i);
  if (idx < 0) return map;

  const segment = text.slice(idx);
  const pairRegex = /(\d{1,3})\s*(?:[).:-]|\s)\s*\(?([A-Da-d])\)?/g;
  let match: RegExpExecArray | null;
  while ((match = pairRegex.exec(segment)) !== null) {
    map.set(Number(match[1]), match[2].toUpperCase());
  }
  return map;
};

const parseOptions = (body: string): string[] => {
  const options: string[] = [];

  const lineRegex = /(?:^|\n)\s*(?:\(?[A-Da-d]\)?[).:-]?)\s*(.+?)(?=(?:\n\s*(?:\(?[A-Da-d]\)?[).:-]?\s*))|$)/g;
  let lineMatch: RegExpExecArray | null;
  while ((lineMatch = lineRegex.exec(body)) !== null) {
    const text = lineMatch[1].trim();
    if (text) options.push(text);
  }

  if (options.length >= 2) return options.slice(0, 4);

  const compact = body.replace(/\s+/g, " ");
  const inlineRegex = /(?:^|\s)(?:\(?([A-Da-d])\)?[).:-]?)\s*(.+?)(?=(?:\s+(?:\(?[A-Da-d]\)?[).:-]?)\s*)|$)/g;
  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = inlineRegex.exec(compact)) !== null) {
    const text = inlineMatch[2].trim();
    if (text) options.push(text);
  }

  return options.slice(0, 4);
};

const stripOptionAndAnswerLines = (body: string): string => {
  const normalized = body.replace(/\r/g, "");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^\(?[A-Da-d]\)?[).:-]?\s+/.test(line))
    .filter((line) => !/^(ans|answer)\s*[:-]/i.test(line));

  let joined = lines.join(" ").replace(/\s+/g, " ").trim();
  const firstOptionIdx = joined.search(/\s\(?[A-Da-d]\)?[).:-]?\s+/);
  if (firstOptionIdx > 0) {
    joined = joined.slice(0, firstOptionIdx).trim();
  }
  return joined;
};

const extractQuestionBlocks = (text: string): Array<{ qNo: number; block: string }> => {
  const result: Array<{ qNo: number; block: string }> = [];
  const markerRegex = /(?:^|\n|\s)(?:q(?:uestion)?\s*)?(\d{1,3})\s*[).:-]\s+/gi;
  const matches = Array.from(text.matchAll(markerRegex));

  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const start = m.index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const block = text.slice(start, end).trim();
    const qNo = Number(m[1]);
    if (!Number.isFinite(qNo) || !block) continue;

    const cleaned = block.replace(/^(?:q(?:uestion)?\s*)?\d{1,3}\s*[).:-]\s*/i, "").trim();
    if (!cleaned) continue;
    result.push({ qNo, block: cleaned });
  }

  return result;
};

export const parsePlacementQuestionsFromText = (
  text: string,
  fallbackCompanyId?: string
): PlacementQuestionBank => {
  const normalizedText = text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n");
  const companies: Record<string, PlacementQuestion[]> = {};
  const answerKeyMap = extractAnswerKeyMap(normalizedText);
  const blocks = extractQuestionBlocks(normalizedText);

  for (const entry of blocks) {
    const qNo = entry.qNo;
    const block = entry.block.trim();
    if (!block) continue;

    const options = parseOptions(block);
    if (options.length < 2) continue;

    const question = stripOptionAndAnswerLines(block);
    if (!question) continue;

    const explicitAnswer = block.match(/(?:ans|answer)\s*[:-]\s*\(?([A-Da-d])\)?\b|(?:ans|answer)\s*[:-]\s*(.+)$/im);
    let correctAnswer = "";

    if (explicitAnswer) {
      const raw = String(explicitAnswer[1] || explicitAnswer[2] || "").trim();
      if (/^[A-Da-d]$/.test(raw)) {
        const idx = raw.toUpperCase().charCodeAt(0) - 65;
        correctAnswer = options[idx] || "";
      } else {
        correctAnswer = raw;
      }
    }

    if (!correctAnswer && answerKeyMap.has(qNo)) {
      const letter = answerKeyMap.get(qNo) || "";
      const idx = letter.charCodeAt(0) - 65;
      correctAnswer = options[idx] || "";
    }

    if (!correctAnswer) {
      correctAnswer = options[0];
    }

    const companyId =
      normalizeCompanyId(fallbackCompanyId) ||
      inferCompanyId(block) ||
      inferCompanyId(normalizedText) ||
      "wipro";

    companies[companyId] = companies[companyId] || [];
    companies[companyId].push({
      question,
      options,
      correctAnswer,
      explanation: "Imported from question bank PDF.",
      company: companyId,
      difficulty: "placement",
    });
  }

  return { companies };
};
