
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export const generateIdeas = async (topic: string): Promise<string[]> => {
    if (!API_KEY) {
        console.error("Gemini API Key is missing");
        throw new Error("Gemini API Key is missing");
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Prompt engineering for structured output
        const prompt = `Generate 5 creative and distinct sub-topics or related concepts for a mind map node titled "${topic}". 
    Return ONLY a simple comma-separated list of strings. 
    Example output: Idea 1, Idea 2, Idea 3, Idea 4, Idea 5
    Do not include numbering, bullets, or any other text.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse the comma-separated list
        const ideas = text.split(',').map(idea => idea.trim()).filter(idea => idea.length > 0);

        return ideas.slice(0, 5); // Ensure maximum 5 items
    } catch (error) {
        console.error("Error generating ideas with Gemini:", error);
        throw error;
    }
};
