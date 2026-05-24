# GriffinX: Your Local AI Assistant — User Guide

> **GriffinX** is an AI-powered desktop assistant that lives in your system tray and listens when you ask it to. Hold a hotkey, speak a command, and GriffinX transcribes your speech, classifies the intent, executes the action, learns from your feedback, and speaks the result back — all using models running **entirely on your device**. No cloud. No API keys. No data leaves your machine.

---

## Table of Contents

1. [How It Works — The Big Picture](#how-it-works--the-big-picture)
2. [Application Walkthrough](#application-walkthrough)
3. [Full Pathway #1 — App Launch (Voice)](#full-pathway-1--app-launch-voice-command)
4. [Full Pathway #2 — General Query (Voice)](#full-pathway-2--general-query-voice-command)
5. [Full Pathway #3 — Cached Command (Instant)](#full-pathway-3--cached-command-instant-execution)
6. [Example 1 — Opening an Application](#example-1--opening-an-application)
7. [Example 2 — Typing Text](#example-2--typing-text)
8. [Example 3 — Keyboard Shortcut](#example-3--keyboard-shortcut)
9. [Example 4 — Creating and Running a Macro](#example-4--creating-and-running-a-macro)
10. [Example 5 — General Knowledge Question](#example-5--general-knowledge-question)
11. [Example 6 — Closing an Application](#example-6--closing-an-application)
12. [The Intent Cache — How GriffinX Learns](#the-intent-cache--how-griffinx-learns)
13. [UI Guide — Dashboard](#ui-guide--dashboard)
14. [UI Guide — Ball Mode (Default)](#ui-guide--ball-mode-default)
15. [UI Guide — Expanded Overlay](#ui-guide--expanded-overlay)
16. [System Tray](#system-tray)
17. [Command Executor — App Resolution](#command-executor--app-resolution)
18. [Model Management](#model-management)
19. [Hardware Expectations](#hardware-expectations)
20. [Troubleshooting](#troubleshooting)
21. [Packaging Notes](#packaging-notes)
22. [Roadmap](#roadmap)
23. [Project Summary](#project-summary)

---

## How It Works — The Big Picture

```mermaid
flowchart LR
    A["You hold Ctrl+Caps\nand speak"] --> B["Microphone\nrecords 16kHz mono"]
    B --> C["Whisper STT\ntranscribes locally"]
    C --> D["Qwen 3 LLM\nclassifies intent"]
    D --> E["Executor\nacts on your desktop"]
    E --> F["Feedback loop\ncaches correct maps"]
    F --> G["Piper TTS\nspeaks result aloud"]
```

<details>
<summary>ASCII fallback (click to expand)</summary>

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐     ┌────────────────┐
│  You hold    │────►│  Microphone  │────►│  Whisper STT     │────►│  Qwen 3 LLM  │────►│  Executor      │
│  Ctrl+Caps   │     │  records     │     │  transcribes     │     │  classifies  │     │  acts on your  │
│  and speak   │     │  16kHz mono  │     │  locally         │     │  intent      │     │  desktop       │
└──────────────┘     └──────────────┘     └──────────────────┘     └──────────────┘     └──────┬─────────┘
                                                                                               │
                                          ┌──────────────────┐     ┌──────────────┐            │
                                          │  Piper TTS       │◄────│  Feedback    │◄───────────┘
                                          │  speaks result   │     │  loop caches │
                                          │  aloud           │     │  correct maps│
                                          └──────────────────┘     └──────────────┘
```

</details>

**In plain English:**

1. **You hold the hotkey and speak** — `Ctrl + CapsLock`. GriffinX records from your default microphone at 16 kHz mono.
2. **You release the key** — Recording stops. The audio is sent to the local Faster-Whisper model for transcription. A command vocabulary prompt biases recognition toward app names and common actions.
3. **The transcript goes to the intent engine** — First, GriffinX checks the intent cache for a fuzzy match (≥80% similarity). If found, it skips the LLM entirely and executes instantly. If not, the Qwen 3 4B model classifies the command into a structured JSON intent.
4. **GriffinX executes the action** — Opens an app, types text, presses a hotkey, runs a macro, or answers a question.
5. **GriffinX speaks the result** — Using offline Piper neural TTS.
6. **You confirm with feedback** — 👍 caches the mapping for instant future use. 👎 logs it as incorrect.

If you don't use voice, you can type commands directly into the overlay's text box. The only skipped step is speech-to-text.

---

## Application Walkthrough

### Starting GriffinX

When you launch `main.py` (or `GriffinX.exe`), the following happens:

1. `config.json` is loaded — model paths, device settings, cache threshold.
2. The **SQLite database** opens at `logs/history.db` — stores interaction history, intent cache, and macros.
3. The **Dashboard** opens immediately (80% of screen width/height, centred) — showing system gauges and model status cards.
4. The **floating ball** appears bottom-right — the default compact mode.
5. The **system tray icon** appears in the taskbar with a branded `GriffinX.ico`.
6. **Background model downloads** begin — Whisper, Qwen 3 4B, and Piper TTS download in parallel with live progress bars in the Dashboard.
7. The **audio engine** prepares — microphone access, Whisper model path set (loaded lazily on first voice command).
8. The **LLM engine** prepares — Qwen GGUF model path set (loaded lazily on first intent classification).
9. The **TTS engine** initializes once downloaded — Piper voice model loaded, or TTS disabled if model is missing.
10. The **keyboard hook** registers — configurable hotkey (default: `Ctrl + CapsLock`) without key suppression.

### Closing / Minimizing

- **Close the Dashboard** → silently minimises to system tray (no notification).
- **Right-click the ball → Quit** → fully exits GriffinX and unhooks all keyboard listeners.
- **Right-click tray icon → Quit** → same as above.
- **Click × on the expanded overlay** → collapses back to Ball Mode.
- **Double-click tray icon** → opens the Dashboard.

---

## Full Pathway #1 — App Launch (Voice Command)

### Step 1: User Holds Hotkey and Speaks

You want to open Chrome. You hold `Ctrl + CapsLock` and say:

> "Open Chrome"

GriffinX's UI shows a green pulsing ring animation and status: **"Listening..."**

### Step 2: Microphone Capture

The `AudioEngine` opens a `sounddevice.InputStream` at 16 kHz, mono, float32. Audio chunks are pushed to a queue in real-time via a callback.

### Step 3: Release Key → Transcription

You release `CapsLock`. GriffinX:
1. Stops the audio stream
2. Concatenates all audio chunks into a single NumPy array
3. Flattens to 1D
4. Feeds to Faster-Whisper with:

| Parameter | Value |
|---|---|
| beam_size | 1 |
| vad_filter | True |
| min_silence_duration_ms | 500 |
| initial_prompt | `"GriffinX voice commands and app names: open Chrome, open Notepad..."` |
| language | `en` |

**Transcript:** `"Open Chrome"`

The overlay shows: **"Transcribing..."** with a green neon arc spinner.

### Step 4: Intent Cache Check

GriffinX checks the SQLite `intent_cache` table for a fuzzy match:

```
SELECT transcription, intent, target FROM intent_cache
```

Each cached entry is compared using `SequenceMatcher`:
- `"open chrome"` vs `"open chrome"` → ratio = 1.0 → **HIT** (if previously cached)
- If no match ≥ 80% → **MISS** → proceed to LLM

**Assuming first use (MISS):**

### Step 5: LLM Intent Classification

The Context Manager builds the prompt:

```
<|im_start|>system
You are GriffinX: Your Local AI Assistant, a desktop AI assistant running locally on a Windows PC.
You can execute system commands, answer questions, and control the user's screen components via macros.
Analyze the given transcript or prompt. Output only valid JSON representing the intent.
Possible intents: 'open_app', 'close_app', 'general_query', 'macro_creation', 'macro_execution', 'run_script', 'string_type', 'hotkey', 'delay'.
Example 1: 'Open notepad' -> {"intent": "open_app", "target": "notepad"}
Example 2: 'Open note bed' -> {"intent": "open_app", "target": "notepad"}
...
Recent Context:
(last 5 interactions from history)
<|im_end|>
<|im_start|>user
Open Chrome<|im_end|>
<|im_start|>assistant
```

The Qwen 3 4B model generates:

```json
{"intent": "open_app", "target": "chrome"}
```

The LLM engine strips any `<think>...</think>` blocks and extracts the JSON using robust bracket-matching.

### Step 6: Command Execution

The executor resolves `"chrome"`:
1. **Whitelist check** → `"chrome"` matches `"chrome": "chrome.exe"` ✅
2. **Launch:** `subprocess.Popen(["cmd.exe", "/c", "start", "", "chrome.exe"])`

**Chrome opens.**

### Step 7: Response & Feedback

- Overlay shows: `"open_app: chrome — Success"`
- Piper TTS speaks: `"open app chrome success"` (first 200 chars, async thread)
- Feedback buttons appear: 👍 👎
- You click **👍** → GriffinX caches `"Open Chrome" → open_app:chrome`
- Next time you say "Open Chrome", it will be an instant cache hit — no LLM needed.

---

## Full Pathway #2 — General Query (Voice Command)

### User Says: "What is the capital of France?"

1. **Transcription:** `"What is the capital of France?"`
2. **Cache check:** MISS (no action mapping for questions)
3. **LLM classifies:** Since this isn't an action request, Qwen returns:

```json
{"intent": "general_query", "message": "The capital of France is Paris."}
```

4. **Response displayed** in the overlay and **spoken aloud** by Piper TTS
5. **No feedback buttons** — general queries don't get cached (they're stateless)

---

## Full Pathway #3 — Cached Command (Instant Execution)

### User Says: "Open Chrome" (previously confirmed with 👍)

1. **Transcription:** `"Open Chrome"`
2. **Cache check:**
   - Cached entry: `"Open Chrome" → open_app:chrome`
   - Similarity: `SequenceMatcher("open chrome", "open chrome") = 1.0` ≥ 0.90 threshold
   - **HIT** ⚡
3. **LLM is completely skipped**
4. **Executor runs:** `chrome.exe` opens
5. **Response:** `"⚡ Cache match (100%): open_app → chrome"`
6. **No feedback buttons** — cached commands are already verified

This is why GriffinX gets faster over time — your most-used commands become instant.

---

## Example 1 — Opening an Application

**Voice:** "Open Notepad"

| Step | What Happens |
|---|---|
| STT | `"Open Notepad"` |
| LLM | `{"intent": "open_app", "target": "notepad"}` |
| Resolve | `"notepad"` → `"notepad.exe"` (whitelist) |
| Execute | `cmd.exe /c start "" notepad.exe` |
| Result | Notepad opens ✅ |

---

## Example 2 — Typing Text

**Voice:** "Type hello world"

| Step | What Happens |
|---|---|
| STT | `"Type hello world"` |
| LLM | `{"intent": "string_type", "target": "hello world"}` |
| Execute | `pyautogui.write("hello world", interval=0.05)` |
| Result | "hello world" typed into the active window ✅ |

> **Note:** `pyautogui.write()` types character by character with a 50ms interval. Make sure the target window is focused before speaking.

---

## Example 3 — Keyboard Shortcut

**Voice:** "Press ctrl s"

| Step | What Happens |
|---|---|
| STT | `"Press ctrl s"` |
| LLM | `{"intent": "hotkey", "target": "ctrl+s"}` |
| Execute | `pyautogui.hotkey("ctrl", "s")` |
| Result | Active application saves ✅ |

---

## Example 4 — Creating and Running a Macro

### Creating

After opening Notepad and typing "hello world" (two successful actions in history):

**Voice:** "Create a macro called morning setup"

| Step | What Happens |
|---|---|
| STT | `"Create a macro called morning setup"` |
| LLM | `{"intent": "macro_creation", "target": "morning_setup"}` |
| Execute | Pulls last 3 successful actions from history, saves to SQLite `macros` table |
| Result | Macro "morning_setup" saved with actions: `[open_app:notepad, string_type:hello world]` ✅ |

### Running

**Voice:** "Run the macro morning setup"

| Step | What Happens |
|---|---|
| STT | `"Run the macro morning setup"` |
| LLM | `{"intent": "macro_execution", "target": "morning_setup"}` |
| Execute | Looks up macro by name, replays each action sequentially |
| Result | Notepad opens, then "hello world" is typed ✅ |

Macros can also be assigned hotkeys. If a hotkey is bound, the macro fires instantly when the hotkey is pressed — no voice needed.

---

## Example 5 — General Knowledge Question

**Voice:** "Hello there"

| Step | What Happens |
|---|---|
| STT | `"Hello there"` |
| LLM | `{"intent": "general_query", "message": "Hello! How can I help you today?"}` |
| Execute | No desktop action — display message |
| TTS | Speaks "Hello! How can I help you today?" |
| Result | Conversational response ✅ |

---

## Example 6 — Closing an Application

**Voice:** "Close Chrome"

| Step | What Happens |
|---|---|
| STT | `"Close Chrome"` |
| LLM | `{"intent": "close_app", "target": "chrome"}` |
| Resolve | `"chrome"` → `"chrome.exe"` |
| Execute | `taskkill /IM chrome.exe /F` |
| Result | Chrome closes ✅ |

---

## The Intent Cache — How GriffinX Learns

The intent cache is the heart of GriffinX's learning system. It makes repeated commands instant.

### How It Works

1. **First use:** Your command goes through the full pipeline (STT → LLM → Execute)
2. **Feedback:** You click 👍 to confirm the action was correct
3. **Caching:** The transcription-to-intent mapping is stored in SQLite: `"Open Chrome" → open_app:chrome`
4. **Future use:** The same (or similar) command is fuzzy-matched against the cache. If similarity ≥ threshold, the LLM is skipped entirely.

### Similarity Thresholds

| Command Length | Threshold | Reasoning |
|---|---|---|
| < 8 words | 90% | Short commands need stricter matching to avoid false positives |
| ≥ 8 words | 80% | Longer commands can tolerate more variation |

### Example Fuzzy Matches

| Spoken | Cached Entry | Similarity | Result |
|---|---|---|---|
| "Open Chrome" | "Open Chrome" | 100% | ✅ HIT |
| "Open Google Chrome" | "Open Chrome" | ~82% | ✅ HIT (≥80%) |
| "Open Brave" | "Open Chrome" | ~55% | ❌ MISS (LLM needed) |

---

## UI Guide — Dashboard

The Dashboard is GriffinX's command centre. It opens automatically at launch, sized to 80% of your screen and centred.

### Layout (5:2 column ratio)

| Left Column (Primary) | Right Column (Side) |
|---|---|
| **System Resources** — 4 circular gauges (CPU, RAM, GPU, VRAM) | **Recent Activity** — timestamped log of downloads, engine init, commands, errors |
| **AI Models** — status cards for STT, LLM, and TTS with progress bars | **Settings** — start-at-startup toggle, push-to-talk hotkey editor |

### AI Model Cards

Each model card shows:
- **Title** — e.g., "Faster-Whisper Medium English"
- **Status icon** — ✅ ready, ⏳ downloading (with %), ❌ missing/failed
- **Progress bar** — 16px tall, golden gradient fill, bold percentage text centred inside

### System Gauges

| Gauge | Source | CPU-Only Behaviour |
|---|---|---|
| CPU | psutil | ✅ Always works |
| RAM | psutil | ✅ Always works |
| GPU | pynvml | Shows N/A without NVIDIA GPU |
| VRAM | pynvml | Shows N/A without NVIDIA GPU |

### Hotkey Editor

In Settings, click the hotkey field to enter capture mode — the field glows gold and shows "Press keys...". Press a 2-3 key combination (e.g., `Ctrl+Shift+T`), and the new hotkey is saved immediately. The push-to-talk hook re-registers live without suppressing the trigger keys.

### Theme

The Dashboard uses a premium **golden-brown** design system with:
- Dark warm backgrounds (`#1C1510`, `#252018`)
- Gold accent colors (`#D4A044`, `#F0C060`)
- Gold-glow effects on focused inputs and active buttons
- Smooth hover transitions

---

## UI Guide — Ball Mode (Default)

GriffinX launches in Ball Mode by default — a compact branded floating ball using `trixie-circular.jpeg`.

### Ball Interactions

| Action | Effect |
|---|---|
| **Single-click** the ball | Open/close the text command input (300ms delay to prevent accidental triggers) |
| **Double-click** the ball | Expand to the full translucent overlay |
| **Right-click** the ball | Context menu — Open Dashboard / Quit GriffinX |
| **Drag** the ball | Reposition anywhere on screen |

### Ball Animations

| State | Animation |
|---|---|
| **Idle** | Subtle amber breathing glow ring |
| **Listening** | Green pulsing neon ring |
| **Transcribing** | Green arc spinner |
| **Thinking / Executing** | Cyan arc spinner |

### Feedback Buttons

After intent execution, 👍/👎 buttons appear **below the ball** at 44×44px — large enough for emoji to render fully. The window expands vertically to accommodate them.

### Speech Bubble

When GriffinX responds in ball mode, a speech bubble appears above the ball with the response text. The bubble auto-hides after a duration based on word count:

| Response Length | Display Duration |
|---|---|
| Very short (≤10 words) | 5 seconds |
| Medium | 500ms per word |
| Long (≥30 words) | 15 seconds (max) |

---

## UI Guide — Expanded Overlay

Double-click the ball to expand to the full translucent overlay. It shows:

| Section | What You See |
|---|---|
| **Header Bar** | Warm golden-brown gradient with GriffinX logo — click to open Dashboard (hand cursor) |
| **× Button** | Circular golden button — collapses back to Ball Mode |
| **Status Dot** | 🟢 Green pulse = Listening · 🟡 Orange = Thinking/Executing · 🔴 Red = Error · ⚪ Gray = Idle |
| **Status Text** | Current state: "Idle", "Listening...", "Transcribing...", "Thinking...", "Executing: open_app..." |
| **Transcript** | "YOU:" label with your transcribed/typed command |
| **Response** | "GriffinX:" label with the action result or conversational answer |
| **Feedback** | 44px 👍/👎 buttons centred above the text input when awaiting confirmation |
| **Text Input** | Bottom text box — type commands and press Enter |

The overlay is:
- **Draggable** — click and drag anywhere to reposition
- **Always-on-top** — stays above all other windows
- **Translucent** — dark glassmorphic background with rounded corners
- **Auto-resizing** — grows upward to fit long transcripts and responses

---

## System Tray

The system tray icon uses the branded `GriffinX.ico`. The taskbar also displays the GriffinX icon via `SetCurrentProcessExplicitAppUserModelID`.

| Action | Effect |
|---|---|
| **Double-click tray icon** | Open the Dashboard |
| **Right-click → Show/Hide Overlay** | Toggle the floating overlay visibility |
| **Right-click → Push to Talk** | Trigger listening from the menu |
| **Right-click → Quit** | Fully exit GriffinX and unhook all keyboard listeners |

---

## Command Executor — App Resolution

When GriffinX receives an `open_app` intent, it resolves the target through a 4-step process:

### Resolution Order

1. **Direct whitelist match** — ~35 built-in app mappings (Chrome, Notepad, VS Code, Discord, etc.)
2. **File path check** — If the target is a valid file path, open it directly
3. **Fuzzy whitelist match** — Substring matching against whitelist keys (e.g., "google chrome" matches "chrome")
4. **Fallback** — Pass the target as-is to Windows `start` command (handles URLs, app names, etc.)

### Dynamic App Discovery

On startup, the executor scans these directories for `.lnk` shortcut files:

- `%ProgramData%\Microsoft\Windows\Start Menu\Programs\`
- `%APPDATA%\Microsoft\Windows\Start Menu\Programs\`
- `%PUBLIC%\Desktop\`
- `%USERPROFILE%\Desktop\`

Every discovered shortcut is added to the app resolution table. This means GriffinX can open any application you have installed — not just the hardcoded whitelist.

### Built-In Whitelist (Partial)

| Voice Command | Resolves To |
|---|---|
| "notepad" | `notepad.exe` |
| "chrome" / "google chrome" | `chrome.exe` |
| "vscode" / "code" / "visual studio code" | `code.exe` |
| "terminal" | `wt.exe` |
| "settings" | `ms-settings:` |
| "discord" | `discord.exe` |
| "spotify" | `spotify.exe` |
| "steam" | `steam.exe` |

### Safety

- **Script execution** is restricted to `.py` files only
- **Delays** are capped at 30 seconds maximum
- **PyAutoGUI failsafe** is enabled — move cursor to corner to abort

---

## Model Management

GriffinX ships without large model files. All three models download automatically on first launch with live progress in the Dashboard:

| Model | Source | Size | Local Path |
|---|---|---|---|
| Faster-Whisper Medium EN | HuggingFace snapshot | ~1.5 GB | `models/faster-whisper-medium.en/` |
| Qwen 3 4B Q4_K_M GGUF | Direct URL download | ~2.5 GB | `models/Qwen_Qwen3-4B-Q4_K_M.gguf` |
| Piper Lessac voice | Direct URL download | ~15 MB | `models/en_US-lessac-medium.onnx` |
| Piper voice config | Direct URL download | ~1 KB | `models/en_US-lessac-medium.onnx.json` |

### Download Progress

All downloads happen in background threads on startup. The Dashboard shows:
- **Model cards** with live status: ⏳ downloading with percentage, ✅ ready
- **16px progress bars** with golden gradient fill and bold centred % text
- **Activity log** entries for each download start/complete/error

Pre-download models before first use (headless):

```powershell
uv run python download_models.py
```

Failed downloads are cleaned up (`.tmp` files removed). Retry by re-running the app.

---

## Hardware Expectations

| Hardware | Behavior |
|---|---|
| **CPU-only Windows PC** | Fully supported. Whisper uses int8, LLM runs on CPU. Slower but functional. |
| **NVIDIA CUDA GPU** | Whisper uses float16 on CUDA. LLM offloads all layers to GPU. Significantly faster. |
| **AMD/Intel GPU** | LLM can use Vulkan backend (requires `install.py`). Whisper stays on CPU. |
| **16 GB RAM** | Recommended for smooth model loading. Both models fit comfortably. |
| **8 GB RAM** | May work but could be tight when both Whisper and Qwen are loaded. |
| **No internet** | Works fully after models are downloaded. First run requires internet. |

---

## Troubleshooting

### Transcription is wrong

- Use a headset or move closer to the microphone.
- Reduce background noise.
- Keep commands short and direct.
- Prefer common app names: "Chrome", "Notepad", "File Explorer".
- The transcription prompt is biased toward command vocabulary — conversational speech may be less accurate.

### First command is slow

The Whisper model (~1.5 GB) downloads and loads on the first voice command. The LLM (~2.5 GB) loads on the first intent classification. Subsequent commands use the already-loaded models.

### GriffinX opens the wrong app

1. Use the 👎 feedback button so GriffinX doesn't cache the wrong mapping.
2. Type the command once to test whether transcription or intent parsing caused the issue.
3. Check if the app has a `.lnk` shortcut in Start Menu or Desktop — GriffinX scans those on startup.

### No audio input

- Check the Windows default microphone in Sound Settings.
- Ensure app microphone permissions are enabled.
- GriffinX uses the default input device via `sounddevice` — no device selection UI exists yet.

### LLM returns garbage

- The Qwen 3 model may output `<think>` blocks — these are stripped automatically.
- If JSON extraction fails, GriffinX falls back to `general_query` with the raw text as the message.
- Check `logs/` for the SQLite database to inspect past interactions.

### TTS is silent

- Verify `models/en_US-lessac-medium.onnx` and its `.json` config file exist.
- Check terminal output for "Piper TTS engine initialized" or error messages.
- TTS is disabled gracefully if the model is missing — all other features continue working.

---

## Packaging Notes

Build a standalone executable:

```powershell
uv sync --extra build
uv run python build.py
```

This produces `dist/GriffinX.exe` — a single-file PyInstaller executable with:
- Python runtime + all dependencies
- All `core/`, `ui/`, and `assets/` modules
- Hidden imports for keyboard, sounddevice, llama_cpp, faster_whisper, PySide6, pynvml

### CPU + GPU Compatibility

The built executable runs on **both CPU-only and NVIDIA GPU** environments without modification:

| Component | CPU-only | NVIDIA GPU |
|---|---|---|
| LLM inference | CPU (slower, but functional) | GPU-accelerated via CUDA |
| Whisper STT | CPU int8 | CUDA float16 |
| Piper TTS | CPU ONNX | CPU ONNX |
| Dashboard GPU gauges | Shows N/A | Shows real-time GPU/VRAM |

**Not bundled:** The ~4 GB of model files. On first run, they download into `models/` next to the executable. For offline distribution, ship the populated `models/` folder alongside the EXE.

---

## Roadmap

### Planned Features (Next)

| Feature | Description |
|---|---|
| **Macro Manager UI** | A new section below AI Models in the Dashboard where users can register, name, edit, and delete macros. Named macros can then be triggered by voice ("Run the macro morning setup"). |
| **Voice Responses** | When GriffinX answers a general query, it speaks the response aloud via Piper TTS. This will be toggleable in Dashboard settings (on/off). |
| **Text Narration** | Select/highlight text in any application, then click the GriffinX ball — GriffinX reads the selected text aloud using Piper TTS. |

### Future Ideas

- **Conversation Mode** — multi-turn dialogue instead of single-shot intent classification
- **Custom Wake Word** — always-on listening with a trigger phrase
- **Plugin System** — user-defined intents and executors
- **Multiple TTS Voices** — choose from different Piper voice models
- **Cross-Platform** — macOS and Linux support

---

## Project Summary

GriffinX is a local-first, voice-controlled Windows desktop assistant. It uses three AI models — Faster-Whisper for speech recognition, Qwen 3 4B for intent classification, and Piper for text-to-speech — all running on-device without cloud dependencies.

### Key Components

| Component | File | Role |
|---|---|---|
| **App Controller** | `main.py` | Entry point. Wires all services, manages feedback loop, background model downloads, configurable push-to-talk hotkey. |
| **Audio Engine** | `core/audio.py` | Microphone capture at 16kHz mono. Lazy-loads Faster-Whisper. VAD-filtered transcription with command priming. |
| **LLM Engine** | `core/llm_engine.py` | Qwen 3 4B via llama-cpp-python. Structured JSON intent output. Think-block stripping and robust JSON extraction. |
| **Context Manager** | `core/context.py` | System prompt with intent examples. Short-term memory from last 5 interactions. |
| **Command Executor** | `core/executor.py` | Resolves app names via dynamic scanning. Executes open/close/type/hotkey/script/delay actions. |
| **Macro Manager** | `core/macro_manager.py` | Creates macros from history, binds hotkeys, replays action sequences. |
| **TTS Engine** | `core/tts_engine.py` | Piper neural TTS. WAV synthesis → PCM16 → float32 → sounddevice playback. Async thread. |
| **Model Manager** | `core/model_manager.py` | Downloads models from HuggingFace with Qt progress signals (`object` type for large files). Atomic writes. |
| **DB Manager** | `core/db.py` | SQLite with 3 tables: history (interactions + feedback), intent_cache (verified mappings), macros. |
| **UI Engine** | `ui/app.py` | PySide6 floating overlay (ball mode default + expanded), system tray, text input, feedback buttons, right-click context menu. |
| **Dashboard** | `ui/dashboard.py` | PySide6 main window with system gauges, model cards with progress bars, activity log, hotkey editor, and settings. |
| **Theme** | `ui/theme.py` | Golden-brown design system — colors, fonts, dimensions, gold-glow effects, global QSS stylesheet. |
| **Widgets** | `ui/widgets/` | Reusable GaugeWidget, ModelCard (16px progress bar), StatCard with gradient backgrounds. |
| **System Monitor** | `core/system_monitor.py` | CPU/RAM/GPU/VRAM stats via psutil and optional pynvml (graceful N/A). |
| **Settings** | `core/settings.py` | JSON settings persistence at %LOCALAPPDATA%/GriffinX/ (atomic writes). |
| **Startup Manager** | `core/startup_manager.py` | Windows Registry startup management. |

### Technology Stack

- **Language**: Python 3.10+
- **UI Framework**: PySide6 (migrated from PyQt6)
- **Design System**: Golden-brown theme with gold-glow accents
- **STT**: Faster-Whisper (CTranslate2)
- **LLM**: Qwen 3 4B GGUF via llama-cpp-python
- **TTS**: Piper (ONNX Runtime)
- **Desktop Automation**: pyautogui, keyboard (no key suppression)
- **System Monitoring**: psutil + pynvml (optional)
- **Database**: SQLite3
- **Packaging**: PyInstaller (single-file .exe, CPU + GPU compatible)
- **Platform**: Windows 10/11

---

*GriffinX: Your Local AI Assistant v1.0 — Built with Faster-Whisper + Qwen 3 4B + Piper TTS*
