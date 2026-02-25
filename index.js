const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
require('dotenv').config();
const { Ollama } = require('ollama');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const app = express();
const port = 3000;
app.use(cors());
app.use(express.json());
app.get('/sentences', (req, res) => {
    // __dirname points to the folder where this script lives
    res.sendFile(path.join(__dirname, 'puterTTS.html'));
});
app.get('/', (req, res) => {
    // __dirname points to the folder where this script lives
    res.sendFile(path.join(__dirname, 'stt.html'));
});
async function aiResponse(word, provider) {
    try {
        const prompt = `
Act as an English language tutor. I will provide you with an English word, and your task is to generate 5 different sentences using that word in a correct context, and the seccond language is arabic. The output must be strictly in JSON format with no additional text or explanations before or after Act as a JSON-only generator. Output must be raw JSON. No conversational filler, no explanations, and no markdown formatting (no backticks or code blocks). Follow this exact structure:

{
  "word": "[the_word]",
  "sentences": [
    {"id": 1, "en": "Sentence in English", "ar": "Translation in Arabic"},
    {"id": 2, "en": "Sentence in English", "ar": "Translation in Arabic"},
    {"id": 3, "en": "Sentence in English", "ar": "Translation in Arabic"},
    {"id": 4, "en": "Sentence in English", "ar": "Translation in Arabic"},
    {"id": 5, "en": "Sentence in English", "ar": "Translation in Arabic"}
  ]
}

The word is: [${word}]
`

        let AiResponse;
        if (provider === "ollama") {
            const ollama = new Ollama();
            const result = await ollama.chat({
                model: 'gemma3:1b',
                messages: [{ role: 'user', content: prompt }],
            })
            AiResponse = cleanAiResFromBackticks(result.message.content);
        } else {

            const result = await geminiModel.generateContent(prompt);
            AiResponse = result.response.text()
        }
        console.log(AiResponse)
        return JSON.parse(AiResponse);

    } catch (error) {
        console.log(error)
    }
}
app.post("/ai/sentences", async (req, res) => {
    const { word, provider } = req.body;
    const result = await aiResponse(word, provider);
    res.json(result);
});
function cleanAiResFromBackticks(text) {
    return text
        // remove ``` blocks
        .replace(/```[\s\S]*?```/gi, match =>
            match.replace(/```/g, '')
        )
        // remove standalone ```
        .replace(/```/g, '')
        // remove word autohotkey (case-insensitive)
        .replace(/json/gi, '')
        // remove comments
        .replace(/^\s*;.*$/gm, '')
        // trim empty lines
        .replace(/^\s*\n/gm, '')
        .trim();
}


async function chatResponse(message, history = []) {
    console.log(history)
    const systemInstruction = `
    Act as a friendly and helpful English language tutor. 
    The user will talk to you, and you should respond naturally, encouragingly, and briefly. 
    If they make a mistake, gently correct them. 
    Your response should be in English.
  `;

    try {

        const formattedHistory = history.map(h => ({
            role: h.role === "assistant" ? "model" : "user",
            parts: [{ text: h.text }],
        }));

        const chat = geminiModel.startChat({
            history: formattedHistory,
            systemInstruction: {
                role: "system",
                parts: [{ text: systemInstruction }]
            },
        });

        const result = await chat.sendMessage(message);
        return result.response.text();


    } catch (error) {
        console.error("Chat Error:", error.message || error);
        return `Error: ${error.message}`;  // temporarily return the real error
    }
}

app.post("/ai/chat", async (req, res) => {
    const { message, history } = req.body;
    const result = await chatResponse(message, history);
    console.log(result)
    res.json({ response: result });
});



app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
