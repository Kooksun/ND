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
