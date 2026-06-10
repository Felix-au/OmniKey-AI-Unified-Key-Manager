import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/page-header'
import { MessageSquare, Eye, Mic, Volume2, Upload, X, Square } from 'lucide-react'

const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve(base64)
    }
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(file)
  })
}

const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

interface FallbackEntry {
  modelDbId: number
  platform: string
  modelId: string
  displayName: string
  keyCount: number
  enabled: boolean
}

export default function DevCornerPage() {
  const [mode, setMode] = useState<'chat' | 'vision' | 'stt' | 'tts'>('chat')
  const [selectedModel, setSelectedModel] = useState('auto')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState('')
  const [topP, setTopP] = useState(1.0)
  const [stream, setStream] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant.')
  const [userPrompt, setUserPrompt] = useState('Hello, tell me a quick developer joke about AI!')
  const [responseOutput, setResponseOutput] = useState('')
  const [executing, setExecuting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [apiFormat, setApiFormat] = useState<'openai' | 'gemini'>('openai')
  const [selectedLang, setSelectedLang] = useState<'javascript' | 'python' | 'go' | 'rust' | 'curl'>('javascript')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string>('')
  const [audioOutputUrl, setAudioOutputUrl] = useState<string>('')
  const [voice, setVoice] = useState<string>('alloy')

  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        const recordingFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' })
        setFile(recordingFile)

        // Compile base64 preview for STT sandbox
        const reader = new FileReader()
        reader.onloadend = () => {
          setFilePreview(reader.result as string)
        }
        reader.readAsDataURL(recordingFile)

        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Error starting audio recording:', err)
      alert('Could not start audio recording. Please ensure microphone access is granted.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  // Fetch current unified API key
  const { data: keyData } = useQuery<{ apiKey: string; geminiApiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
  })

  // Fetch available models from fallback configuration catalog
  const { data: fallbackEntries = [] } = useQuery<FallbackEntry[]>({
    queryKey: ['fallback'],
    queryFn: () => apiFetch('/api/fallback'),
  })

  const availableModels = fallbackEntries.filter(e => e.keyCount > 0 && e.enabled)
  const apiKey = (apiFormat === 'openai' ? keyData?.apiKey : keyData?.geminiApiKey) || (apiFormat === 'openai' ? 'omnikey-placeholder-key' : 'omnikey-g-placeholder-key')

  // Filter models based on modality rules
  const filteredModels = mode === 'chat'
    ? availableModels
    : availableModels.filter(m => m.platform === 'google')

  const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
  const baseApiUrl = base.startsWith('http') ? base : `${window.location.origin}${base}`
  
  // Resolve endpoints
  let completionEndpoint = `${baseApiUrl}/v1/chat/completions`
  if (mode === 'stt') {
    completionEndpoint = apiFormat === 'gemini'
      ? `${baseApiUrl}/v1beta/models/${selectedModel}:generateContent`
      : `${baseApiUrl}/v1/audio/transcriptions`
  } else if (mode === 'tts') {
    completionEndpoint = apiFormat === 'gemini'
      ? `${baseApiUrl}/v1beta/models/${selectedModel}:generateContent`
      : `${baseApiUrl}/v1/audio/speech`
  } else if (mode === 'vision' && apiFormat === 'gemini') {
    completionEndpoint = `${baseApiUrl}/v1beta/models/${selectedModel}:generateContent`
  } else if (mode === 'chat' && apiFormat === 'gemini') {
    completionEndpoint = `${baseApiUrl}/v1beta/models/${selectedModel}:${stream ? 'streamGenerateContent' : 'generateContent'}`
  }

  // Revoke blob URL and stop recording on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (audioOutputUrl) {
        URL.revokeObjectURL(audioOutputUrl)
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [audioOutputUrl])

  // Handle switching model on modality change
  useEffect(() => {
    if (selectedModel !== 'auto' && !filteredModels.some(m => m.modelId === selectedModel)) {
      setSelectedModel('auto')
    }
  }, [mode, filteredModels, selectedModel])

  const handleModeChange = (newMode: 'chat' | 'vision' | 'stt' | 'tts') => {
    setMode(newMode)
    setFile(null)
    setFilePreview('')
    setResponseOutput('')
    if (audioOutputUrl) {
      URL.revokeObjectURL(audioOutputUrl)
      setAudioOutputUrl('')
    }
    
    // Set smart defaults
    if (newMode === 'chat') {
      setUserPrompt('Hello, tell me a quick developer joke about AI!')
    } else if (newMode === 'vision') {
      setUserPrompt('What is in this image? Describe it in one short sentence.')
    } else if (newMode === 'stt') {
      setUserPrompt('')
    } else if (newMode === 'tts') {
      setUserPrompt('Welcome to the OmniKey AI Developer Corner.')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      const reader = new FileReader()
      reader.onloadend = () => {
        setFilePreview(reader.result as string)
      }
      reader.readAsDataURL(selectedFile)
    }
  }

  const clearFile = () => {
    setFile(null)
    setFilePreview('')
  }

  // Compile dynamic SDK code snippets
  let jsCodeSnippet = ''
  if (selectedLang === 'javascript') {
    if (mode === 'chat') {
      jsCodeSnippet = apiFormat === 'openai'
        ? `// OmniKey AI Unified Request Example
const apiKey = '${apiKey}';
const endpoint = '${completionEndpoint}';

async function generateCompletion() {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${apiKey}\`
      },
      body: JSON.stringify({
        model: '${selectedModel}',
        messages: [
          ${systemPrompt ? `{ role: 'system', content: '${systemPrompt.replace(/'/g, "\\'")}' },` : ''}
          { role: 'user', content: '${userPrompt.replace(/'/g, "\\'")}' }
        ],
        temperature: ${temperature},
        ${maxTokens ? `max_tokens: ${maxTokens},` : ''}
        ${topP < 1.0 ? `top_p: ${topP},` : ''}
        stream: ${stream}
      })
    });

    if (${stream}) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      console.log('--- Streaming Response ---');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            if (line.includes('[DONE]')) break;
            try {
              const parsed = JSON.parse(line.slice(6));
              const text = parsed.choices?.[0]?.delta?.content || '';
              process.stdout.write(text);
            } catch (err) {}
          }
        }
      }
    } else {
      const data = await response.json();
      console.log('Response content:', data.choices[0].message.content);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

generateCompletion();`
        : `// OmniKey AI Unified Request Example (Gemini Format)
const apiKey = '${apiKey}';
const endpoint = '${completionEndpoint}';

async function generateCompletion() {
  try {
    const url = \`\${endpoint}?key=\${apiKey}\${stream ? '&alt=sse' : ''}\`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: '${userPrompt.replace(/'/g, "\\'")}' }] }
        ],
        ${systemPrompt ? `systemInstruction: { parts: [{ text: '${systemPrompt.replace(/'/g, "\\'")}' }] },` : ''}
        generationConfig: {
          temperature: ${temperature},
          ${maxTokens ? `maxOutputTokens: ${maxTokens},` : ''}
          ${topP < 1.0 ? `topP: ${topP},` : ''}
        }
      })
    });

    if (${stream}) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      console.log('--- Streaming Response (SSE) ---');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
              process.stdout.write(text);
            } catch (err) {}
          }
        }
      }
    } else {
      const data = await response.json();
      console.log('Response content:', data.candidates?.[0]?.content?.parts?.[0]?.text);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

generateCompletion();`
    } else if (mode === 'vision') {
      jsCodeSnippet = apiFormat === 'openai'
        ? `// OmniKey AI Unified Vision Request Example
const apiKey = '${apiKey}';
const endpoint = '${completionEndpoint}';

async function generateVisionCompletion() {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${apiKey}\`,
        'X-Required-Modality': 'vision'
      },
      body: JSON.stringify({
        model: '${selectedModel}',
        messages: [
          ${systemPrompt ? `{ role: 'system', content: '${systemPrompt.replace(/'/g, "\\'")}' },` : ''}
          {
            role: 'user',
            content: [
              { type: 'text', text: '${userPrompt.replace(/'/g, "\\'")}' },
              {
                type: 'image_url',
                image_url: {
                  url: 'data:image/jpeg;base64,...' // Base64 image payload
                }
              }
            ]
          }
        ],
        temperature: ${temperature}
      })
    });

    const data = await response.json();
    console.log('Response content:', data.choices[0].message.content);
  } catch (error) {
    console.error('Vision request failed:', error);
  }
}

