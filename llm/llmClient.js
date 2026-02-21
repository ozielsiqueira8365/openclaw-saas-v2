// llm/llmClient.js
import fetch from "node-fetch";

const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct";

function extractMessage(choice) {
  if (!choice || !choice.message) return null;

  const msg = choice.message;

  // 🔥 ORDEM IMPORTANTE
  if (typeof msg.content === "string" && msg.content.trim() !== "") {
    return msg.content.trim();
  }

  if (typeof msg.reasoning_content === "string" && msg.reasoning_content.trim() !== "") {
    return msg.reasoning_content.trim();
  }

  if (typeof msg.reasoning === "string" && msg.reasoning.trim() !== "") {
    return msg.reasoning.trim();
  }

  return null;
}

export async function callLLM({ messages, temperature = 0.7, max_tokens = 1024 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000); // 45s hard timeout

  try {
    const res = await fetch(NVIDIA_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        max_tokens,
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();

    if (!data.choices || !data.choices.length) {
      throw new Error("LLM retornou resposta sem choices");
    }

    const text = extractMessage(data.choices[0]);

    if (!text) {
      throw new Error("LLM retornou resposta vazia (content, reasoning_content e reasoning null)");
    }

    return {
      text,
      usage: data.usage || null,
      raw: data
    };

  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("LLM Timeout (abortado após 45s)");
    }

    throw err;
  }
}