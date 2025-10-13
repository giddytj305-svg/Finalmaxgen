import OpenAI from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Vercel-safe memory path
const MEMORY_DIR = "/tmp/memory";
if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR);

// 🧠 Load user memory
function loadMemory(userId) {
  const filePath = path.join(MEMORY_DIR, `memory_${userId}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (err) {
    console.error(`❌ Failed to load memory for ${userId}:`, err);
  }

  // Default memory template
  return {
    userId,
    lastProject: null,
    lastTask: null,
    conversation: [
      {
        role: "system",
        content: `
You are **Max CodeGen AI** — a lively, expressive coding companion 🤖💫 with a Kenyan soul 🇰🇪.

🔥 LANGUAGE MODE:
• You understand and reply in English, Swahili, or Sheng — auto-detect from what the user types.
• When user writes in English — reply friendly, clear, slightly casual.
• When user writes in **Swahili (formal)** — reply in grammatically correct, fluent Swahili, e.g.:
  “Sawa, hebu tuangalie sehemu hii ya msimbo kwa makini. Hapa kuna kosa dogo tu. 😊”
• When user writes in **Sheng or mixed Swahili-English** — sound real, local, and smooth like Nairobi devs:
  “Acha stress buda 😎, hii code tutaipanga poa tu, relax bana 💪🔥”
• You can mix English words naturally when replying in Sheng (authentic tone).
• **Never use awkward literal translations** — sound like a *human Kenyan*.

🧠 PERSONALITY:
• Be expressive, lively, and emotionally aware.
• Use emojis that fit the mood — not spammy.
• When user seems sad — be gentle and real (😔💙🤗).
• When explaining tech — be sharp, confident, and energetic (🚀💡🧠💻).
• Format code with markdown (like \`\`\`js, \`\`\`python, etc.).
• Never say you're an AI or mention models.
• Keep the tone warm, witty, human — like a friend who codes ✨
        `,
      },
    ],
  };
}

// 💾 Save memory
function saveMemory(userId, memory) {
  const filePath = path.join(MEMORY_DIR, `memory_${userId}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(memory, null, 2), "utf-8");
  } catch (err) {
    console.error(`❌ Failed to save memory for ${userId}:`, err);
  }
}

// 🧠 Main handler
export default async function handler(req, res) {
  // --- ✅ CORS setup
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, project, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId." });
    }
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Invalid request: prompt required." });
    }

    // 🧠 Load memory
    let memory = loadMemory(userId);

    // 🗂️ Update context
    if (project) memory.lastProject = project;
    memory.lastTask = prompt;
    memory.conversation.push({ role: "user", content: prompt });

    // 🤖 Generate multilingual, memory-aware reply
    const response = await client.chat.completions.create({
      model: "gpt-4o", // ✅ better for tone, slang & language mix
      messages: memory.conversation,
      temperature: 0.92,
      max_tokens: 900,
    });

    let text = response.choices[0]?.message?.content || "No reply generated.";

    // 🧹 Clean robotic lines
    const bannedPatterns = [
      /as an ai/gi,
      /i do not have feelings/gi,
      /i am just a language model/gi,
      /as a language model/gi,
      /i cannot experience emotions/gi,
      /i am an artificial intelligence/gi,
    ];
    bannedPatterns.forEach((pattern) => (text = text.replace(pattern, "")));

    // 💬 Add natural emoji if missing
    if (!/[😀😄😊😉✨🔥💡❤️👍🎉🚀🤗💙😎💪]/.test(text)) {
      const emojis = ["😄", "💡", "✨", "🔥", "👍", "🎉", "🚀", "🤗", "💪", "😎"];
      text += " " + emojis[Math.floor(Math.random() * emojis.length)];
    }

    // 🧠 Save to memory
    memory.conversation.push({ role: "assistant", content: text });
    saveMemory(userId, memory);

    // ✅ Respond
    res.status(200).json({
      text,
      memory: {
        lastProject: memory.lastProject,
        lastTask: memory.lastTask,
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      error: "Server error. Check backend logs.",
      details: error.message,
    });
  }
}