generateVisionCompletion();`
        : `// OmniKey AI Unified Vision Request Example (Gemini Format)
const apiKey = '${apiKey}';
const endpoint = '${completionEndpoint}';

async function generateVisionCompletion() {
  try {
    const url = \`\${endpoint}?key=\${apiKey}\`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Required-Modality': 'vision'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: '${userPrompt.replace(/'/g, "\\'")}' },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: '...' // Base64 image data payload
                }
              }
            ]
          }
        ],
        ${systemPrompt ? `systemInstruction: { parts: [{ text: '${systemPrompt.replace(/'/g, "\\'")}' }] },` : ''}
        generationConfig: {
          temperature: ${temperature}
        }
      })
    });

    const data = await response.json();
    console.log('Response content:', data.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (error) {
    console.error('Vision request failed:', error);
  }
}

generateVisionCompletion();`
    } else if (mode === 'stt') {
      jsCodeSnippet = apiFormat === 'openai'
        ? `// OmniKey AI Speech-to-Text (STT) Request Example
const apiKey = '${apiKey}';
const endpoint = '${completionEndpoint}';

async function transcribeAudio(audioBlob) {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'speech.wav');
    formData.append('model', '${selectedModel === 'auto' ? 'gemini-2.5-flash' : selectedModel}');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${apiKey}\`
      },
      body: formData
    });

    const data = await response.json();
    console.log('Transcription:', data.text);
  } catch (error) {
    console.error('Transcription failed:', error);
  }
}`
        : `// OmniKey AI Speech-to-Text (STT) Request Example (Gemini Format)
const apiKey = '${apiKey}';
const endpoint = '${completionEndpoint}';

// Helper to convert blob/file to base64
const fileToBase64 = (blob) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.readAsDataURL(blob);
});

async function transcribeAudio(audioBlob) {
  try {
    const base64Data = await fileToBase64(audioBlob);
    const url = \`\${endpoint}?key=\${apiKey}\`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Required-Modality': 'audio_input'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: audioBlob.type || 'audio/wav',
                  data: base64Data
                }
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    console.log('Transcription:', data.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (error) {
    console.error('Transcription failed:', error);
  }
}`
    } else if (mode === 'tts') {
      jsCodeSnippet = apiFormat === 'openai'
        ? `// OmniKey AI Text-to-Speech (TTS) Request Example
const apiKey = '${apiKey}';
const endpoint = '${completionEndpoint}';

async function generateSpeech() {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${apiKey}\`
      },
      body: JSON.stringify({
        model: '${selectedModel === 'auto' ? 'gemini-2.5-flash-preview-tts' : selectedModel}',
        input: '${userPrompt.replace(/'/g, "\\'")}',
        voice: '${voice}'
      })
    });

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Play audio in browser
    const audio = new Audio(audioUrl);
    audio.play();
  } catch (error) {
    console.error('Speech generation failed:', error);
  }
}

generateSpeech();`
        : `// OmniKey AI Text-to-Speech (TTS) Request Example (Gemini Format)
const apiKey = '${apiKey}';
const endpoint = '${completionEndpoint}';

// Helper to convert base64 to blob
const base64ToBlob = (base64, mimeType) => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

async function generateSpeech() {
  try {
    const url = \`\${endpoint}?key=\${apiKey}\`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Required-Modality': 'audio_output'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: '${userPrompt.replace(/'/g, "\\'")}' }]
          }
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck'
              }
            }
          }
        }
      })
    });

    const data = await response.json();
    const inlinePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (inlinePart) {
      const audioBlob = base64ToBlob(inlinePart.inlineData.data, inlinePart.inlineData.mimeType);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  } catch (error) {
    console.error('Speech generation failed:', error);
  }
}

generateSpeech();`
    }
  } else if (selectedLang === 'python') {
    if (mode === 'chat') {
      jsCodeSnippet = apiFormat === 'openai'
        ? `# OmniKey AI Unified Request Example
import openai

client = openai.OpenAI(
    base_url='${baseApiUrl}/v1',
    api_key='${apiKey}'
)

try:
    response = client.chat.completions.create(
        model='${selectedModel}',
        messages=[
            ${systemPrompt ? `{"role": "system", "content": "${systemPrompt.replace(/'/g, "\\'")}"},` : ''}
            {"role": "user", "content": "${userPrompt.replace(/'/g, "\\'")}"}
        ],
        temperature=${temperature},
        ${maxTokens ? `max_tokens=${maxTokens},` : ''}
        ${topP < 1.0 ? `top_p=${topP},` : ''}
        stream=${stream ? 'True' : 'False'}
    )

    if ${stream ? 'True' : 'False'}:
        print("--- Streaming Response ---")
        for chunk in response:
            content = chunk.choices[0].delta.content
            if content:
                print(content, end="", flush=True)
        print()
    else:
        print("Response content:", response.choices[0].message.content)
except Exception as e:
    print("Request failed:", e)`
        : `# OmniKey AI Unified Request Example (Gemini Format)
import requests
import json

endpoint = '${completionEndpoint}'
apiKey = '${apiKey}'
url = f"{endpoint}?key={apiKey}${stream ? '&alt=sse' : ''}"

payload = {
    "contents": [
        {"role": "user", "parts": [{"text": "${userPrompt.replace(/'/g, "\\'")}"}]}
    ],
    ${systemPrompt ? `"systemInstruction": {"parts": [{"text": "${systemPrompt.replace(/'/g, "\\'")}"}]},` : ''}
    "generationConfig": {
        "temperature": ${temperature},
        ${maxTokens ? `"maxOutputTokens": ${maxTokens},` : ''}
        ${topP < 1.0 ? `"topP": ${topP},` : ''}
    }
}

try:
    headers = {"Content-Type": "application/json"}
    if ${stream ? 'True' : 'False'}:
        response = requests.post(url, headers=headers, json=payload, stream=True)
        print("--- Streaming Response (SSE) ---")
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data: '):
                    try:
                        parsed = json.loads(line_str[6:])
                        text = parsed['candidates'][0]['content']['parts'][0]['text']
                        print(text, end="", flush=True)
                    except Exception:
                        pass
        print()
    else:
        response = requests.post(url, headers=headers, json=payload)
        data = response.json()
        print("Response content:", data['candidates'][0]['content']['parts'][0]['text'])
except Exception as e:
    print("Request failed:", e)`
    } else if (mode === 'vision') {
      jsCodeSnippet = apiFormat === 'openai'
        ? `# OmniKey AI Unified Vision Request Example
import openai
import base64

client = openai.OpenAI(
    base_url='${baseApiUrl}/v1',
    api_key='${apiKey}'
)

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

# base64_image = encode_image("path_to_image.jpg")
base64_image = "..."

try:
    response = client.chat.completions.create(
        model='${selectedModel}',
        messages=[
            ${systemPrompt ? `{"role": "system", "content": "${systemPrompt.replace(/'/g, "\\'")}"},` : ''}
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "${userPrompt.replace(/'/g, "\\'")}"},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        temperature=${temperature}
    )
    print("Response content:", response.choices[0].message.content)
except Exception as e:
    print("Vision request failed:", e)`
        : `# OmniKey AI Unified Vision Request Example (Gemini Format)
import requests
import base64

endpoint = '${completionEndpoint}'
apiKey = '${apiKey}'
url = f"{endpoint}?key={apiKey}"

# base64_image = "..."

payload = {
    "contents": [
        {
            "role": "user",
            "parts": [
                {"text": "${userPrompt.replace(/'/g, "\\'")}"},
                {
                    "inlineData": {
                        "mimeType": "image/jpeg",
                        "data": "..." # Base64 image payload
                    }
                }
            ]
        }
    ],
    ${systemPrompt ? `"systemInstruction": {"parts": [{"text": "${systemPrompt.replace(/'/g, "\\'")}"}]},` : ''}
    "generationConfig": {
        "temperature": ${temperature}
    }
}

try:
    headers = {
        "Content-Type": "application/json",
        "X-Required-Modality": "vision"
    }
    response = requests.post(url, headers=headers, json=payload)
    data = response.json()
    print("Response content:", data['candidates'][0]['content']['parts'][0]['text'])
except Exception as e:
    print("Vision request failed:", e)`
    } else if (mode === 'stt') {
      jsCodeSnippet = apiFormat === 'openai'
        ? `# OmniKey AI Speech-to-Text (STT) Request Example
import requests

endpoint = '${completionEndpoint}'
apiKey = '${apiKey}'

# with open("speech.wav", "rb") as audio_file:
#     files = {"file": ("speech.wav", audio_file, "audio/wav")}
#     data = {"model": "${selectedModel === 'auto' ? 'gemini-2.5-flash' : selectedModel}"}
#     headers = {"Authorization": f"Bearer {apiKey}"}
#     response = requests.post(endpoint, headers=headers, files=files, data=data)
#     print("Transcription:", response.json().get("text"))`
        : `# OmniKey AI Speech-to-Text (STT) Request Example (Gemini Format)
import requests
import base64

endpoint = '${completionEndpoint}'
apiKey = '${apiKey}'
url = f"{endpoint}?key={apiKey}"

# with open("speech.wav", "rb") as audio_file:
#     base64_audio = base64.b64encode(audio_file.read()).decode('utf-8')
#     payload = {
#         "contents": [{
#             "role": "user",
#             "parts": [{
#                 "inlineData": {
#                     "mimeType": "audio/wav",
#                     "data": base64_audio
#                 }
#             }]
#         }]
#     }
#     headers = {
#         "Content-Type": "application/json",
#         "X-Required-Modality": "audio_input"
#     }
#     response = requests.post(url, headers=headers, json=payload)
#     data = response.json()
#     print("Transcription:", data['candidates'][0]['content']['parts'][0]['text'])`
    } else if (mode === 'tts') {
      jsCodeSnippet = apiFormat === 'openai'
        ? `# OmniKey AI Text-to-Speech (TTS) Request Example
import requests

endpoint = '${completionEndpoint}'
apiKey = '${apiKey}'

payload = {
    "model": "${selectedModel === 'auto' ? 'gemini-2.5-flash-preview-tts' : selectedModel}",
    "input": "${userPrompt.replace(/'/g, "\\'")}",
    "voice": "${voice}"
}

try:
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {apiKey}"
    }
    response = requests.post(endpoint, headers=headers, json=payload)
    if response.status_code == 200:
        with open("speech.mp3", "wb") as f:
            f.write(response.content)
        print("Audio saved successfully to speech.mp3")
    else:
        print("Failed to generate speech:", response.json())
except Exception as e:
    print("Speech generation failed:", e)`
        : `# OmniKey AI Text-to-Speech (TTS) Request Example (Gemini Format)
import requests
import base64

endpoint = '${completionEndpoint}'
apiKey = '${apiKey}'
url = f"{endpoint}?key={apiKey}"

payload = {
    "contents": [{
        "role": "user",
        "parts": [{"text": "${userPrompt.replace(/'/g, "\\'")}"}]
    }],
    "generationConfig": {
        "responseModalities": ["AUDIO"],
        "speechConfig": {
            "voiceConfig": {
                "prebuiltVoiceConfig": {
                    "voiceName": "Puck"
                }
            }
        }
    }
}

try:
    headers = {
        "Content-Type": "application/json",
        "X-Required-Modality": "audio_output"
    }
    response = requests.post(url, headers=headers, json=payload)
    data = response.json()
    inline_part = next((p for p in data['candidates'][0]['content']['parts'] if 'inlineData' in p), None)
    if inline_part:
        audio_data = base64.b64decode(inline_part['inlineData']['data'])
        with open("speech.wav", "wb") as f:
            f.write(audio_data)
        print("Audio saved successfully to speech.wav")
except Exception as e:
    print("Speech generation failed:", e)`
    }
  } else if (selectedLang === 'go') {
    if (mode === 'chat') {
      jsCodeSnippet = apiFormat === 'openai'
        ? `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

func main() {
    apiKey := "${apiKey}"
    endpoint := "${completionEndpoint}"

    payload := map[string]interface{}{
        "model": "${selectedModel}",
        "messages": []map[string]string{
            ${systemPrompt ? `{"role": "system", "content": "${systemPrompt.replace(/'/g, "\\'")}"},` : ''}
            {"role": "user", "content": "${userPrompt.replace(/'/g, "\\'")}"},
        },
        "temperature": ${temperature},
        ${maxTokens ? `"max_tokens": ${maxTokens},` : ''}
        ${topP < 1.0 ? `"top_p": ${topP},` : ''}
        "stream": ${stream},
    }

    jsonPayload, _ := json.Marshal(payload)
    req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonPayload))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+apiKey)

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)
    fmt.Println("Response:", string(body))
}`
        : `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

func main() {
    apiKey := "${apiKey}"
    endpoint := "${completionEndpoint}"
    url := endpoint + "?key=" + apiKey

    payload := map[string]interface{}{
        "contents": []map[string]interface{}{
            {
                "role": "user",
                "parts": []map[string]string{
                    {"text": "${userPrompt.replace(/'/g, "\\'")}"},
                },
            },
        },
        ${systemPrompt ? `"systemInstruction": map[string]interface{}{"parts": []map[string]string{{"text": "${systemPrompt.replace(/'/g, "\\'")}"}}},` : ''}
        "generationConfig": map[string]interface{}{
            "temperature": ${temperature},
            ${maxTokens ? `"maxOutputTokens": ${maxTokens},` : ''}
            ${topP < 1.0 ? `"topP": ${topP},` : ''}
        },
    }

    jsonPayload, _ := json.Marshal(payload)
    req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)
    fmt.Println("Response:", string(body))
}`
    } else if (mode === 'vision') {
      jsCodeSnippet = apiFormat === 'openai'
        ? `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

func main() {
    apiKey := "${apiKey}"
    endpoint := "${completionEndpoint}"

    payload := map[string]interface{}{
        "model": "${selectedModel}",
        "messages": []map[string]interface{}{
            ${systemPrompt ? `map[string]interface{}{"role": "system", "content": "${systemPrompt.replace(/'/g, "\\'")}"},` : ''}
            map[string]interface{}{
                "role": "user",
                "content": []map[string]interface{}{
                    {"type": "text", "text": "${userPrompt.replace(/'/g, "\\'")}"},
                    {"type": "image_url", "image_url": map[string]string{"url": "data:image/jpeg;base64,..."}},
                },
            },
        },
        "temperature": ${temperature},
    }

    jsonPayload, _ := json.Marshal(payload)
    req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonPayload))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+apiKey)
    req.Header.Set("X-Required-Modality", "vision")

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)
    fmt.Println("Response:", string(body))
}`
        : `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

