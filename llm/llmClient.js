export async function callLLM({
  system,
  messages = [],
  temperature = 0.3,
  max_tokens = 800
}) {
  const apiKey = process.env.MOONSHOT_API_KEY;
  const baseUrl = (process.env.MOONSHOT_BASE_URL || "").replace(/\/+$/, "");
  const model = process.env.MOONSHOT_MODEL;

  if (!apiKey) throw Object.assign(new Error("MOONSHOT_API_KEY não definido"), { status: 500 });
  if (!baseUrl) throw Object.assign(new Error("MOONSHOT_BASE_URL não definido"), { status: 500 });
  if (!model) throw Object.assign(new Error("MOONSHOT_MODEL não definido"), { status: 500 });

  const payload = {
    model,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      ...messages
    ],
    temperature,
    max_tokens
  };

  const url = `${baseUrl}/chat/completions`;

  // ✅ Timeout hard (25s)
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25000);

  const started = Date.now();
  console.log("🧠 callLLM ->", url, "model=", model);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const text = await res.text();
    const ms = Date.now() - started;

    if (!res.ok) {
      console.error("❌ callLLM HTTP", res.status, "ms=", ms, "body=", text.slice(0, 400));
      const err = Object.assign(new Error(text || "LLM error"), { status: res.status, payload: text });
      throw err;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("❌ callLLM JSON inválido:", text.slice(0, 400));
      throw Object.assign(new Error("LLM retornou JSON inválido"), { status: 502, payload: text });
    }

    const content =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.delta?.content ??
      "";

    console.log("✅ callLLM ok ms=", ms, "chars=", String(content || "").length);

    return String(content || "");
  } catch (e) {
    if (e?.name === "AbortError") {
      console.error("⏱️ callLLM timeout (25s)");
      throw Object.assign(new Error("LLM timeout"), { status: 504 });
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}