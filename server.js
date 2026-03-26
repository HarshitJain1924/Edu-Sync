import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { parseQuestionsFromText } from "./parser.js";
import { extractPdfText } from "./pdf-extractor.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const app = express();

// Initialize Supabase client for backend
const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://dbwxtcduwskfzundhzeo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Allow JSON bodies and CORS for API calls (e.g. resume PDF parsing)
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "5mb" }));

// Middleware to verify admin role from Supabase auth token
const requireAdminRole = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ error: "No authorization token" });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Fetch user role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: "User profile not found" });
    }

    if (profile.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    req.user = user;
    req.accessToken = token;
    next();
  } catch (err) {
    console.error("[Auth Middleware] Error:", err);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

const getRlsClientForToken = (token) => {
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !publishableKey) return supabase;

  return createClient(supabaseUrl, publishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};

app.get("/api/health", (_req, res) => {
  return res.json({ ok: true, service: "pdf-parser", ts: Date.now() });
});

// PDF parsing endpoint - ADMIN ONLY
app.post("/api/parse-resume-pdf", requireAdminRole, async (req, res) => {
  try {
    console.log("[PDF API] /api/parse-resume-pdf hit (admin only)");
    const { data } = req.body || {};
    if (!data || typeof data !== "string") {
      console.log("[PDF API] Missing or invalid base64 payload");
      return res.status(400).json({ error: "Missing PDF data" });
    }

    const buffer = Buffer.from(data, "base64");
    const text = await extractPdfText(buffer);
    const questions = parseQuestionsFromText(text);

    console.log("[PDF API] text chars:", text.length, "questions:", questions.length);
    console.log("[PDF API] ===== Extracted Text Preview (first 6000 chars) =====");
    console.log(text.slice(0, 6000));
    console.log("[PDF API] ===== Parsed Questions JSON =====");
    console.log(JSON.stringify(questions, null, 2));
    console.log("[PDF API] ===== End Parsed Output =====");

    return res.json({ text, questions, total: questions.length });
  } catch (err) {
    console.error("PDF parse error", err);
    return res.status(500).json({ error: "Failed to parse PDF" });
  }
});

// ========== PLACEMENT QUESTIONS API ==========

// GET /api/questions - Fetch questions with filters and pagination
app.get("/api/questions", async (req, res) => {
  try {
    const { company, difficulty, search, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * pageLimit;

    let query = supabase
      .from("placement_questions")
      .select("*", { count: "exact" });

    // Apply filters
    if (company && company !== "all") {
      query = query.eq("company", company);
    }
    if (difficulty && difficulty !== "all") {
      query = query.eq("difficulty", difficulty);
    }
    if (search) {
      query = query.ilike("question", `%${search}%`);
    }

    // Pagination
    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + pageLimit - 1);

    if (error) {
      console.error("[Questions API] Error:", error);
      return res.status(500).json({ error: "Failed to fetch questions" });
    }

    return res.json({
      questions: data || [],
      total: count || 0,
      page: pageNum,
      pageSize: pageLimit,
      totalPages: Math.ceil((count || 0) / pageLimit),
    });
  } catch (err) {
    console.error("[Questions API] Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/questions - Bulk import questions (ADMIN ONLY)
app.post("/api/questions", requireAdminRole, async (req, res) => {
  try {
    const rlsClient = getRlsClientForToken(req.accessToken);
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "Invalid questions array" });
    }

    // Validate, sanitize and normalize
    const validQuestions = questions
      .map((q) => {
        // Handle options: could be array or stringified JSON
        let parsedOptions = [];
        if (Array.isArray(q.options)) {
          parsedOptions = q.options.map(String);
        } else if (typeof q.options === "string") {
          try {
            const parsed = JSON.parse(q.options);
            parsedOptions = Array.isArray(parsed) ? parsed.map(String) : [];
          } catch {
            parsedOptions = [];
          }
        }
        return {
          company: String(q.company || "").trim() || "general",
          question: String(q.question || "").trim(),
          options: parsedOptions,
          correct_answer: String(q.correctAnswer || q.correct_answer || "").trim(),
          difficulty: String(q.difficulty || "medium").toLowerCase(),
          explanation: String(q.explanation || "").trim(),
          topic: q.topic ? String(q.topic).trim() : null,
        };
      })
      .filter(
        (q) =>
          q.question.length > 5 &&
          q.options.length >= 2 &&
          q.correct_answer.length > 0
      );

    const uniqueQuestionsMap = new Map();
    validQuestions.forEach((q) => {
      const dedupeKey = `${q.company.toLowerCase()}::${q.question.toLowerCase()}`;
      if (!uniqueQuestionsMap.has(dedupeKey)) {
        uniqueQuestionsMap.set(dedupeKey, q);
      }
    });
    const dedupedQuestions = Array.from(uniqueQuestionsMap.values());

    if (dedupedQuestions.length === 0) {
      return res.status(400).json({ error: "No valid questions after validation" });
    }

    // Upsert into Supabase to prevent duplicates by (company, question)
    const { data, error } = await rlsClient
      .from("placement_questions")
      .upsert(dedupedQuestions, { onConflict: "company,question", ignoreDuplicates: true })
      .select("id, company, question, difficulty, created_at");

    if (error) {
      console.error("[Questions API] Insert error:", error);
      return res.status(500).json({ error: "Failed to insert questions" });
    }

    console.log(`[Questions API] Processed ${dedupedQuestions.length} deduplicated questions`);
    return res.json({
      success: true,
      inserted: data?.length || 0,
      message: `Successfully imported ${data?.length || 0} questions`,
    });
  } catch (err) {
    console.error("[Questions API] Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/questions - Clear all questions (ADMIN ONLY)
app.delete("/api/questions", requireAdminRole, async (req, res) => {
  try {
    const rlsClient = getRlsClientForToken(req.accessToken);

    const { error } = await rlsClient
      .from("placement_questions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

    if (error) {
      console.error("[Questions API] Delete error:", error);
      return res.status(500).json({ error: "Failed to delete questions" });
    }

    console.log("[Questions API] Cleared all questions");
    return res.json({ success: true, message: "Question bank cleared" });
  } catch (err) {
    console.error("[Questions API] Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/questions/stats - Get question bank statistics
app.get("/api/questions/stats", async (req, res) => {
  try {
    // Get total count
    const { count: totalCount } = await supabase
      .from("placement_questions")
      .select("*", { count: "exact", head: true });

    // Get count by company
    const { data: byCompany } = await supabase
      .from("placement_questions")
      .select("company");

    const companyStats = {};
    (byCompany || []).forEach((row) => {
      const company = row.company || "general";
      companyStats[company] = (companyStats[company] || 0) + 1;
    });

    return res.json({
      total: totalCount || 0,
      companies: Object.keys(companyStats).length,
      byCompany: companyStats,
    });
  } catch (err) {
    console.error("[Questions Stats API] Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

io.on("connection", socket => {
  socket.on("join-room", ({ roomId, name, userId }) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
      name,
      userId
    });
  });

  socket.on("signal", (payload) => {
    io.to(payload.to).emit("signal", {
      ...payload,
      from: socket.id
    });
  });

  socket.on("update-metadata", ({ roomId, name, userId }) => {
    socket.to(roomId).emit("metadata-updated", {
      socketId: socket.id,
      name,
      userId
    });
  });

  socket.on("leave-room", ({ roomId }) => {
    socket.to(roomId).emit("user-left", {
      socketId: socket.id
    });
  });

  socket.on("disconnecting", () => {
    // Notify all rooms this socket was in that it's leaving
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit("user-left", { socketId: socket.id });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = Number(process.env.PORT || 4000);

server.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT to a different value.`);
    process.exit(1);
  }

  console.error("Server failed to start:", err);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`WebRTC signaling server running on port ${PORT}`);
});
