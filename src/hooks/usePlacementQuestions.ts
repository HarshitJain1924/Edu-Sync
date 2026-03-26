import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlacementQuestion {
  id: string;
  company: string;
  question: string;
  options: string[];
  correct_answer: string;
  difficulty: string;
  explanation?: string;
  topic?: string;
  created_at: string;
}

interface QuestionFilters {
  company?: string;
  difficulty?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface QuestionsResponse {
  questions: PlacementQuestion[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Fetch placement questions from Supabase with filtering and pagination
 */
export const usePlacementQuestions = (filters?: QuestionFilters) => {
  const { company, difficulty, search, page = 1, limit = 20 } = filters || {};

  return useQuery<QuestionsResponse>({
    queryKey: ["placementQuestions", { company, difficulty, search, page, limit }],
    queryFn: async () => {
      let query = supabase
        .from("placement_questions")
        .select("*", { count: "exact" });

      if (company && company !== "all") {
        query = query.eq("company", company);
      }
      if (difficulty && difficulty !== "all") {
        query = query.eq("difficulty", difficulty);
      }
      if (search) {
        query = query.ilike("question", `%${search}%`);
      }

      const offset = (page - 1) * limit;
      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        questions: (data || []) as PlacementQuestion[],
        total: count || 0,
        page,
        pageSize: limit,
        totalPages: Math.ceil((count || 0) / limit),
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
};

/**
 * Fetch question bank statistics
 */
export const usePlacementQuestionsStats = () => {
  return useQuery({
    queryKey: ["placementQuestionsStats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("placement_questions")
        .select("company, difficulty", { count: "exact" });

      if (error) throw error;

      const stats = {
        total: 0,
        companies: new Set<string>(),
        difficulties: new Set<string>(),
        byCompany: {} as Record<string, number>,
        byDifficulty: {} as Record<string, number>,
      };

      (data || []).forEach((row: any) => {
        const company = row.company || "general";
        const difficulty = row.difficulty || "medium";

        stats.total++;
        stats.companies.add(company);
        stats.difficulties.add(difficulty);
        stats.byCompany[company] = (stats.byCompany[company] || 0) + 1;
        stats.byDifficulty[difficulty] = (stats.byDifficulty[difficulty] || 0) + 1;
      });

      return {
        total: stats.total,
        companies: Array.from(stats.companies),
        difficulties: Array.from(stats.difficulties),
        byCompany: stats.byCompany,
        byDifficulty: stats.byDifficulty,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Hook to invalidate and refresh questions cache
 */
export const useRefreshQuestions = () => {
  const queryClient = useQueryClient();

  return {
    invalidateQuestions: () => {
      queryClient.invalidateQueries({ queryKey: ["placementQuestions"] });
    },
    invalidateStats: () => {
      queryClient.invalidateQueries({ queryKey: ["placementQuestionsStats"] });
    },
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ["placementQuestions"] });
      queryClient.invalidateQueries({ queryKey: ["placementQuestionsStats"] });
    },
  };
};
