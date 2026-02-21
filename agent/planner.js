import { GoogleGenerativeAI } from "@google/generative-ai";

export async function planGoal(goal) {
  if (!process.env.GEMINI_API_KEY) {
    return {
      plan_title: "Plano simples",
      tasks: [
        {
          title: "Dividir objetivo em etapas",
          description: goal,
          task_type: "llm",
          payload: { prompt: `Crie um plano em etapas para: ${goal}` }
        }
      ]
    };
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
Responda somente JSON válido:

{
 "plan_title": "string",
 "tasks": [
   {
     "title": "string",
     "description": "string",
     "task_type": "llm",
     "payload": { "prompt": "string" }
   }
 ]
}

Objetivo:
${goal}
`;

  const resp = await model.generateContent(prompt);
  const text = resp.response.text();

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1) throw new Error("JSON inválido");

  return JSON.parse(text.slice(first, last + 1));
}
