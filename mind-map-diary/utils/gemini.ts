import { Groq } from 'groq-sdk';

const API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY || "";
const groq = new Groq({ apiKey: API_KEY, dangerouslyAllowBrowser: true });

/**
 * Retries a Groq API call with exponential backoff on 429 errors.
 */
async function callGroqWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 2000
): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            // Groq SDK error status is usually on the error object
            const status = error?.status || error?.response?.status;
            const isQuotaExceeded = status === 429 || error?.message?.includes("429");

            if (isQuotaExceeded && i < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, i);
                console.warn(`Groq Quota Exceeded. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

export const generateIdeas = async (
    topic: string,
    contextPath: string[] = [],
    existingChildren: string[] = [],
    content: string = ""
): Promise<string[]> => {
    if (!API_KEY) {
        console.error("Groq API Key is missing");
        throw new Error("Groq API Key is missing");
    }

    return callGroqWithRetry(async () => {
        const contextStr = contextPath.length > 0
            ? `Context (path from root): ${contextPath.join(" > ")} > ${topic}`
            : `Topic: ${topic}`;

        const exclusionStr = existingChildren.length > 0
            ? `Exclude these existing ideas: ${existingChildren.join(", ")}`
            : "";

        const contentStr = content ? `Node Content: "${content}"` : "";

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

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "openai/gpt-oss-120b",
            temperature: 0.7,
        });

        const text = completion.choices[0]?.message?.content || "";
        const ideas = text.split(',').map(idea => idea.trim()).filter(idea => idea.length > 0);
        return ideas.slice(0, 3);
    });
};

export const summarizeDiary = async (
    markdownContent: string
): Promise<{ summary: string; emotion: string }> => {
    if (!API_KEY) throw new Error("Groq API Key is missing");

    try {
        return await callGroqWithRetry(async () => {
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

            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "openai/gpt-oss-120b",
                temperature: 0.7,
                response_format: { type: "json_object" }
            });

            const text = completion.choices[0]?.message?.content || "{}";
            const data = JSON.parse(text);

            return {
                summary: data.summary || "내용을 요약하지 못했어요.",
                emotion: data.emotion || "📝"
            };
        });
    } catch (error) {
        console.error("Error summarizing diary with Groq:", error);
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
    if (!API_KEY) throw new Error("Groq API Key is missing");

    return callGroqWithRetry(async () => {
        const prompt = `
    You are a professional yet warm and empathetic personal growth consultant.
    Below is a collection of mind map diaries for a ${type} period (${period}):
    
    ${markdownContent}
    
    Task: Analyze this period and provide a 2-phase report.
    1. **Chronological Analysis (시간순 분석)**: A narrative reconstruction of how the period unfolded. Focus on the flow of events and emotional changes over time. 
       - IMPORTANT: Use at least 2-3 distinct paragraphs (separate with \\n\\n) to ensure readability. Avoid one large block of text.
    2. **Thematic Analysis (테마별 분석)**: Group the activities and thoughts into 3-4 major themes or pillars (e.g., Growth, Health, Relationship, Work).
       - Use clear headings and bullet points.
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

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "openai/gpt-oss-120b",
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const text = completion.choices[0]?.message?.content || "{}";
        const data = JSON.parse(text);

        return {
            chronological: data.chronological || "시간순 분석을 생성하지 못했습니다.",
            thematic: data.thematic || "테마별 분석을 생성하지 못했습니다.",
            summary: data.summary || "전체 요약을 생성하지 못했습니다.",
            emotion: data.emotion || "📊"
        };
    });
};
