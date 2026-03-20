/**
 * Unified Job Service
 * Fetches and normalizes jobs from multiple sources (Adzuna, Remotive)
 */

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  category: string;
  tags: string[];
  salary: string;
  posted_date: string;
  apply_url: string;
  source: string;
  description: string;
  company_logo_url?: string;
}

const ADZUNA_APP_ID = import.meta.env.VITE_ADZUNA_APP_ID || "PLACEHOLDER_ID";
const ADZUNA_APP_KEY = import.meta.env.VITE_ADZUNA_APP_KEY || "PLACEHOLDER_KEY";

const decodeHtml = (html: string) => {
  if (!html) return "";
  // Better regex-based decoding for common entities including numeric ones
  return html
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—');
};

const COMMON_SKILLS = [
  "React", "Node.js", "Python", "Java", "AWS", "UI/UX", "TypeScript", "Docker", "SQL", "Next.js",
  "JavaScript", "C++", "C#", "Ruby", "Go", "Kubernetes", "Azure", "GCP", "MongoDB", "PostgreSQL",
  "HTML", "CSS", "Angular", "Vue", "PHP", "Laravel", "Spring", "Django", "Flask", "Machine Learning",
  "Data Science", "AI", "Figma", "Agile", "Scrum", "Git", "Linux", "REST API", "GraphQL", "Redis", "Kafka",
  "Project Management", "Leadership", "System Architecture", "Cloud Computing"
];

const extractSkills = (title: string, desc: string, category: string): string[] => {
  const text = `${title} ${desc}`.toLowerCase();
  const found = new Set<string>();
  
  for (const skill of COMMON_SKILLS) {
    if (skill.length <= 4 || skill.toLowerCase() === "java") {
      const regex = new RegExp(`\\b${skill.replace(/\+/g, '\\+')}\\b`, 'i');
      if (regex.test(text)) found.add(skill);
    } else {
      if (text.includes(skill.toLowerCase())) found.add(skill);
    }
  }

  // Fallback inferences if no obvious skills found
  if (found.size === 0) {
    if (title.toLowerCase().includes("manager") || title.toLowerCase().includes("director") || title.toLowerCase().includes("advisor")) {
      found.add("Leadership");
      found.add("Agile");
      found.add("Project Management");
    } else if (title.toLowerCase().includes("frontend") || title.toLowerCase().includes("ui")) {
      found.add("React");
      found.add("JavaScript");
      found.add("CSS");
    } else if (title.toLowerCase().includes("backend") || title.toLowerCase().includes("data")) {
      found.add("Python");
      found.add("SQL");
    } else {
      found.add("Software Engineering");
      found.add("Agile");
    }
  }
  
  return Array.from(found);
};

const extractSalary = (text: string): string => {
  if (!text) return "";
  // Look for INR like ₹5,000, ₹10L, ₹5L - ₹10L, 10-20 LPA
  const inrMatch = text.match(/(₹[\d,]+(\s*[kKlLmM])?(\s*-\s*₹?[\d,]+(\s*[kKlLmM])?)?|[\d,]+(\s*-\s*[\d,]+)?\s*LPA)/i);
  if (inrMatch) return inrMatch[0].toUpperCase();
  
  // Look for USD like $50k, $100,000 - $150,000
  const usdMatch = text.match(/\$[\d,]+(\s*[kKmM])?(\s*-\s*\$?[\d,]+(\s*[kKmM])?)?/);
  if (usdMatch) return usdMatch[0];
  
  return "";
};

