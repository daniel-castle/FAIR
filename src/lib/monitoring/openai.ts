import "server-only";
import OpenAI from "openai";

export const MONITORING_PROVIDER = "OpenAI";
export const MONITORING_MODEL = "gpt-5.6-luna";
export const MAX_QUERIES_PER_RUN = 15;

function client() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY in .env.local and restart the app before running a scan.");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 60_000 });
}

export async function requestMonitoredAnswer(query: string) {
  const response = await client().responses.create({
    model: MONITORING_MODEL,
    store: false,
    max_output_tokens: 2000,
    input: [
      { role: "system", content: "Answer the customer's question as a helpful AI recommendation assistant. Give a direct, realistic answer based on your existing knowledge. Do not mention this benchmark or invent certainty you do not have." },
      { role: "user", content: query },
    ],
  });
  if (response.status !== "completed" || !response.output_text.trim()) throw new Error("The monitored model did not return a complete answer.");
  return response.output_text.trim();
}