func main() {
    apiKey := "${apiKey}"
    endpoint := "${completionEndpoint}"
    url := endpoint + "?key=" + apiKey

    payload := map[string]interface{}{
        "contents": []map[string]interface{}{
            {
                "role": "user",
                "parts": []map[string]interface{}{
                    {"text": "${userPrompt.replace(/'/g, "\\'")}"},
                    map[string]interface{}{
                        "inlineData": map[string]string{
                            "mimeType": "image/jpeg",
                            "data": "...",
                        },
                    },
                },
            },
        },
        ${systemPrompt ? `"systemInstruction": map[string]interface{}{"parts": []map[string]string{{"text": "${systemPrompt.replace(/'/g, "\\'")}"}}},` : ''}
        "generationConfig": map[string]interface{}{
            "temperature": ${temperature},
        },
    }

    jsonPayload, _ := json.Marshal(payload)
    req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-Required-Modality", "vision")

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)
    fmt.Println("Response:", string(body))
}`
    } else if (mode === 'stt') {
      jsCodeSnippet = `package main

import (
    "bytes"
    "fmt"
    "io"
    "mime/multipart"
    "net/http"
)

func main() {
    apiKey := "${apiKey}"
    endpoint := "${completionEndpoint}"

    body := &bytes.Buffer{}
    writer := multipart.NewWriter(body)
    
    fileWriter, _ := writer.CreateFormFile("file", "speech.wav")
    // file, _ := os.Open("speech.wav")
    // io.Copy(fileWriter, file)
    
    writer.WriteField("model", "${selectedModel === 'auto' ? 'gemini-2.5-flash' : selectedModel}")
    writer.Close()

    req, _ := http.NewRequest("POST", endpoint, body)
    req.Header.Set("Content-Type", writer.FormDataContentType())
    req.Header.Set("Authorization", "Bearer "+apiKey)

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    defer resp.Body.Close()

    respBody, _ := io.ReadAll(resp.Body)
    fmt.Println("Response:", string(respBody))
}`
    } else if (mode === 'tts') {
      jsCodeSnippet = `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
)

