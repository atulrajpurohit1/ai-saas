
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  console.log("Using API Key:", apiKey ? "FOUND" : "MISSING");
  console.log("Using Model:", modelName);

  if (!apiKey) return;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  try {
    const result = await model.generateContent("Hello, are you working?");
    const response = await result.response;
    console.log("Gemini Response:", response.text());
    console.log("SUCCESS");
  } catch (error) {
    console.error("Gemini Error:", error.message);
  }
}

testGemini();
