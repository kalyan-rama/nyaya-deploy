// src/services/geminiApi.js — FIXED: Multilingual AI — responds in user's language ONLY

function getProxyURL() {
  if (typeof window === 'undefined') return 'http://localhost:3001/api/chat';
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3001/api/chat`;
}

// FIXED: System prompt now STRICTLY enforces response in user's selected language
function getSystemPrompt(lang, langName) {
  return `You are NYAYA, a free AI legal advisor for Indian citizens.
CRITICAL LANGUAGE RULE: You MUST respond ONLY in ${langName} (language code: ${lang}). 
- If the user writes in Hindi, respond in Hindi
- If the user writes in Telugu, respond in Telugu  
- If the user writes in Tamil, respond in Tamil
- If the user writes in English, respond in English
- NEVER switch to a different language than ${langName} regardless of what language the user typed
- The interface language is set to ${langName} — ALWAYS use ${langName} in your response

Legal Advice Rules: Give practical Indian legal advice. Cite specific laws/sections (IPC, CrPC, RTI, POSH etc). 
Always mention free Legal Aid 15100. Use emojis for clarity. Max 200 words. 
End with one immediate action step. For violence/abuse always include Women 181, Police 100. 
Never refuse to help. Be fast and direct.`;
}

export async function callGeminiAPI(userMessage, chatHistory, lang, langName) {
  const contents = chatHistory
    .filter(m => m.role !== 'typing')
    .slice(-6)
    .map(m => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.content }] }));
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const response = await fetch(getProxyURL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemInstruction: getSystemPrompt(lang, langName), contents })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || err.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'API error');
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response');
  return text;
}

export function getTypingSuggestions(input, lang, allSuggestions) {
  if (!input || input.length < 2) return [];
  const lower = input.toLowerCase();
  return (allSuggestions || [])
    .filter(s => s.text.toLowerCase().includes(lower) || s.q.toLowerCase().includes(lower))
    .slice(0, 3);
}