export const jobService = {
  async fetchJobs(page: number = 1, filters: { role?: string, location?: string, category?: string } = {}): Promise<Job[]> {
    const resultsPerPage = 50;
    const allJobs: Job[] = [];

    // 1. Fetch from Adzuna (India focus)
    try {
      const what = encodeURIComponent(filters.role || (filters.category ? filters.category.replace("-", " ") : "software developer"));
      const where = encodeURIComponent(filters.location || "india");
      
      // Adzuna uses category tags. If a category is selected we'll just prioritize it in the 'what' query for simplicity,
      // as Adzuna's category tags are specifically coded (e.g. it-jobs) rather than free text.
      const adzunaUrl = `https://api.adzuna.com/v1/api/jobs/in/search/${page}?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&results_per_page=${resultsPerPage}&what=${what}&where=${where}`;
      
      const response = await fetch(adzunaUrl);
      if (response.ok) {
        const data = await response.json();
        // Use normalization helper to keep it clean
        const adzunaJobs = (data.results || []).map((j: any) => this.normalizeAdzunaJob(j));
        allJobs.push(...adzunaJobs);
      }
    } catch (error) {
      console.error("Adzuna API Error:", error);
    }

    // 2. Fetch from Remotive (Remote focus)
    // Only fetch on first page or if explicitly searching for remote to avoid duplication/bloat
    if (page === 1 || filters.location?.toLowerCase().includes("remote")) {
      try {
        const remotiveUrl = `https://remotive.com/api/remote-jobs?limit=100`;
        const response = await fetch(remotiveUrl);
        if (response.ok) {
          const data = await response.json();
          const remotiveJobs = (data.jobs || []).map((j: any) => ({
            id: `rem-${j.id}`,
            title: decodeHtml(j.title),
            company: decodeHtml(j.company_name),
            location: decodeHtml(j.candidate_required_location || "Remote"),
            category: j.category,
            tags: j.tags || [],
            salary: j.salary || "",
            posted_date: j.publication_date,
            apply_url: j.url,
            source: "Remotive",
            description: j.description || "",
            company_logo_url: j.company_logo
          }));
          
          // Apply filters locally for Remotive since the API is limited
          let filtered = remotiveJobs;
          
          if (filters.category) {
            const cat = filters.category.toLowerCase().replace("-", " ");
            filtered = filtered.filter((j: Job) => j.category?.toLowerCase().includes(cat) || j.title.toLowerCase().includes(cat));
          }

          if (filters.role) {
            const q = filters.role.toLowerCase();
            filtered = filtered.filter((j: Job) => j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q));
          }
          
          if (filters.location) {
             const loc = filters.location.toLowerCase();
             // Only filter if they are NOT explicitly looking for remote (since Remotive is all remote)
             // or if they are looking for a specific location within Remote jobs (e.g. "Remote UK")
             if (loc !== "remote") {
               filtered = filtered.filter((j: Job) => j.location.toLowerCase().includes(loc) || j.location.toLowerCase().includes("anywhere"));
             }
          }

          allJobs.push(...filtered);
        }
      } catch (error) {
        console.error("Remotive API Error:", error);
      }
    }
    
    // Sort combined jobs by newest first
    allJobs.sort((a, b) => new Date(b.posted_date).getTime() - new Date(a.posted_date).getTime());

    return allJobs;
  },

  async getJobById(id: string): Promise<Job | null> {
    const [source, jobId] = id.split("-");
    
    if (source === "rem") {
      try {
        const response = await fetch(`https://remotive.com/api/remote-jobs?limit=1000`);
        if (response.ok) {
          const data = await response.json();
          const job = (data.jobs || []).find((j: any) => String(j.id) === jobId);
          if (job) {
            return {
              id: `rem-${job.id}`,
              title: decodeHtml(job.title),
              company: decodeHtml(job.company_name),
              location: decodeHtml(job.candidate_required_location || "Remote"),
              category: job.category,
              tags: job.tags || [],
              salary: job.salary || "",
              posted_date: job.publication_date,
              apply_url: job.url,
              source: "Remotive",
              description: job.description || "",
              company_logo_url: job.company_logo
            };
          }
        }
      } catch (error) {
        console.error("Error fetching Remotive job detail:", error);
      }
    } else if (source === "adz") {
      try {
        // Try searching for the job by its ID in the search endpoint
        // NOTE: Adzuna sometimes doesn't support &id= on all accounts
        // We add a fallback search by title if id search fails
        const url = `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&results_per_page=1&id=${jobId}`;
        
        try {
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            const job = data.results?.[0];
            if (job) return this.normalizeAdzunaJob(job);
          }
        } catch (fetchErr) {
          // If the ID search fails (CORS/400), we'll let it return null
          // The component should handle it by using state if available
          console.warn("Adzuna ID fetch failed, likely CORS/400 on error response:", fetchErr);
        }
      } catch (error) {
        console.error("Error in Adzuna job detail lookup:", error);
      }
    }
    return null;
  },

  normalizeAdzunaJob(j: any): Job {
    let desc = j.description || "";
    // Clean up trailing cutoff characters and add nice ellipses since Adzuna sends excerpts
    desc = desc.replace(/\s*[\.\,\;]*\s*$/, "") + "...";
    
    return {
      id: `adz-${j.id}`,
      title: decodeHtml(j.title),
      company: decodeHtml(j.company?.display_name || "Unknown Company"),
      location: decodeHtml(j.location?.display_name || "India"),
      category: j.category?.label || "Uncategorized",
      tags: extractSkills(j.title, desc, j.category?.label || ""),
      salary: j.salary_min ? `${j.salary_min}${j.salary_max ? " - " + j.salary_max : ""}` : extractSalary(desc),
      posted_date: j.created,
      apply_url: j.redirect_url,
      source: "Adzuna",
      description: desc
    };
  }
};
