import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GoogleGenAI } from "@google/genai";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FileText, Briefcase, Wand2, Loader2, Upload } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";

interface ResumeData {
  fullName: string;
  headline: string;
  contact: string;
  summary: string;
  experience: string;
  education: string;
  projects: string;
  skills: string;
  links: string;
}

interface JobLike {
  id?: string | number;
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  source?: string;
}

const EMPTY_RESUME: ResumeData = {
  fullName: "",
  headline: "",
  contact: "",
  summary: "",
  experience: "",
  education: "",
  projects: "",
  skills: "",
  links: "",
};

const STORAGE_KEY = "edusync.resume.builder.draft";

function extractGeminiText(response: any): string {
  if (!response) return "";
  if (typeof response.text === "function") {
    return response.text();
  }
  if (typeof response.text === "string") {
    return response.text;
  }
  const candidate = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof candidate === "string") return candidate;
  return "";
}

function fieldLabel(key: keyof ResumeData): string {
  switch (key) {
    case "fullName":
      return "Full Name";
    case "headline":
      return "Headline";
    case "contact":
      return "Contact";
    case "summary":
      return "Summary";
    case "experience":
      return "Experience";
    case "education":
      return "Education";
    case "projects":
      return "Projects";
    case "skills":
      return "Skills";
    case "links":
      return "Links";
    default:
      return "Section";
  }
}

function toMultiLineString(value: any): string {
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value
      .map((v) => (v ?? "").toString().trim())
      .filter(Boolean)
      .join("\n");
  }

  if (value && typeof value === "object") {
    return Object.values(value)
      .map((v) => (v ?? "").toString().trim())
      .filter(Boolean)
      .join("\n");
  }

  if (value == null) return "";
  return String(value);
}

const ResumeBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const jobFromState = (location.state as any)?.job as JobLike | undefined;

  const [resume, setResume] = useState<ResumeData>(EMPTY_RESUME);
  const [isImproving, setIsImproving] = useState(false);
  const [activeSection, setActiveSection] = useState<keyof ResumeData | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged = { ...EMPTY_RESUME, ...parsed } as any;
        setResume({
          fullName: toMultiLineString(merged.fullName),
          headline: toMultiLineString(merged.headline),
          contact: toMultiLineString(merged.contact),
          summary: toMultiLineString(merged.summary),
          experience: toMultiLineString(merged.experience),
          education: toMultiLineString(merged.education),
          projects: toMultiLineString(merged.projects),
          skills: toMultiLineString(merged.skills),
          links: toMultiLineString(merged.links),
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(resume));
    } catch {
      // ignore
    }
  }, [resume]);

  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const hasJobContext = Boolean(jobFromState && (jobFromState.title || jobFromState.description));

  const jobSummary = useMemo(() => {
    if (!jobFromState) return "";
    const parts = [jobFromState.title, jobFromState.company, jobFromState.location].filter(Boolean);
    return parts.join(" · ");
  }, [jobFromState]);

  const handleChange = (key: keyof ResumeData, value: string) => {
    setResume((prev) => ({ ...prev, [key]: value }));
  };

  const importFromText = async (raw: string) => {
    const text = raw.trim();
    if (!text) {
      setStatusMessage("Paste or upload your existing resume text first.");
      return;
    }

    if (!geminiKey) {
      setStatusMessage("Gemini API key missing. Configure VITE_GEMINI_API_KEY to enable AI import.");
      return;
    }

    setIsImporting(true);
    setStatusMessage("Analyzing your resume and mapping it into sections...");

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });

      const prompt = `You are an expert resume editor.

I will give you the FULL TEXT of a resume (copied from PDF/Word or plain text).

1. Fix obvious grammar and clarity issues but keep all facts honest.
2. Do NOT invent new jobs, projects, or skills.
3. Then map the content into this JSON structure:
{
  "fullName": "string",
  "headline": "string",
  "contact": "string (email, phone, location, portfolio)",
  "summary": "2-4 sentences summary",
  "experience": "bullet points, one per line",
  "education": "education details, school, degree, dates",
  "projects": "projects as bullet points, one per line",
  "skills": "skills as comma-separated or one per line",
  "links": "important links (GitHub, LinkedIn, portfolio) one per line"
}

Return ONLY JSON. No explanation.

Resume text:
"""
${text}
"""`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      const anyResp: any = response;
      const raw = typeof anyResp.text === "function" ? anyResp.text() : anyResp.text;
      const jsonText = (raw || "").toString();
      const parsed = JSON.parse(jsonText || "{}");

      const merged = { ...resume, ...parsed } as any;

      const next: ResumeData = {
        fullName: toMultiLineString(merged.fullName),
        headline: toMultiLineString(merged.headline),
        contact: toMultiLineString(merged.contact),
        summary: toMultiLineString(merged.summary),
        experience: toMultiLineString(merged.experience),
        education: toMultiLineString(merged.education),
        projects: toMultiLineString(merged.projects),
        skills: toMultiLineString(merged.skills),
        links: toMultiLineString(merged.links),
      };

      setResume(next);
      setStatusMessage("Imported and cleaned your resume into structured sections.");
    } catch (err) {
      console.error("Import resume AI error", err);
      setStatusMessage("Could not import this file automatically. Please try a smaller or text-only version.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setStatusMessage("Please upload a resume smaller than 2MB.");
      return;
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isPlainText = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");

    if (!isPdf && !isPlainText) {
      setStatusMessage("Please upload a .pdf or .txt resume, or paste the content as text.");
      return;
    }

    const reader = new FileReader();

    if (isPlainText) {
      reader.onload = () => {
        const content = typeof reader.result === "string" ? reader.result : "";
        setImportText(content);
        importFromText(content);
      };
      reader.onerror = () => {
        setStatusMessage("Could not read that file. Please try again or paste the text.");
      };
      reader.readAsText(file);
      return;
    }

    // PDF flow: send base64 to backend for parsing
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i += 1) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        setStatusMessage("Uploading PDF to extract text...");
        const resp = await fetch("/api/parse-resume-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: base64 }),
        });

        if (!resp.ok) {
          setStatusMessage("Could not parse that PDF. Please try another file or export as text.");
          return;
        }

        const json = await resp.json();
        const text = (json?.text || "") as string;
        if (!text.trim()) {
          setStatusMessage("The PDF did not contain readable text. Try exporting as text.");
          return;
        }

        setImportText(text);
        importFromText(text);
      } catch {
        setStatusMessage("Failed to read or parse that PDF. Please try again or paste the text.");
      }
    };
    reader.onerror = () => {
      setStatusMessage("Could not read that file. Please try again or paste the text.");
    };
    reader.readAsArrayBuffer(file);
  };

  const improveSection = async (key: keyof ResumeData) => {
    if (!geminiKey) {
      setStatusMessage("Gemini API key missing. Configure VITE_GEMINI_API_KEY to enable AI suggestions.");
      return;
    }

    const current = toMultiLineString(resume[key]).trim();
    if (!current) {
      setStatusMessage(`Add some text in ${fieldLabel(key)} first.`);
      return;
    }

    setIsImproving(true);
    setActiveSection(key);
    setStatusMessage("Asking AI to polish this section...");

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });

      const basePrompt = `You are an expert resume writer. Improve the \"${fieldLabel(
        key,
      )}\" section of this resume.

Current text:
"""
${current}
"""

Make it concise, impactful, and ATS-friendly. Use clear bullet points when helpful. Keep it in the same language and do not add headings. Return only the improved text.`;

      const prompt = hasJobContext && jobFromState?.description
        ? `${basePrompt}

Target role:
- Job title: ${jobFromState.title || ""}
- Company: ${jobFromState.company || ""}

Job description:
"""
${jobFromState.description}
"""

Tailor the wording and keywords to fit this job while staying honest to the original content.`
        : basePrompt;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const anyResp: any = response;
      const raw = typeof anyResp.text === "function" ? anyResp.text() : anyResp.text;
      const text = (raw || "").toString().trim();
      if (!text) {
        setStatusMessage("AI did not return any text. Please try again.");
        return;
      }

      setResume((prev) => ({ ...prev, [key]: text }));
      setStatusMessage(`${fieldLabel(key)} updated with AI suggestions.`);
    } catch (err) {
      console.error("Resume AI error", err);
      setStatusMessage("Something went wrong while talking to AI. Please try again.");
    } finally {
      setIsImproving(false);
      setActiveSection(null);
    }
  };

  const clearJobContext = () => {
    navigate("/resume-builder", { replace: true, state: undefined });
  };

  const handlePrint = () => {
    window.print();
  };

  const splitLines = (value: any) =>
    toMultiLineString(value)
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0f0f0f] text-slate-900 dark:text-foreground relative overflow-hidden transition-colors duration-500">
      <AppSidebar />
      <div className="absolute -top-40 -left-20 w-[26rem] h-[26rem] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 -right-24 w-[26rem] h-[26rem] rounded-full bg-[rgba(194,132,255,0.14)] blur-[120px] pointer-events-none" />

      <main className="ml-64 px-5 md:px-8 py-8 relative z-10 print:ml-0 print:px-8 print:py-8">
        <header className="mb-6 flex items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-purple-100 to-indigo-300 bg-clip-text text-transparent flex items-center gap-2">
              <FileText className="h-7 w-7 text-purple-300" />
              Resume Builder
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Draft, polish, and tailor your resume with a little AI magic.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
              onClick={handlePrint}
            >
              Download / Print PDF
            </Button>
          </div>
        </header>

        {statusMessage && (
          <div className="mb-4 text-xs text-purple-100 bg-purple-500/10 border border-purple-500/30 rounded-xl px-3 py-2 flex items-center gap-2 print:hidden">
            <Sparkles className="h-3.5 w-3.5 text-purple-300" />
            <span>{statusMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-6 items-start">
          <div className="space-y-4 print:hidden">
            <Card className="rounded-2xl bg-white/5 border-white/10 mb-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Upload className="h-4 w-4 text-purple-300" />
                  Import Existing Resume
                </CardTitle>
                <CardDescription className="text-xs">
                  Upload a .txt export of your resume or paste the text. AI will clean errors and split it into sections.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept=".pdf,application/pdf,.txt,text/plain"
                    onChange={handleFileUpload}
                    className="text-xs file:text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-purple-500/20 file:text-purple-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Or paste resume text</label>
                  <Textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    className="min-h-[80px] text-xs"
                    placeholder="Paste the full text of your resume here..."
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={isImporting}
                  onClick={() => importFromText(importText)}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" />
                      Analyze & Fill Resume
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {hasJobContext && (
              <Card className="rounded-2xl bg-purple-500/10 border-purple-500/30 mb-2">
                <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Briefcase className="h-4 w-4 text-purple-300" />
                    </div>
                    <div>
                      <CardTitle className="text-sm text-purple-100 flex flex-wrap items-center gap-2">
                        Optimizing for this job
                      </CardTitle>
                      {jobSummary && <CardDescription className="text-xs text-purple-100/80">{jobSummary}</CardDescription>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-purple-100 hover:text-white" onClick={clearJobContext}>
                    Clear
                  </Button>
                </CardHeader>
              </Card>
            )}

            <Card className="rounded-2xl bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-300" />
                  Resume Details
                </CardTitle>
                <CardDescription className="text-xs">
                  Fill in your resume sections, then use AI buttons to refine wording.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Full name</label>
                    <Input
                      value={resume.fullName}
                      onChange={(e) => handleChange("fullName", e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Headline</label>
                    <Input
                      value={resume.headline}
                      onChange={(e) => handleChange("headline", e.target.value)}
                      placeholder="e.g. Frontend Engineer | React & TypeScript"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Contact</label>
                  <Input
                    value={resume.contact}
                    onChange={(e) => handleChange("contact", e.target.value)}
                    placeholder="Email · Phone · Location · Portfolio"
                  />
                </div>

                {([
                  "summary",
                  "experience",
                  "projects",
                  "education",
                  "skills",
                  "links",
                ] as (keyof ResumeData)[]).map((key) => (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <span>{fieldLabel(key)}</span>
                        {key === "experience" && (
                          <span className="text-[10px] text-muted-foreground/80">
                            Use one bullet per achievement.
                          </span>
                        )}
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px] border-purple-500/40 text-purple-100 bg-purple-500/10 hover:bg-purple-500/20"
                        disabled={isImproving}
                        onClick={() => improveSection(key)}
                      >
                        {isImproving && activeSection === key ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Wand2 className="h-3 w-3 mr-1" />
                        )}
                        Improve
                      </Button>
                    </div>
                    <Textarea
                      value={resume[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="min-h-[90px] text-sm"
                      placeholder={
                        key === "summary"
                          ? "2–4 lines that summarize your profile and impact."
                          : key === "experience"
                          ? "Use bullet points: one line per achievement, starting with a strong verb."
                          : key === "projects"
                          ? "Key projects, stack, and measurable outcomes."
                          : key === "education"
                          ? "Degree, institution, dates, GPA (optional), relevant coursework."
                          : key === "skills"
                          ? "Comma-separated skills or one per line."
                          : "Links to GitHub, portfolio, LinkedIn, etc."
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="rounded-2xl bg-white/5 border-white/10 print:border-none print:bg-transparent">
              <CardHeader className="pb-3 print:hidden">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-300" />
                  Live Preview
                </CardTitle>
                <CardDescription className="text-xs">
                  This is what will be printed / saved as PDF.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="bg-background/60 rounded-xl border border-white/5 p-6 md:p-8 text-sm text-foreground print:border-none print:p-0">
                  {resume.fullName && (
                    <div className="mb-1 text-xl font-semibold tracking-tight">
                      {resume.fullName}
                    </div>
                  )}
                  {resume.headline && (
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      {resume.headline}
                    </div>
                  )}
                  {resume.contact && (
                    <div className="text-[11px] text-muted-foreground mb-4 whitespace-pre-line">
                      {resume.contact}
                    </div>
                  )}

                  {resume.summary && (
                    <section className="mb-4">
                      <h2 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase mb-1.5">
                        Summary
                      </h2>
                      <p className="whitespace-pre-line leading-relaxed text-sm">
                        {resume.summary}
                      </p>
                    </section>
                  )}

                  {resume.experience && (
                    <section className="mb-4">
                      <h2 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase mb-1.5">
                        Experience
                      </h2>
                      <ul className="list-disc list-outside pl-5 space-y-1">
                        {splitLines(resume.experience).map((line, idx) => (
                          <li key={idx} className="text-sm leading-relaxed">
                            {line.replace(/^[-•]\s*/, "")}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {resume.projects && (
                    <section className="mb-4">
                      <h2 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase mb-1.5">
                        Projects
                      </h2>
                      <ul className="list-disc list-outside pl-5 space-y-1">
                        {splitLines(resume.projects).map((line, idx) => (
                          <li key={idx} className="text-sm leading-relaxed">
                            {line.replace(/^[-•]\s*/, "")}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {resume.education && (
                    <section className="mb-4">
                      <h2 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase mb-1.5">
                        Education
                      </h2>
                      <p className="whitespace-pre-line leading-relaxed text-sm">
                        {resume.education}
                      </p>
                    </section>
                  )}

                  {resume.skills && (
                    <section className="mb-4">
                      <h2 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase mb-1.5">
                        Skills
                      </h2>
                      <div className="flex flex-wrap gap-1.5">
                        {splitLines(resume.skills)
                          .join(", ")
                          .split(/,\s*/)
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((skill, idx) => (
                            <Badge
                              key={`${skill}-${idx}`}
                              variant="outline"
                              className="text-[10px] px-2 py-0.5 border-muted-foreground/30 text-muted-foreground"
                            >
                              {skill}
                            </Badge>
                          ))}
                      </div>
                    </section>
                  )}

                  {resume.links && (
                    <section className="mb-2">
                      <h2 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase mb-1.5">
                        Links
                      </h2>
                      <ul className="list-disc list-outside pl-5 space-y-1">
                        {splitLines(resume.links).map((line, idx) => (
                          <li key={idx} className="text-xs leading-relaxed break-all">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ResumeBuilder;
