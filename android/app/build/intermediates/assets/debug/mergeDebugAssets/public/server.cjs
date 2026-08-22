var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "10mb" }));
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  return new import_genai.GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
app.post("/api/gemini/parse-note", async (req, res) => {
  try {
    const { rawNote, inventoryList, customerList } = req.body;
    if (!rawNote || typeof rawNote !== "string") {
      return res.status(400).json({ error: "rawNote is required" });
    }
    const ai = getGeminiClient();
    const inventoryContext = Array.isArray(inventoryList) && inventoryList.length > 0 ? `Existing store inventory items and prices for reference: ${JSON.stringify(inventoryList)}` : "";
    const customerContext = Array.isArray(customerList) && customerList.length > 0 ? `Existing Suki customer names: ${JSON.stringify(customerList)}` : "";
    const prompt = `You are an expert AI parser for Philippine Sari-Sari store notebooks ("Tindahan Notes").
Parse the following unstructured quick entry note into structured JSON.

Note: "${rawNote}"

${inventoryContext}
${customerContext}

Instructions:
- "transaction_type" must be one of: "SALE", "PAUTANG_RECORD", "PAUTANG_PAYMENT", "RESTOCK".
  * "PAUTANG_RECORD": when someone bought on credit/utang (e.g. "pautang marites 1 canton 15", "utang cardo 100").
  * "PAUTANG_PAYMENT": when someone pays their debt (e.g. "bayad marites 50", "singil aling nena 100").
  * "RESTOCK": when store owner added inventory stock (e.g. "restock 10 lucky me 100", "dagdag 5 piattos 160").
  * "SALE": normal item sales (e.g. "2 coke 30", "5 rebisco 40").
- "customer_name": Name of customer if this is PAUTANG_RECORD or PAUTANG_PAYMENT (or null if not mentioned).
- "items": Array of items bought/restocked with "item_name", "quantity" (number), and "total_price" (number). If item name is a shorthand (like "canton"), map it to the full inventory name if matched (like "Lucky Me Pancit Canton").
- "total_amount": Total peso amount for the transaction (number).
- "raw_note": Exact string provided in input.`;
    const config = {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai.Type.OBJECT,
        properties: {
          transaction_type: {
            type: import_genai.Type.STRING,
            description: "Transaction type: SALE, PAUTANG_RECORD, PAUTANG_PAYMENT, or RESTOCK"
          },
          customer_name: {
            type: import_genai.Type.STRING,
            description: "Name of customer or null"
          },
          items: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                item_name: { type: import_genai.Type.STRING },
                quantity: { type: import_genai.Type.NUMBER },
                total_price: { type: import_genai.Type.NUMBER }
              },
              required: ["item_name", "quantity", "total_price"]
            }
          },
          total_amount: { type: import_genai.Type.NUMBER },
          raw_note: { type: import_genai.Type.STRING }
        },
        required: ["transaction_type", "items", "total_amount", "raw_note"]
      }
    };
    const fallbackModels = [
      "gemini-3.7-flash",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite"
    ];
    let response = null;
    let lastError = null;
    for (const targetModel of fallbackModels) {
      try {
        response = await ai.models.generateContent({
          model: targetModel,
          contents: prompt,
          config
        });
        if (response?.text) break;
      } catch (err) {
        lastError = err;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    if (!response?.text) {
      throw lastError || new Error("All models failed to parse note");
    }
    const parsedText = response.text?.trim() || "{}";
    const jsonResult = JSON.parse(parsedText);
    return res.json(jsonResult);
  } catch (err) {
    console.error("Error parsing note with Gemini:", err);
    return res.status(500).json({ error: err?.message || "Failed to parse note with Gemini" });
  }
});
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { history, message, model = "gemini-3.7-flash" } = req.body;
    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }
    const ai = getGeminiClient();
    const validModels = ["gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview", "gemini-flash-latest"];
    let selectedModel = validModels.includes(model) ? model : "gemini-3.7-flash";
    const systemInstruction = `Ikaw si "Suki", ang madiskarteng AI Business Advisor para sa mga Sari-Sari Store owners sa Pilipinas.
Magsalita sa magalang, masayahin, at praktikal na Taglish (Tagalog-English).
Magbigay ng matalinong payo tungkol sa:
1. Pautang management (paano magpaalala nang hindi nakakasira ng pakikisama sa kapitbahay/suki).
2. Paninda inventory optimization (anong paninda ang mabilis mabenta, paano mag-compute ng patong/markup profit).
3. Pag-aayos ng puhunan, cashflow, at pag-iwas sa lugi.
4. Paano palaguin ang maliit na tindahan (tulad ng pagdadagdag ng GCash cash-in/cash-out, cold drinks, atbp.).

Maging direct, encourage the store owner, and use clean, organized bullet points if calculating prices or profit margins.`;
    const contents = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const turn of history) {
        if (turn && turn.content && typeof turn.content === "string") {
          contents.push({
            role: turn.role === "model" ? "model" : "user",
            parts: [{ text: turn.content }]
          });
        }
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });
    const candidateModels = Array.from(
      /* @__PURE__ */ new Set([selectedModel, "gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.7-flash"])
    );
    let response = null;
    let modelUsed = selectedModel;
    let lastError = null;
    for (const targetModel of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: targetModel,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7
          }
        });
        if (response?.text) {
          modelUsed = targetModel;
          break;
        }
      } catch (err) {
        lastError = err;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    if (!response?.text) {
      throw lastError || new Error("All AI models are currently busy. Please try again in a moment.");
    }
    return res.json({ text: response.text, modelUsed });
  } catch (err) {
    console.error("Error in Suki AI Chatbot:", err);
    return res.status(500).json({ error: err?.message || "Failed to process AI chat message" });
  }
});
app.post("/api/gemini/generate-image", async (req, res) => {
  try {
    const { prompt, aspectRatio = "1:1", imageSize = "1K" } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }
    const ai = getGeminiClient();
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image",
        contents: prompt,
        config: {
          imageConfig: {
            aspectRatio,
            imageSize: ["1K", "2K", "4K"].includes(imageSize) ? imageSize : "1K"
          }
        }
      });
    } catch (primaryErr) {
      console.warn("Primary image generation model failed, retrying with lite model:", primaryErr?.message);
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: prompt,
        config: {
          imageConfig: {
            aspectRatio
          }
        }
      });
    }
    const candidates = response.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const mime = part.inlineData.mimeType || "image/png";
          const imageUrl = `data:${mime};base64,${part.inlineData.data}`;
          return res.json({ imageUrl });
        }
      }
    }
    return res.status(500).json({ error: "No image data returned from model" });
  } catch (err) {
    console.error("Error generating store image:", err);
    return res.status(500).json({ error: err?.message || "Failed to generate store image" });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Tindahan Notes server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