func main() {
    apiKey := "${apiKey}"
    endpoint := "${completionEndpoint}"

    payload := map[string]interface{}{
        "model": "${selectedModel === 'auto' ? 'gemini-2.5-flash-preview-tts' : selectedModel}",
        "input": "${userPrompt.replace(/'/g, "\\'")}",
        "voice": "${voice}",
    }

    jsonPayload, _ := json.Marshal(payload)
    req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonPayload))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+apiKey)

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    defer resp.Body.Close()

    if resp.StatusCode == 250 || resp.StatusCode == 200 {
        outFile, _ := os.Create("speech.mp3")
        defer outFile.Close()
        io.Copy(outFile, resp.Body)
        fmt.Println("Audio saved to speech.mp3")
    } else {
        body, _ := io.ReadAll(resp.Body)
        fmt.Println("Error response:", string(body))
    }
}`
    }
  } else if (selectedLang === 'rust') {
    if (mode === 'chat') {
      jsCodeSnippet = apiFormat === 'openai'
        ? `use reqwest::Client;
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let api_key = "${apiKey}";
    let endpoint = "${completionEndpoint}";

    let payload = json!({
        "model": "${selectedModel}",
        "messages": [
            ${systemPrompt ? `{"role": "system", "content": "${systemPrompt.replace(/'/g, "\\'")}"},` : ''}
            {"role": "user", "content": "${userPrompt.replace(/'/g, "\\'")}"}
        ],
        "temperature": ${temperature},
        ${maxTokens ? `"max_tokens": ${maxTokens},` : ''}
        ${topP < 1.0 ? `"top_p": ${topP},` : ''}
        "stream": ${stream}
    });

    let client = Client::new();
    let res = client.post(endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&payload)
        .send()
        .await?;

    let body = res.text().await?;
    println!("Response: {}", body);
    Ok(())
}`
        : `use reqwest::Client;
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let api_key = "${apiKey}";
    let endpoint = "${completionEndpoint}";
    let url = format!("{}?key={}", endpoint, api_key);

    let payload = json!({
        "contents": [
            {
                "role": "user",
                "parts": [{"text": "${userPrompt.replace(/'/g, "\\'")}"}]
            }
        ],
        ${systemPrompt ? `"systemInstruction": {"parts": [{"text": "${systemPrompt.replace(/'/g, "\\'")}"}]},` : ''}
        "generationConfig": {
            "temperature": ${temperature},
            ${maxTokens ? `"maxOutputTokens": ${maxTokens},` : ''}
            ${topP < 1.0 ? `"topP": ${topP}` : ''}
        }
    });

    let client = Client::new();
    let res = client.post(&url)
        .json(&payload)
        .send()
        .await?;

    let body = res.text().await?;
    println!("Response: {}", body);
    Ok(())
}`
    } else if (mode === 'vision') {
      jsCodeSnippet = apiFormat === 'openai'
        ? `use reqwest::Client;
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let api_key = "${apiKey}";
    let endpoint = "${completionEndpoint}";

    let payload = json!({
        "model": "${selectedModel}",
        "messages": [
            ${systemPrompt ? `{"role": "system", "content": "${systemPrompt.replace(/'/g, "\\'")}"},` : ''}
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "${userPrompt.replace(/'/g, "\\'")}"},
                    {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
                ]
            }
        ],
        "temperature": ${temperature}
    });

    let client = Client::new();
    let res = client.post(endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("X-Required-Modality", "vision")
        .json(&payload)
        .send()
        .await?;

    let body = res.text().await?;
    println!("Response: {}", body);
    Ok(())
}`
        : `use reqwest::Client;
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let api_key = "${apiKey}";
    let endpoint = "${completionEndpoint}";
    let url = format!("{}?key={}", endpoint, api_key);

    let payload = json!({
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": "${userPrompt.replace(/'/g, "\\'")}"},
                    {
                        "inlineData": {
                            "mimeType": "image/jpeg",
                            "data": "..."
                        }
                    }
                ]
            }
        ],
        ${systemPrompt ? `"systemInstruction": {"parts": [{"text": "${systemPrompt.replace(/'/g, "\\'")}"}]},` : ''}
        "generationConfig": {
            "temperature": ${temperature}
        }
    });

    let client = Client::new();
    let res = client.post(&url)
        .header("X-Required-Modality", "vision")
        .json(&payload)
        .send()
        .await?;

    let body = res.text().await?;
    println!("Response: {}", body);
    Ok(())
}`
    } else if (mode === 'stt') {
      jsCodeSnippet = `use reqwest::Client;
