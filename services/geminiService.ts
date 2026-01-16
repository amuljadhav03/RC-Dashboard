
import { GoogleGenAI, Type } from "@google/genai";
import { DashboardData, DashboardInsights } from "../types";

export const analyzeSheetData = async (data: DashboardData): Promise<DashboardInsights> => {
  // Always use {apiKey: process.env.API_KEY} as the named parameter.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    You are a Lead QA Engineer. Analyze the following platform-wise test execution report.
    
    Data Source:
    - Recent Build Logs: ${JSON.stringify(data.rows)}
    
    Required Intelligence:
    1. Compare Android and iOS stability. Which platform is currently the bottleneck?
    2. Identify specific builds where one platform significantly outperformed the other.
    3. Note the trend of 'Critical Issues' per platform.
    4. Provide actionable engineering recommendations to align quality across platforms.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "A summary of the platform parity health." },
            keyInsights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING, description: "positive, negative, or neutral" }
                },
                required: ["title", "description", "type"]
              }
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["summary", "keyInsights", "recommendations"]
        }
      }
    });

    // Access the .text property directly to extract string output.
    const result = JSON.parse(response.text || '{}');
    return result as DashboardInsights;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze platform-wise QA data.");
  }
};
