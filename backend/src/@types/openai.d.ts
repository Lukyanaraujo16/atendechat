export interface IOpenAi {
    name: string;
    prompt: string;
    /** Modelo OpenAI (ex.: gpt-3.5-turbo-1106). Opcional no JSON antigo; fallback em resolveOpenAiModel. */
    model?: string;
    voice: string;
    voiceKey: string;
    voiceRegion: string;
    maxTokens: string;
    temperature: string;
    apiKey: string;
    queueId: string;
    maxMessages: string;
};