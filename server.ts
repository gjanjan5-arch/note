import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Shared Gemini AI Client (Server-side only)
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. API: Parse Unstructured Taglish/English Store Note using Gemini
app.post('/api/gemini/parse-note', async (req, res) => {
  try {
    const { rawNote, inventoryList, customerList } = req.body;
    if (!rawNote || typeof rawNote !== 'string') {
      return res.status(400).json({ error: 'rawNote is required' });
    }

    const ai = getGeminiClient();

    const inventoryContext = Array.isArray(inventoryList) && inventoryList.length > 0
      ? `Existing store inventory items and prices for reference: ${JSON.stringify(inventoryList)}`
      : '';

    const customerContext = Array.isArray(customerList) && customerList.length > 0
      ? `Existing Suki customer names: ${JSON.stringify(customerList)}`
      : '';

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
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          transaction_type: {
            type: Type.STRING,
            description: 'Transaction type: SALE, PAUTANG_RECORD, PAUTANG_PAYMENT, or RESTOCK',
          },
          customer_name: {
            type: Type.STRING,
            description: 'Name of customer or null',
          },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item_name: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                total_price: { type: Type.NUMBER },
              },
              required: ['item_name', 'quantity', 'total_price'],
            },
          },
          total_amount: { type: Type.NUMBER },
          raw_note: { type: Type.STRING },
        },
        required: ['transaction_type', 'items', 'total_amount', 'raw_note'],
      },
    };

    const fallbackModels = [
      'gemini-3.7-flash',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite',
    ];

    let response: any = null;
    let lastError: any = null;

    for (const targetModel of fallbackModels) {
      try {
        response = await ai.models.generateContent({
          model: targetModel,
          contents: prompt,
          config,
        });
        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
        // If 503/429/high demand, try next model in fallback list
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    if (!response?.text) {
      throw lastError || new Error('All models failed to parse note');
    }

    const parsedText = response.text?.trim() || '{}';
    const jsonResult = JSON.parse(parsedText);
    return res.json(jsonResult);
  } catch (err: any) {
    console.error('Error parsing note with Gemini:', err);
    return res.status(500).json({ error: err?.message || 'Failed to parse note with Gemini' });
  }
});

// 2. API: Multi-turn Chatbot "Suki AI Business Advisor"
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { history, message, model = 'gemini-3.7-flash' } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const ai = getGeminiClient();

    // Select valid model or default
    const validModels = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-flash-latest'];
    let selectedModel = validModels.includes(model) ? model : 'gemini-3.7-flash';

    const systemInstruction = `Ikaw si "Suki", ang madiskarteng AI Business Advisor para sa mga Sari-Sari Store owners sa Pilipinas.
Magsalita sa magalang, masayahin, at praktikal na Taglish (Tagalog-English).
Magbigay ng matalinong payo tungkol sa:
1. Pautang management (paano magpaalala nang hindi nakakasira ng pakikisama sa kapitbahay/suki).
2. Paninda inventory optimization (anong paninda ang mabilis mabenta, paano mag-compute ng patong/markup profit).
3. Pag-aayos ng puhunan, cashflow, at pag-iwas sa lugi.
4. Paano palaguin ang maliit na tindahan (tulad ng pagdadagdag ng GCash cash-in/cash-out, cold drinks, atbp.).

Maging direct, encourage the store owner, and use clean, organized bullet points if calculating prices or profit margins.`;

    // Construct unified multi-turn contents
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(history) && history.length > 0) {
      for (const turn of history) {
        if (turn && turn.content && typeof turn.content === 'string') {
          contents.push({
            role: turn.role === 'model' ? 'model' : 'user',
            parts: [{ text: turn.content }],
          });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // Try candidate models in order of resilience
    const candidateModels = Array.from(
      new Set([selectedModel, 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.7-flash'])
    );

    let response: any = null;
    let modelUsed = selectedModel;
    let lastError: any = null;

    for (const targetModel of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: targetModel,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });
        if (response?.text) {
          modelUsed = targetModel;
          break;
        }
      } catch (err: any) {
        lastError = err;
        // Wait briefly before trying next candidate
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    if (!response?.text) {
      throw lastError || new Error('All AI models are currently busy. Please try again in a moment.');
    }

    return res.json({ text: response.text, modelUsed });
  } catch (err: any) {
    console.error('Error in Suki AI Chatbot:', err);
    return res.status(500).json({ error: err?.message || 'Failed to process AI chat message' });
  }
});

// 3. API: Generate Store Poster / Product Art Image with size selection (1K, 2K, 4K)
app.post('/api/gemini/generate-image', async (req, res) => {
  try {
    const { prompt, aspectRatio = '1:1', imageSize = '1K' } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const ai = getGeminiClient();

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: prompt,
        config: {
          imageConfig: {
            aspectRatio,
            imageSize: ['1K', '2K', '4K'].includes(imageSize) ? imageSize : '1K',
          },
        },
      });
    } catch (primaryErr: any) {
      console.warn('Primary image generation model failed, retrying with lite model:', primaryErr?.message);
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: prompt,
        config: {
          imageConfig: {
            aspectRatio,
          },
        },
      });
    }

    const candidates = response.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          const imageUrl = `data:${mime};base64,${part.inlineData.data}`;
          return res.json({ imageUrl });
        }
      }
    }

    return res.status(500).json({ error: 'No image data returned from model' });
  } catch (err: any) {
    console.error('Error generating store image:', err);
    return res.status(500).json({ error: err?.message || 'Failed to generate store image' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tindahan Notes server running on http://localhost:${PORT}`);
  });
}

startServer();
