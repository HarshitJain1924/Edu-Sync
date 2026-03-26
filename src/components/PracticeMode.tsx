import { useState, useMemo, useEffect } from "react";
import { ChevronRight, Search, Filter, ChevronLeft, ChevronDown, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlacementQuestions } from "@/hooks/usePlacementQuestions";

interface PracticeModeProps {
  onBack?: () => void;
}

const COMPANIES = [
  { id: "tcs", label: "TCS" },
  { id: "infosys", label: "Infosys" },
  { id: "wipro", label: "Wipro" },
  { id: "amazon", label: "Amazon" },
  { id: "microsoft", label: "Microsoft" },
  { id: "google", label: "Google" },
  { id: "general", label: "General" },
];

const DIFFICULTIES = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
  { id: "placement", label: "Placement Level" },
];

export const PracticeMode = ({ onBack }: PracticeModeProps) => {
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const pageSize = 10;

  // Fetch questions
  const { data, isLoading, error } = usePlacementQuestions({
    company: selectedCompany !== "all" ? selectedCompany : undefined,
    difficulty: selectedDifficulty !== "all" ? selectedDifficulty : undefined,
    search: searchTerm || undefined,
    page: currentPage,
    limit: pageSize,
  });

  // Get selected question
  const selectedQuestion = useMemo(() => {
    if (!selectedQuestionId || !data?.questions) return null;
    return data.questions.find((q) => q.id === selectedQuestionId);
  }, [selectedQuestionId, data?.questions]);

  // Auto-select first question on data load
  const displayedQuestions = data?.questions || [];
  const firstQuestionId = displayedQuestions[0]?.id;

  useEffect(() => {
    if (!selectedQuestion && firstQuestionId) {
      setSelectedQuestionId(firstQuestionId);
    }
  }, [selectedQuestion, firstQuestionId]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      setShowAnswer(false);
    }
  };

  const handleNextPage = () => {
    if (data && currentPage < data.totalPages) {
      setCurrentPage(currentPage + 1);
      setShowAnswer(false);
    }
  };

  const handleSelectQuestion = (questionId: string) => {
    setSelectedQuestionId(questionId);
    setShowAnswer(false);
  };

  const handleResetFilters = () => {
    setSelectedCompany("all");
    setSelectedDifficulty("all");
    setSearchTerm("");
    setCurrentPage(1);
    setShowAnswer(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Practice Mode</h1>
              <p className="text-sm text-slate-500">No timer • Review at your own pace</p>
            </div>
          </div>
          {data && (
            <div className="text-right">
              <p className="text-sm text-slate-400">
                Showing {((currentPage - 1) * pageSize) + 1} to{" "}
                {Math.min(currentPage * pageSize, data.total)} of {data.total} questions
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-white font-semibold mb-4 hover:text-slate-300 transition-colors"
          >
            <Filter className="h-4 w-4" />
            Filters
            <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-white/5 border border-white/10 rounded-lg">
              {/* Search */}
              <div className="md:col-span-2">
                <label className="text-xs text-slate-400 font-semibold block mb-2">Search Questions</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 bg-white/5 border-white/10"
                  />
                </div>
              </div>

              {/* Company Filter */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-2">Company</label>
                <Select value={selectedCompany} onValueChange={(value) => {
                  setSelectedCompany(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {COMPANIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Difficulty Filter */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-2">Difficulty</label>
                <Select value={selectedDifficulty} onValueChange={(value) => {
                  setSelectedDifficulty(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reset Button */}
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={handleResetFilters}
                  className="w-full border-white/20 hover:bg-white/10"
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Question List */}
          <div>
            <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-b border-white/10 p-4">
                <h3 className="font-semibold text-white">Questions</h3>
                <p className="text-xs text-slate-400 mt-1">{data?.total || 0} total</p>
              </div>

              {isLoading ? (
                <div className="p-4 text-center text-slate-400">Loading questions...</div>
              ) : error ? (
                <div className="p-4 text-center text-red-400">Error loading questions</div>
              ) : displayedQuestions.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-slate-400 mb-4">No questions found</p>
                  <Button onClick={handleResetFilters} variant="outline" className="border-white/20">
                    Clear Filters
                  </Button>
                </div>
              ) : (
                <>
                  <div className="max-h-[600px] overflow-y-auto space-y-0">
                    {displayedQuestions.map((question, idx) => (
                      <button
                        key={question.id}
                        onClick={() => handleSelectQuestion(question.id)}
                        className={`w-full text-left p-4 border-b border-white/5 hover:bg-white/5 transition-colors ${
                          selectedQuestionId === question.id ? "bg-primary/10" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold ${
                              selectedQuestionId === question.id
                                ? "bg-primary text-white"
                                : "bg-white/10 text-slate-400"
                            }`}
                          >
                            {((currentPage - 1) * pageSize) + idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{question.question.slice(0, 60)}...</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-slate-400">
                                {question.company}
                              </span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                                  question.difficulty === "easy"
                                    ? "bg-green-500/15 text-green-400"
                                    : question.difficulty === "hard"
                                    ? "bg-red-500/15 text-red-400"
                                    : "bg-yellow-500/15 text-yellow-400"
                                }`}
                              >
                                {question.difficulty}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="flex-shrink-0 h-4 w-4 text-slate-600" />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Pagination */}
                  <div className="border-t border-white/10 p-4 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                      className="border-white/20"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-slate-400">
                      Page {currentPage} of {data?.totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={!data || currentPage === data.totalPages}
                      className="border-white/20"
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Panel - Question Details */}
          <div className="lg:col-span-2">
            {selectedQuestion ? (
              <Card className="bg-white/5 border-white/10 sticky top-24">
                <CardHeader className="bg-gradient-to-r from-primary/20 to-indigo-600/20 border-b border-white/10">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl text-white">{selectedQuestion.question}</CardTitle>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs px-3 py-1 rounded-full bg-white/10 text-slate-300">
                          {selectedQuestion.company}
                        </span>
                        <span
                          className={`text-xs px-3 py-1 rounded-full font-semibold ${
                            selectedQuestion.difficulty === "easy"
                              ? "bg-green-500/15 text-green-400"
                              : selectedQuestion.difficulty === "hard"
                              ? "bg-red-500/15 text-red-400"
                              : "bg-yellow-500/15 text-yellow-400"
                          }`}
                        >
                          {selectedQuestion.difficulty}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-6">
                  {/* Options */}
                  <div className="space-y-3 mb-8">
                    <label className="text-xs font-semibold text-slate-400 block mb-3">Options:</label>
                    {selectedQuestion.options.map((option, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          showAnswer && option === selectedQuestion.correct_answer
                            ? "border-green-500 bg-green-500/10"
                            : "border-white/10 hover:border-white/20 bg-white/5"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                              showAnswer && option === selectedQuestion.correct_answer
                                ? "border-green-500 bg-green-500 text-white"
                                : "border-white/30 text-slate-400"
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}
                          </div>
                          <div className="flex-1">
                            <p
                              className={`text-sm ${
                                showAnswer && option === selectedQuestion.correct_answer
                                  ? "text-white font-semibold"
                                  : "text-slate-300"
                              }`}
                            >
                              {option}
                            </p>
                            {showAnswer && option === selectedQuestion.correct_answer && (
                              <p className="text-xs text-green-400 mt-1">✓ Correct Answer</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Show/Hide Answer Button */}
                  <Button
                    onClick={() => setShowAnswer(!showAnswer)}
                    variant="outline"
                    className="w-full mb-4 border-primary text-primary hover:bg-primary/10"
                  >
                    {showAnswer ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" /> Hide Answer
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" /> Show Answer
                      </>
                    )}
                  </Button>

                  {/* Explanation */}
                  {showAnswer && selectedQuestion.explanation && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                      <p className="text-xs font-semibold text-blue-400 mb-2">Explanation</p>
                      <p className="text-sm text-slate-300 leading-relaxed">{selectedQuestion.explanation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center">
                <p className="text-slate-400">Select a question from the list to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
