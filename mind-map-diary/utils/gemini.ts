import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export const generateIdeas = async (
    topic: string,
    contextPath: string[] = [],
    existingChildren: string[] = [],
    content: string = ""
): Promise<string[]> => {
    if (!API_KEY) {
        console.error("Gemini API Key is missing");
        throw new Error("Gemini API Key is missing");
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Construct context string
        const contextStr = contextPath.length > 0
            ? `Context (path from root): ${contextPath.join(" > ")} > ${topic}`
            : `Topic: ${topic}`;

        // Construct exclusion string
        const exclusionStr = existingChildren.length > 0
            ? `Exclude these existing ideas: ${existingChildren.join(", ")}`
            : "";

        const contentStr = content ? `Node Content: "${content}"` : "";

        // Prompt engineering for structured output
        const prompt = `
    You are a creative assistant helping to brainstorm for a mind map.
    ${contextStr}
    ${contentStr}
    
    Task: Generate 3 creative, distinct, and relevant sub-topics or child nodes for "${topic}".
    The suggestions should be based on the topic and the content provided.
    ${exclusionStr}

    Return ONLY a simple comma-separated list of strings.
    Example output: Idea 1, Idea 2, Idea 3
    Do not include numbering, bullets, or any other text.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse the comma-separated list
        const ideas = text.split(',').map(idea => idea.trim()).filter(idea => idea.length > 0);

        return ideas.slice(0, 3); // Ensure maximum 3 items
    } catch (error) {
        console.error("Error generating ideas with Gemini:", error);
        throw error;
    }
};

export const summarizeDiary = async (
    markdownContent: string
): Promise<{ summary: string; emotion: string }> => {
    if (!API_KEY) {
        throw new Error("Gemini API Key is missing");
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
    You are a warm, empathetic diary assistant. 
    Below is a mind map of someone's day in Markdown format:
    
    ${markdownContent}
    
    Task:
    1. Write a 3-4 sentence summary of their day in a warm, encouraging, and supportive tone (Korean).
    2. Pick ONE emoji that best represents the overall emotion/mood of the day.
    
    Return the result in JSON format like this:
    {
      "summary": "오늘 정말 고생 많으셨어요...",
      "emotion": "😊"
    }
    
    Return ONLY the JSON string. Do not include markdown blocks or any other text.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up the response just in case it's wrapped in markdown code blocks
        const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();
        const data = JSON.parse(cleanedText);

        return {
            summary: data.summary || "내용을 요약하지 못했어요.",
            emotion: data.emotion || "📝"
        };
    } catch (error) {
        console.error("Error summarizing diary with Gemini:", error);
        return {
            summary: "요약 중 오류가 발생했습니다.",
            emotion: "⚠️"
        };
    }
};

export interface ReportResult {
    chronological: string;
    thematic: string;
    summary: string;
    emotion: string;
}

export const generateReport = async (
    type: 'weekly' | 'monthly',
    period: string,
    markdownContent: string
): Promise<ReportResult> => {
    if (!API_KEY) throw new Error("Gemini API Key is missing");

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
    You are a professional yet warm and empathetic personal growth consultant.
    Below is a collection of mind map diaries for a ${type} period (${period}):
    
    ${markdownContent}
    
    Task: Analyze this period and provide a 2-phase report.
    1. **Chronological Analysis (시간순 분석)**: A narrative reconstruction of how the period unfolded. Focus on the flow of events and emotional changes over time.
    2. **Thematic Analysis (테마별 분석)**: Group the activities and thoughts into 3-4 major themes or pillars (e.g., Growth, Health, Relationship, Work).
    3. **Executive Summary**: A brief, powerful, and encouraging overview (2-3 sentences).
    4. **Representative Emoji**: ONE emoji representing the core essence of this period.

    Tone: Professional, insightful, and supportive (Korean). Avoid being too casual; use a tone that feels like a life coach's report.
    
    Return the result in JSON format:
    {
      "chronological": "시간의 흐름에 따라 이번 주는...",
      "thematic": "### 1. 성장을 위한 도약\\n이번 기간 동안 가장 두드러진...",
      "summary": "한마디로 이번 기간은 당신에게...",
      "emotion": "🚀"
    }
    
    Return ONLY the JSON string. Do not include markdown code blocks.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();
        const data = JSON.parse(cleanedText);

        return {
            chronological: data.chronological || "시간순 분석을 생성하지 못했습니다.",
            thematic: data.thematic || "테마별 분석을 생성하지 못했습니다.",
            summary: data.summary || "전체 요약을 생성하지 못했습니다.",
            emotion: data.emotion || "📊"
        };
    } catch (error) {
        console.error("Error generating report with Gemini:", error);
        throw error;
    }
};
