const getApiKey = () =>
  localStorage.getItem('KIRA_CLAUDE_KEY') ||
  localStorage.getItem('KIRA_GEMINI_KEY') ||
  import.meta.env.VITE_GEMINI_API_KEY ||
  import.meta.env.VITE_ANTHROPIC_API_KEY ||
  '';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function callClaude(
  systemPrompt: string,
  messages: Message[],
  maxTokens: number = 1024
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key found. Please add your Gemini API key in Settings.');

  // Convert messages to Gemini format
  const geminiMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: geminiMessages,
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
}
