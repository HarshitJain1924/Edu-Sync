type Language = "python" | "cpp" | "java";

const LANGUAGE_MAP: Record<Language, string> = {
  python: "python3", 
  cpp: "cpp",    
  java: "java",  
};

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  compile_output: string;
}

export const runCode = async (
  code: string,
  language: Language,
  input: string = ""
): Promise<ExecutionResult> => {
  const langId = LANGUAGE_MAP[language];

  try {
    // 1. Create a session on Paiza.IO
    const createRes = await fetch("https://api.paiza.io/runners/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_code: code,
        language: langId,
        input: input,
        api_key: "guest",
      }),
    });

    if (!createRes.ok) {
        throw new Error(`Compiler API Error: ${createRes.statusText}`);
    }

    const { id } = await createRes.json();
    if (!id) throw new Error("Failed to get execution session ID");

    // 2. Poll for results
    let status = "running";
    let details: any = null;
    let attempts = 0;

    // Wait for the code to finish executing (max 5 seconds)
    while (status !== "completed" && attempts < 10) {
      await new Promise(r => setTimeout(r, 500));
      const detailsRes = await fetch(`https://api.paiza.io/runners/get_details?id=${id}&api_key=guest`);
      details = await detailsRes.json();
      status = details.status;
      attempts++;
    }

    return {
      stdout: details?.stdout || "",
      stderr: details?.stderr || "",
      compile_output: details?.build_stderr || details?.build_stdout || "",
    };
  } catch (error: any) {
    console.error("Execution error:", error);
    return {
        stdout: "",
        stderr: error.message || "Failed to connect to execution engine",
        compile_output: ""
    };
  }
};
