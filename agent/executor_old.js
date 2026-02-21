import { GoogleGenerativeAI } from "@google/generative-ai";

export async function executeTask(task) {
  const prompt = task.payload?.prompt || task.description;

  if (!process.env.GEMINI_API_KEY) {
    return { ok: true, output: "Execução simulada (sem API key)" };
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const resp = await model.generateContent(prompt);
  return {
    ok: true,
    output: resp.response.text()
  };
}
