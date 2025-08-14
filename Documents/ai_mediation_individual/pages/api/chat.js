export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const {
    messages = [],
    model = "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    temperature = 0.4,
    max_tokens = 512
  } = req.body || {};

  const r = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.TOGETHER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens })
  });

  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  return res.status(200).json({ reply: text });
}