use reqwest::multipart;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let api_key = "${apiKey}";
    let endpoint = "${completionEndpoint}";

    let form = multipart::Form::new()
        .text("model", "${selectedModel === 'auto' ? 'gemini-2.5-flash' : selectedModel}")
        // .file("file", "speech.wav").await?
        ;

    let client = Client::new();
    let res = client.post(endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await?;

    let body = res.text().await?;
    println!("Transcription: {}", body);
    Ok(())
}`
    } else if (mode === 'tts') {
      jsCodeSnippet = `use reqwest::Client;
use serde_json::json;
use std::fs::File;
use std::io::Write;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let api_key = "${apiKey}";
    let endpoint = "${completionEndpoint}";

    let payload = json!({
        "model": "${selectedModel === 'auto' ? 'gemini-2.5-flash-preview-tts' : selectedModel}",
        "input": "${userPrompt.replace(/'/g, "\\'")}",
        "voice": "${voice}"
    });

    let client = Client::new();
    let res = client.post(endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&payload)
        .send()
        .await?;

    if res.status().is_success() {
        let bytes = res.bytes().await?;
        let mut file = File::create("speech.mp3")?;
        file.write_all(&bytes)?;
        println!("Audio saved to speech.mp3");
    } else {
        let body = res.text().await?;
        println!("Error response: {}", body);
    }
    Ok(())
}`
    }
  } else if (selectedLang === 'curl') {
    if (mode === 'chat') {
      jsCodeSnippet = apiFormat === 'openai'
        ? `curl ${completionEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "${selectedModel}",
    "messages": [
      ${systemPrompt ? `{"role": "system", "content": "${systemPrompt.replace(/'/g, "\\'")}"},` : ''}
      {"role": "user", "content": "${userPrompt.replace(/'/g, "\\'")}"}
    ],
    "temperature": ${temperature},
    ${maxTokens ? `"max_tokens": ${maxTokens},` : ''}
    ${topP < 1.0 ? `"top_p": ${topP},` : ''}
    "stream": ${stream}
  }'`
        : `curl -X POST "${completionEndpoint}?key=${apiKey}${stream ? '&alt=sse' : ''}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "${userPrompt.replace(/'/g, "\\'")}"}]
      }
    ],
    ${systemPrompt ? `"systemInstruction": {"parts": [{"text": "${systemPrompt.replace(/'/g, "\\'")}"}]},` : ''}
    "generationConfig": {
      "temperature": ${temperature},
      ${maxTokens ? `"maxOutputTokens": ${maxTokens},` : ''}
      ${topP < 1.0 ? `"topP": ${topP}` : ''}
    }
  }'`
    } else if (mode === 'vision') {
      jsCodeSnippet = apiFormat === 'openai'
        ? `curl ${completionEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "X-Required-Modality: vision" \\
  -d '{
    "model": "${selectedModel}",
    "messages": [
      ${systemPrompt ? `{"role": "system", "content": "${systemPrompt.replace(/'/g, "\\'")}"},` : ''}
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "${userPrompt.replace(/'/g, "\\'")}"},
          {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
        ]
      }
    ],
    "temperature": ${temperature}
  }'`
        : `curl -X POST "${completionEndpoint}?key=${apiKey}" \\
  -H "Content-Type: application/json" \\
  -H "X-Required-Modality: vision" \\
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [
          {"text": "${userPrompt.replace(/'/g, "\\'")}"},
          {
            "inlineData": {
              "mimeType": "image/jpeg",
              "data": "..."
            }
          }
        ]
      }
    ],
    ${systemPrompt ? `"systemInstruction": {"parts": [{"text": "${systemPrompt.replace(/'/g, "\\'")}"}]},` : ''}
    "generationConfig": {
      "temperature": ${temperature}
    }
  }'`
    } else if (mode === 'stt') {
      jsCodeSnippet = `curl ${completionEndpoint} \\
  -H "Authorization: Bearer ${apiKey}" \\
  -F "file=@/path/to/speech.wav" \\
  -F "model=${selectedModel === 'auto' ? 'gemini-2.5-flash' : selectedModel}"`
    } else if (mode === 'tts') {
      jsCodeSnippet = `curl ${completionEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "${selectedModel === 'auto' ? 'gemini-2.5-flash-preview-tts' : selectedModel}",
    "input": "${userPrompt.replace(/'/g, "\\'")}",
    "voice": "${voice}"
  }' \\
  --output speech.mp3`
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsCodeSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Execute sandbox API requests
  const handleExecuteRequest = async () => {
    setExecuting(true)
    setResponseOutput('Sending request to server...')
    if (audioOutputUrl) {
      URL.revokeObjectURL(audioOutputUrl)
      setAudioOutputUrl('')
    }

    try {
      let res: Response
      if (mode === 'chat') {
        if (apiFormat === 'openai') {
          const body: any = {
            model: selectedModel,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: userPrompt }
            ],
            temperature,
            stream
          }
          if (maxTokens) body.max_tokens = parseInt(maxTokens)
          if (topP < 1.0) body.top_p = topP

          res = await fetch(`${base}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
          })
        } else {
          const body: any = {
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { temperature }
          }
          if (systemPrompt) {
            body.systemInstruction = { parts: [{ text: systemPrompt }] }
          }
          if (maxTokens) body.generationConfig.maxOutputTokens = parseInt(maxTokens)
          if (topP < 1.0) body.generationConfig.topP = topP

          const url = `${base}/v1beta/models/${selectedModel}:${stream ? 'streamGenerateContent' : 'generateContent'}?key=${apiKey}${stream ? '&alt=sse' : ''}`
          res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
        }
      } else if (mode === 'vision') {
        if (!file) {
          throw new Error('Please select or drop an image file first.')
        }
        const base64Data = filePreview.split('base64,')[1]
        if (apiFormat === 'openai') {
          const body: any = {
            model: selectedModel,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              {
                role: 'user',
                content: [
                  { type: 'text', text: userPrompt },
                  { type: 'image_url', image_url: { url: filePreview } }
                ]
              }
            ],
            temperature
          }
          res = await fetch(`${base}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'X-Required-Modality': 'vision'
            },
            body: JSON.stringify(body)
          })
        } else {
          const body: any = {
            contents: [
              {
                role: 'user',
                parts: [
                  { text: userPrompt },
                  {
                    inlineData: {
                      mimeType: file.type || 'image/jpeg',
                      data: base64Data
                    }
                  }
                ]
              }
            ],
            generationConfig: { temperature }
          }
          if (systemPrompt) {
            body.systemInstruction = { parts: [{ text: systemPrompt }] }
          }
          res = await fetch(`${base}/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Required-Modality': 'vision'
            },
            body: JSON.stringify(body)
          })
        }
      } else if (mode === 'stt') {
        if (!file) {
          throw new Error('Please select or drop an audio file first.')
        }
        const formData = new FormData()
        formData.append('file', file)
        formData.append('model', selectedModel === 'auto' ? 'gemini-2.5-flash' : selectedModel)

        res = await fetch(`${base}/v1/audio/transcriptions`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          body: formData
        })
      } else {
        // TTS Mode
        res = await fetch(`${base}/v1/audio/speech`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: selectedModel === 'auto' ? 'gemini-2.5-flash-preview-tts' : selectedModel,
            input: userPrompt,
            voice: voice
          })
        })
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
        setResponseOutput(`Error details:\n${JSON.stringify(errJson, null, 2)}`)
        setExecuting(false)
        return
      }

      if (mode === 'tts') {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        setAudioOutputUrl(url)
        setResponseOutput('Audio synthesized successfully. Click the player below to listen to your generated voice output.')
      } else if (stream && mode === 'chat') {
        setResponseOutput('')
        const reader = res.body?.getReader()
        const decoder = new TextDecoder('utf-8')
        if (!reader) {
          setResponseOutput('Error: Unable to initialize stream reader.')
          setExecuting(false)
          return
        }

        let streamingText = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              if (line.includes('[DONE]')) continue
              try {
                const parsed = JSON.parse(line.slice(6))
                let content = ''
                if (apiFormat === 'openai') {
                  content = parsed.choices?.[0]?.delta?.content || ''
                } else {
                  content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || ''
                }
                streamingText += content
                setResponseOutput(streamingText)
              } catch (e) { }
            }
          }
        }
      } else {
        const data = await res.json()
        setResponseOutput(JSON.stringify(data, null, 2))
      }
    } catch (err: any) {
      setResponseOutput(`Execution failed: ${err.message}`)
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer Corner"
        description="Dynamic API documentation, auto-updating SDK scripts, and interactive proxy execution sandbox."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Parameter Configuration Panel */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Request Configuration</h3>
              <p className="text-xs text-muted-foreground">Adjust parameters and execute proxy requests.</p>
            </div>
            
            {/* Mode selection tabs */}
            <div className="flex bg-muted p-1 rounded-xl border border-border/40 shrink-0">
              <button
                onClick={() => handleModeChange('chat')}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                  mode === 'chat'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/25'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Chat
              </button>
              <button
                onClick={() => handleModeChange('vision')}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                  mode === 'vision'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/25'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Vision
              </button>
              <button
                onClick={() => handleModeChange('stt')}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                  mode === 'stt'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/25'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                STT
              </button>
              <button
                onClick={() => handleModeChange('tts')}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                  mode === 'tts'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/25'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                TTS
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* API Format Selection (only relevant for Chat / Vision) */}
            {(mode === 'chat' || mode === 'vision') && (
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  API Key Format / Type
                </label>
                <select
                  value={apiFormat}
                  onChange={e => setApiFormat(e.target.value as 'openai' | 'gemini')}
                  className="w-full bg-background border rounded-lg h-8 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="openai">OpenAI Format (Bearer Token, /v1/...)</option>
                  <option value="gemini">Gemini Format (Query Param, /v1beta/...)</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Unified API Authorization Key
              </label>
              <Input
                type="text"
                value={apiKey}
                readOnly
                className="w-full font-mono text-xs bg-muted/40 select-all cursor-text"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Proxy Endpoint Address
              </label>
              <Input
                type="text"
                value={completionEndpoint}
                readOnly
                className="w-full font-mono text-xs bg-muted/40 select-all cursor-text"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Router Model Target
                </label>
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  className="w-full bg-background border rounded-lg h-8 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="auto">auto (best intelligent model)</option>
                  {filteredModels.map(m => (
                    <option key={m.modelDbId} value={m.modelId}>
                      {m.displayName} ({m.platform})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Execution Output Mode
                </label>
                <select
                  disabled={mode !== 'chat'}
                  value={stream && mode === 'chat' ? 'true' : 'false'}
                  onChange={e => setStream(e.target.value === 'true')}
                  className="w-full bg-background border rounded-lg h-8 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                >
                  <option value="false">Standard JSON (blocking)</option>
                  <option value="true">Streaming Events (SSE)</option>
                </select>
              </div>
            </div>

            {/* Sandbox Media Upload Area */}
            {(mode === 'vision' || mode === 'stt') && (
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Sandbox Payload ({mode === 'vision' ? 'Image' : 'Audio'})
                </label>
                <div className="border border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center gap-2 bg-muted/10 hover:bg-muted/20 transition-all relative min-h-[100px]">
                  <input
                    type="file"
                    accept={mode === 'vision' ? 'image/*' : 'audio/*'}
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {file ? (
                    <div className="text-center relative z-20 w-full">
                      <button
                        onClick={clearFile}
                        className="absolute top-0 right-0 p-1 bg-background border rounded-full text-muted-foreground hover:text-foreground hover:shadow-sm"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <p className="text-xs font-semibold truncate max-w-[240px] mx-auto">{file.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                      {mode === 'vision' && filePreview && (
                        <img src={filePreview} alt="Preview" className="mt-2 h-20 object-contain rounded-lg border mx-auto shadow-sm" />
                      )}
                    </div>
                  ) : (
                    <div className="text-center space-y-1">
                      <Upload className="w-6 h-6 text-muted-foreground mx-auto" />
                      <p className="text-xs text-muted-foreground">Click or drag {mode === 'vision' ? 'image' : 'audio'} file here</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {mode === 'tts' && (
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Voice Model
                </label>
                <select
                  value={voice}
                  onChange={e => setVoice(e.target.value)}
                  className="w-full bg-background border rounded-lg h-8 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="alloy">alloy (Kore - default)</option>
                  <option value="echo">echo (Fenrir)</option>
                  <option value="fable">fable (Aoede)</option>
                  <option value="onyx">onyx (Charon)</option>
                  <option value="nova">nova (Puck)</option>
                  <option value="shimmer">shimmer (Aoede)</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Temperature ({temperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  disabled={mode === 'stt'}
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-violet-600 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Max Tokens (optional)
                </label>
                <input
                  type="number"
                  placeholder="Limit"
                  disabled={mode === 'stt' || mode === 'tts'}
                  value={maxTokens}
                  onChange={e => setMaxTokens(e.target.value)}
                  className="w-full bg-background border rounded-lg px-3 h-8 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Top P Selection
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  disabled={mode === 'stt' || mode === 'tts'}
                  value={topP}
                  onChange={e => setTopP(parseFloat(e.target.value))}
                  className="w-full bg-background border rounded-lg px-3 h-8 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
              </div>
            </div>

            {mode !== 'stt' && mode !== 'tts' && (
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Developer System Prompt
                </label>
                <textarea
                  rows={2}
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  placeholder="Initialize global AI constraints here..."
                  className="w-full bg-background border rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
            )}

            {mode !== 'stt' && (
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  {mode === 'tts' ? 'Speech Input Text' : 'User Conversation Prompt'}
                </label>
                <textarea
                  rows={3}
                  value={userPrompt}
                  onChange={e => setUserPrompt(e.target.value)}
                  placeholder="Enter text payload..."
                  className="w-full bg-background border rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
            )}

            <Button
              onClick={handleExecuteRequest}
              disabled={executing || !apiKey}
              className="w-full py-5 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-xs tracking-wide shadow-lg shadow-violet-600/10 hover:shadow-violet-600/20 active:scale-[0.98] transition-all"
            >
              {executing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing request...
                </span>
              ) : (
                `Run ${mode.toUpperCase()} Sandbox Request`
              )}
            </Button>
          </div>
        </div>

        {/* Live Code Compiler & Response Visualizer */}
        <div className="space-y-6">
          {/* JavaScript SDK Sandbox Block */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col h-[340px]">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Dynamic SDK Code Snippet</h4>
                <p className="text-[10px] text-muted-foreground">Auto-compiles instantly as request parameters change.</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedLang}
                  onChange={e => setSelectedLang(e.target.value as any)}
                  className="bg-background border rounded-lg h-7 px-2 text-[10px] font-semibold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                  <option value="curl">cURL</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  className="text-[10px] font-bold py-1 px-3 h-7 text-violet-400 border-violet-500/20 hover:border-violet-500/40 bg-violet-950/10 hover:bg-violet-950/20 rounded-lg shrink-0"
                >
                  {copied ? 'Copied!' : 'Copy Script'}
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-900 overflow-auto p-4 text-left">
              <pre className="text-[11px] font-mono leading-relaxed text-indigo-950 dark:text-indigo-200 whitespace-pre">
                {jsCodeSnippet}
              </pre>
            </div>
          </div>

          {/* Interactive Request Output Stream */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col h-[280px]">
            <div className="space-y-1 mb-3 shrink-0">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Interactive Execution Console</h4>
              <p className="text-[10px] text-muted-foreground">Real-time response output from the gateway router.</p>
            </div>
            <div className="flex-1 min-h-0 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-900 p-4 text-left font-mono text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed overflow-y-auto flex flex-col justify-between select-all cursor-text">
              <div className="whitespace-pre-wrap">
                {responseOutput || 'Console idle. Click the run request button to execute sandbox payload.'}
              </div>
              {audioOutputUrl && (
                <div className="mt-4 p-3 bg-card border rounded-xl flex flex-col gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Audio Playback Console</span>
                  <audio src={audioOutputUrl} controls className="w-full h-8" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
