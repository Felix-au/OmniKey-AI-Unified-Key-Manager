<p align="center">
  <img src="assets/trixie.jpeg" width="150" alt="GriffinX Logo"/>
</p>
<h1 align="center">GriffinX: Your Local AI Assistant</h1>
<p align="center">
  <strong>Voice-controlled desktop assistant that runs entirely on your machine</strong><br/>
  <em>Hold a hotkey → speak naturally → GriffinX transcribes, thinks, acts, and speaks back — all offline</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows-0078D6?style=flat-square&logo=windows&logoColor=white" alt="Windows" />
  <img src="https://img.shields.io/badge/STT-Faster--Whisper-FF6F00?style=flat-square&logo=huggingface&logoColor=white" alt="Whisper" />
  <img src="https://img.shields.io/badge/LLM-Qwen3--4B--GGUF-blueviolet?style=flat-square" alt="Qwen" />
  <img src="https://img.shields.io/badge/TTS-Piper_Neural-41CD52?style=flat-square" alt="Piper" />
  <img src="https://img.shields.io/badge/ui-PySide6-41CD52?style=flat-square&logo=qt&logoColor=white" alt="PySide6" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Why GriffinX?](#-why-griffinx)
- [Features](#-features)
- [Architecture](#-architecture)
- [Pipeline Flow](#-pipeline-flow)
- [Model Pipeline](#-model-pipeline)
- [Quick Start](#-quick-start)
- [Hardware-Accelerated LLM Setup](#-hardware-accelerated-llm-setup)
- [Build Standalone EXE](#-build-standalone-exe)
- [Project Structure](#-project-structure)
- [Dependencies](#-dependencies)
- [Configuration](#-configuration)
- [Roadmap](#-roadmap)
- [Author](#-author)

---

## 🔍 Overview

**GriffinX** is a Windows desktop assistant that lets you control your PC with your voice while keeping all inference local. It listens through push-to-talk, transcribes speech with a local Whisper model, classifies your intent with a local Qwen 3 4B LLM running via `llama.cpp`, executes desktop actions (open/close apps, type text, press hotkeys, run macros), learns from your feedback, and speaks back using offline Piper neural text-to-speech.

No cloud is required for normal use. Model files (~4 GB total) are downloaded on first run and then loaded from the local `models/` folder.

> GriffinX is **CPU-first by design**. A GPU is optional — it accelerates inference but is never required. The built EXE runs on **both CPU-only and NVIDIA GPU** systems without modification. The app runs on any Windows 10/11 machine with 16 GB RAM.

---

## 🎯 Why GriffinX?

> **Most AI assistants either live in a browser or depend on cloud APIs. GriffinX gives you direct desktop control — offline.**

| | Cloud AI Assistants | GriffinX |
|---|---|---|
| **Workflow** | Open browser → type prompt → wait → copy result | Hold hotkey → speak → GriffinX acts immediately |
| **Privacy** | Voice and commands sent to cloud servers | Everything stays on your machine — STT, LLM, TTS, history |
| **Desktop Control** | Text-only responses, no system actions | Opens/closes apps, types text, presses hotkeys, runs macros |
| **Learning** | Stateless — no memory of your habits | Intent cache learns from feedback — repeated commands skip LLM |
| **Offline** | Requires constant internet | Works fully offline after one-time model download |
| **Latency** | Network round-trip per request | Direct local inference — sub-second for cached commands |
| **Voice Output** | Browser-based TTS or none | Offline neural TTS via Piper — natural-sounding speech |

---

## ✨ Features

### 🎙️ Voice Input
| Feature | Description |
|---|---|
| **Push-to-Talk** | Customisable hotkey (default: `Ctrl + CapsLock`) — change in Dashboard settings |
| **Local STT** | Faster-Whisper Medium English — runs on GPU (float16) or CPU (int8) |
| **Command Priming** | Transcription prompt biased toward common commands and app names for better accuracy |
| **VAD Filtering** | Voice Activity Detection filters silence — min 500ms silence threshold |
| **No Key Suppression** | The trigger key still functions normally — CapsLock toggles, Space types, etc. |

### 🧠 Intent Classification
| Feature | Description |
|---|---|
| **Local LLM** | Qwen 3 4B (Q4_K_M GGUF) via `llama-cpp-python` — 4-bit quantized, ~2.5 GB |
| **Auto-Download** | LLM model downloads automatically on first launch with progress in Dashboard |
| **Structured Output** | LLM outputs JSON with `intent` and `target` fields |
| **Think-Block Stripping** | Automatically removes Qwen 3's `<think>` reasoning blocks |
| **Robust JSON Parsing** | Handles code fences, nested objects, and partial outputs |
| **GPU Auto-Offload** | `n_gpu_layers=-1` offloads all layers to GPU when available |

### ⚡ Smart Intent Cache
| Feature | Description |
|---|---|
| **Feedback-Driven** | Only verified-correct commands are cached |
| **Fuzzy Matching** | SequenceMatcher-based similarity (80% threshold, 90% for short commands) |
| **Cache-First Pipeline** | Cached commands skip LLM inference entirely — instant execution |
| **Use Counting** | Tracks how often each cached mapping is used |

### 🖥️ Desktop Actions
| Feature | Description |
|---|---|
| **App Launch** | Opens any app via dynamic Start Menu/Desktop shortcut scanning |
| **App Close** | Kills processes by executable name via `taskkill` |
| **Text Typing** | Types text into the active window via `pyautogui` |
| **Hotkeys** | Presses keyboard shortcuts (e.g., `ctrl+s`, `alt+f4`) |
| **Script Execution** | Runs `.py` scripts (safety-restricted to Python files only) |
| **Delay** | Timed pauses during macro playback (max 30 seconds) |

### 🔁 Macro System
| Feature | Description |
|---|---|
| **Voice-Created** | Say "Create a macro called morning setup" to save recent actions |
| **Voice-Triggered** | Say "Run the macro morning setup" to replay |
| **Hotkey-Bound** | Macros can be assigned global hotkeys for instant trigger |
| **History-Derived** | Macros are built from the last N successful actions in the interaction log |
| **SQLite-Persisted** | Stored in the local database — survive restarts |

### 🔊 Text-to-Speech
| Feature | Description |
|---|---|
| **Piper Neural TTS** | Offline neural synthesis — Lessac Medium voice (22050 Hz, 16-bit mono) |
| **Async Playback** | Speech runs in a background thread — never blocks the UI |
| **WAV Pipeline** | Synthesizes to in-memory WAV buffer → PCM16 → float32 → `sounddevice` |

### 🏠 Dashboard (Command Centre)
| Feature | Description |
|---|---|
| **System Gauges** | Real-time CPU, RAM, GPU, VRAM dials — GPU shows N/A gracefully on CPU-only |
| **AI Model Cards** | Status per model (STT, LLM, TTS) with 16px progress bars and % during download |
| **Activity Log** | Timestamped feed of downloads, engine init, command execution, errors |
| **Settings** | Start-at-startup toggle, customisable push-to-talk hotkey (2-3 key combos) |
| **80% Screen Launch** | Dashboard opens centred at 80% of screen width & height |
| **Golden-Brown Theme** | Premium warm aesthetic with gold-glow accents on interactive elements |
| **Always-On Tray** | Closing the dashboard silently minimises to system tray — no notification |

### 🖥️ Floating Overlay & Ball Mode
| Feature | Description |
|---|---|
| **Ball Mode Default** | GriffinX starts as a compact branded ball — single-click opens text input, double-click expands |
| **Right-Click Menu** | Context menu on the ball: Open Dashboard / Quit |
| **Expanded Overlay** | Translucent glassmorphic panel with status, transcript, and response |
| **Logo Click** | Click the header logo in expanded mode → opens Dashboard (hand cursor) |
| **× Close Button** | Circular golden button collapses back to Ball Mode |
| **Neon Animations** | Green pulse when listening; cyan sweep when thinking; amber breathing at idle |
| **Feedback Buttons** | 44px 👍/👎 centred below the ball or above text input — fully visible |
| **Draggable** | Click and drag to reposition anywhere on screen |
| **Click Delay** | 300ms delay on single-click prevents accidental text input triggers |

---

## 🏗 Architecture

```mermaid
graph TD
    subgraph UI["UI Layer (PySide6)"]
        KBD["Keyboard Listener\nConfigurable PTT hotkey"]
        DASH["Dashboard\nGauges · Models · Logs · Settings"]
        OVL["Floating Overlay\nBall Mode + Expanded"]
        TRAY["System Tray"]
    end

    subgraph Core["Core Engine"]
        AUD["Audio Engine\nMic 16kHz · Faster-Whisper STT"]
        LLM["LLM Engine\nQwen 3 4B GGUF (llama.cpp)\nJSON intent output"]
        EXEC["Command Executor\nopen/close apps · type · hotkeys · macros"]
        CTX["Context Manager\nSystem prompt + memory"]
        DB["DB Manager\nSQLite (history · cache · macros)"]
        TTS["TTS Engine\nPiper neural · async"]
        SYS["System Monitor\nCPU/RAM/GPU/VRAM"]
        MM["Model Manager\nHuggingFace auto-download"]
    end

    KBD --> AUD
    AUD --> LLM
    CTX --> LLM
    LLM --> EXEC
    EXEC --> TTS
    EXEC --> DB
    MM --> DASH
    SYS --> DASH
```

<details>
<summary>ASCII fallback (click to expand)</summary>

```
┌──────────────────────────────────────────────────────────────────────┐
│                      GriffinX Desktop App                            │
│                                                                      │
│  ┌────────────────┐    ┌──────────────────────────────────────────┐  │
│  │   Keyboard     │    │        UI Layer (PySide6)                │  │
│  │   Listener     │    │                                          │  │
│  │                │    │  ┌──────────┐  ┌──────────┐ ┌────────┐   │  │
│  │ Configurable   ├───►│  │ Dashboard│  │ Floating │ │ System │   │  │
│  │ push-to-talk   │    │  │ (gauges, │  │ Overlay  │ │ Tray   │   │  │
│  │ hotkey         │    │  │  models, │  │ (ball +  │ │ Icon   │   │  │
│  └────────────────┘    │  │  logs,   │  │  expand) │ └────────┘   │  │
│                        │  │  settings│  └────┬─────┘              │  │
│                        │  └──────────┘       │                    │  │
│                        └─────────────────────┼────────────────────┘  │
│                                              │                       │
│  ┌───────────────────────────────────────────┼────────────────────┐  │
│  │                     Core Engine                                │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │  │
│  │  │ Audio Engine │  │ LLM Engine   │  │ Command Executor   │    │  │
│  │  │ Microphone   │  │ Qwen 3 4B    │  │ open/close apps    │    │  │
│  │  │ 16kHz mono   │  │ GGUF via     │  │ type text          │    │  │
│  │  │ Faster-      │  │ llama.cpp    │  │ press hotkeys      │    │  │
│  │  │ Whisper STT  │  │ JSON intent  │  │ macro playback     │    │  │
│  │  └──────────────┘  └──────────────┘  └────────────────────┘    │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │  │
│  │  │ Context      │  │ DB Manager   │  │ Macro Manager      │    │  │
│  │  │ Manager      │  │ SQLite:      │  │ Create, bind       │    │  │
│  │  │ System       │  │ history,     │  │ hotkeys, replay    │    │  │
│  │  │ prompt +     │  │ intent cache │  └────────────────────┘    │  │
│  │  │ memory       │  │ macros       │                            │  │
│  │  └──────────────┘  └──────────────┘                            │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │  │
│  │  │ TTS Engine   │  │ Model        │  │ System Monitor     │    │  │
│  │  │ Piper neural │  │ Manager      │  │ CPU/RAM/GPU/VRAM   │    │  │
│  │  │ offline      │  │ Auto-download│  │ real-time gauges   │    │  │
│  │  │ synthesis    │  │ from HF      │  │ (pynvml optional)  │    │  │
│  │  └──────────────┘  └──────────────┘  └────────────────────┘    │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐                            │  │
│  │  │ Settings     │  │ Startup      │                            │  │
│  │  │ JSON atomic  │  │ Manager      │                            │  │
│  │  │ persistence  │  │ Win Registry │                            │  │
│  │  └──────────────┘  └──────────────┘                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

</details>

---

## 🔄 Pipeline Flow

```mermaid
flowchart TD
    A["Hold hotkey\nMicrophone captures 16kHz mono"] --> B["Release key\nFaster-Whisper transcribes locally\n(GPU float16 / CPU int8)"]
    B --> C["Transcript e.g. 'Open Chrome'"]
    C --> D{Intent Cache Check\nSequenceMatcher ≥ 80%}
    D -->|HIT ⚡| E["Execute immediately\nskip LLM"]
    D -->|MISS| F["Context Manager\nSystem prompt + last 5 interactions"]
    F --> G["Qwen 3 4B (llama.cpp)\nJSON: {intent, target}"]
    G --> H["Command Executor\nopen_app · close_app · hotkey · macro · query"]
    E --> I["TTS Engine speaks response\n(Piper neural, async)"]
    H --> I
    I --> J["Feedback 👍/👎\n👍 = cache mapping for instant reuse"]
    J --> K["Interaction logged to SQLite"]
```

<details>
<summary>ASCII fallback (click to expand)</summary>

```
Hold hotkey (configurable) → Microphone captures 16kHz mono audio
     │
     ▼
Release key → Audio sent to Faster-Whisper (GPU float16 / CPU int8)
     │            Transcription prompt primes for command vocabulary
     ▼
Transcript: "Open Chrome"
     │
     ├──► Intent Cache Check (SequenceMatcher ≥ 80% similarity)
     │         │
     │    ┌────┴─────┐
     │    │ HIT      │ → Execute immediately (skip LLM) → ⚡ instant
     │    │ MISS     │ → Continue to LLM ↓
     │    └──────────┘
     │
     ▼
Context Manager assembles system prompt + last 5 interactions
     │
     ▼
Qwen 3 4B (llama.cpp) → JSON output: {"intent":"open_app","target":"chrome"}
     │                    Think-blocks stripped, robust JSON extraction
     ▼
Command Executor routes intent:
  → open_app: resolve target → subprocess.Popen via cmd.exe start
  → close_app: taskkill /IM target.exe /F
  → string_type: pyautogui.write(target)
  → hotkey: pyautogui.hotkey(*keys)
  → macro_creation: save last N actions to SQLite
  → macro_execution: replay saved action sequence
  → general_query: return LLM's text response
     │
     ▼
TTS Engine speaks response (Piper neural, async thread)
     │
     ▼
Feedback buttons appear (👍/👎) → positive = cache the mapping
     │
     ▼
Interaction logged to SQLite (timestamp, input, intent, status, feedback)
```

</details>

---

## 🧪 Model Pipeline

GriffinX ships without large model files. On first use it downloads three models with live progress in the Dashboard:

| Model | Engine | Size | Purpose | Local Path |
|---|---|---|---|---|
| Faster-Whisper Medium English | CTranslate2 | ~1.5 GB | Speech-to-text | `models/faster-whisper-medium.en/` |
| Qwen 3 4B (Q4_K_M GGUF) | llama.cpp | ~2.5 GB | Intent classification & chat | `models/Qwen_Qwen3-4B-Q4_K_M.gguf` |
| Piper Lessac Medium | ONNX Runtime | ~15 MB | Text-to-speech | `models/en_US-lessac-medium.onnx` |

### Hardware Adaptation

| Hardware | Whisper | LLM | TTS | Dashboard GPU Gauges |
|---|---|---|---|---|
| **NVIDIA GPU** | CUDA, float16 | All layers on GPU (`n_gpu_layers=-1`) | CPU (ONNX) | Active (pynvml) |
| **AMD GPU** | CPU, int8 | Vulkan backend (via install.py) | CPU (ONNX) | N/A |
| **CPU only** | CPU, int8 | CPU inference | CPU (ONNX) | N/A |

Pre-download all models before first use:

```powershell
uv run python download_models.py
```

---

## 🚀 Quick Start

### Prerequisites

- Windows 10/11
- Python 3.10+
- [`uv`](https://docs.astral.sh/uv/) package manager
- 16 GB RAM recommended
- GPU optional (NVIDIA CUDA or AMD Vulkan); CPU mode is the default baseline

### Install & Run

```powershell
# 1. Clone the repository
git clone https://github.com/Felix-au/GriffinX-Your-Local-AI-Assistant.git
cd GriffinX-Your-Local-AI-Assistant

# 2. Install dependencies
uv sync

# 3. (Optional) Pre-download models
uv run python download_models.py

# 4. Run GriffinX
uv run python main.py
```

On first launch:
- The **Dashboard** opens immediately (80% of screen, centred)
- Missing models auto-download in background with live progress bars
- The floating **ball** appears bottom-right
- System gauges start showing CPU/RAM in real-time
- GPU gauges show N/A gracefully if no NVIDIA GPU is detected

### Use It

1. **Hold your push-to-talk hotkey** (default: `Ctrl + CapsLock`) — GriffinX starts listening (green pulse)
2. **Speak a command** — e.g., "Open Chrome", "Type hello world", "Press ctrl+s"
3. **Release the hotkey** — GriffinX transcribes, classifies intent, and executes
4. **Confirm with 👍/👎** — positive feedback caches the command for instant future use
5. **Or type** — left-click the ball or use the text input in the expanded overlay

---

## 🔧 Hardware-Accelerated LLM Setup

By default, `llama-cpp-python` installs with CPU-only support. For GPU acceleration, run the included installer:

```powershell
python install.py
```

This script:
1. Installs base dependencies from `pyproject.toml`
2. Detects your GPU vendor via WMIC (NVIDIA / AMD / Intel)
3. Rebuilds `llama-cpp-python` with the appropriate backend:
   - **NVIDIA** → `CMAKE_ARGS="-DGGML_CUDA=on"`
   - **AMD/Intel** → `CMAKE_ARGS="-DGGML_VULKAN=on"`
4. Falls back to CPU-only if the build fails

> **Requires:** Visual Studio C++ Build Tools for compilation.

---

## 📦 Build Standalone EXE

```powershell
uv sync --extra build
uv run python build.py
```

Output:

```
dist/
└── GriffinX.exe      # Single-file executable (windowed, no console)
                     # Python runtime + all deps bundled via PyInstaller
```

### What's Bundled Inside the EXE
- Python runtime + all dependencies (llama-cpp-python, faster-whisper, PySide6, piper-tts, etc.)
- All `core/`, `ui/`, and `assets/` modules
- Hidden imports for keyboard, sounddevice, llama_cpp, faster_whisper, pynvml

### What Downloads on First Run
- **STT model**: Faster-Whisper Medium English (~1.5 GB) → `models/faster-whisper-medium.en/`
- **LLM model**: Qwen 3 4B GGUF (~2.5 GB) → `models/Qwen_Qwen3-4B-Q4_K_M.gguf`
- **TTS model**: Piper Lessac voice + config (~15 MB) → `models/en_US-lessac-medium.onnx`

### CPU + GPU Compatibility

The built executable runs on **both CPU-only and NVIDIA GPU** environments without modification:

| Component | CPU-only | NVIDIA GPU |
|---|---|---|
| LLM inference | CPU (slower, but functional) | GPU-accelerated via CUDA |
| Whisper STT | CPU int8 | CUDA float16 |
| Piper TTS | CPU ONNX | CPU ONNX |
| Dashboard GPU gauges | Shows N/A | Shows real-time GPU/VRAM |

> **Why not bundle the models?** The models total ~4 GB — bundling would create an impractically large executable. Instead, they download once on first launch and are cached permanently in `models/`.

For offline distribution, ship the populated `models/` folder beside `GriffinX.exe`.

---

## 📁 Project Structure

```
GriffinX/
├── main.py                      # App entry point — orchestrator + background model downloads
├── config.json                  # Runtime configuration (model paths, Whisper settings)
├── build.py                     # PyInstaller build pipeline (CPU + GPU compatible)
├── build.spec                   # PyInstaller spec file
├── install.py                   # GPU-aware dependency installer
├── download_models.py           # Pre-downloads all runtime models
├── pyproject.toml               # Project metadata + dependencies (uv/pip)
│
├── core/                        # Backend engine
│   ├── __init__.py
│   ├── audio.py                 # Microphone capture + Faster-Whisper STT
│   ├── llm_engine.py            # Qwen 3 4B intent classifier via llama.cpp
│   ├── context.py               # System prompt + short-term memory
│   ├── executor.py              # Desktop action execution + app resolution
│   ├── macro_manager.py         # Macro creation, storage, and hotkey binding
│   ├── tts_engine.py            # Piper neural TTS with async playback
│   ├── model_manager.py         # HuggingFace download + Qt progress signals
│   ├── db.py                    # SQLite: history, intent cache, macros
│   ├── settings.py              # Persistent JSON settings (atomic writes)
│   ├── system_monitor.py        # Real-time CPU/RAM/GPU/VRAM monitoring
│   └── startup_manager.py       # Windows Registry startup integration
│
├── ui/                          # PySide6 GUI
│   ├── __init__.py
│   ├── app.py                   # Floating overlay + ball mode + system tray
│   ├── dashboard.py             # Dashboard window + hotkey editor
│   ├── theme.py                 # Golden-brown design system + QSS stylesheet
│   └── widgets/
│       ├── __init__.py
│       ├── gauge_widget.py      # Animated circular gauge with QPropertyAnimation
│       ├── model_card.py        # Model status card with download progress bar
│       └── stat_card.py         # Stat card with gradient background
│
├── assets/                      # Branded visual assets
│   ├── trixie.ico               # Windows icon (EXE, taskbar, window title)
│   ├── trixie.jpeg              # Logo image (README, dashboard header)
│   └── trixie-circular.jpeg     # Circular avatar (floating ball)
│
├── models/                      # Runtime model storage (auto-populated, gitignored)
├── logs/                        # SQLite database storage (gitignored)
│
├── GriffinX.md                    # Detailed user guide with worked examples
├── guide.md                     # Quick-start guide
├── README.md                    # This file
├── LICENSE                      # MIT License
└── .gitignore                   # Ignores models, logs, venv, build artifacts
```

---

## 📚 Dependencies

| Package | Purpose |
|---|---|
| `faster-whisper` | Local speech-to-text (CTranslate2 backend) |
| `huggingface-hub` | Model downloading from HuggingFace |
| `llama-cpp-python` | Local LLM inference for Qwen 3 4B GGUF |
| `PySide6` | Desktop UI framework (overlay, dashboard, tray) |
| `piper-tts` | Offline neural text-to-speech |
| `onnxruntime` | ONNX model runtime for Piper TTS |
| `keyboard` | Global hotkey hooks (push-to-talk) |
| `sounddevice` | Audio capture and playback |
| `numpy` | Audio array processing |
| `scipy` | Signal processing utilities |
| `pyautogui` | Desktop automation (typing, hotkeys) |
| `psutil` | System resource monitoring (CPU, RAM) |
| `platformdirs` | Cross-platform app data directory resolution |
| `mss` | Screen capture utilities |
| `Pillow` | Image processing |
| `pynvml` | NVIDIA GPU monitoring (optional `[gpu]` extra) |
| `pyinstaller` | Standalone EXE packaging (optional `[build]` extra) |

---

## ⚙️ Configuration

All runtime configuration lives in [`config.json`](config.json):

| Key | Default | Description |
|---|---|---|
| `db_path` | `logs/history.db` | SQLite database location |
| `model_paths.whisper` | `models/faster-whisper-medium.en` | Path to Whisper model directory |
| `model_paths.llm` | `models/Qwen_Qwen3-4B-Q4_K_M.gguf` | Path to GGUF model file |
| `whisper_device` | `auto` | STT device: `auto`, `cuda`, or `cpu` |
| `whisper_compute_type` | `default` | STT precision: `default`, `float16`, or `int8` |
| `cache_threshold` | `0.80` | Fuzzy-match threshold for intent cache (0.0–1.0) |

### Dashboard Settings (`%LOCALAPPDATA%/GriffinX/settings.json`)

| Key | Default | Description |
|---|---|---|
| `start_at_startup` | `true` | Add/remove Windows Registry startup entry |
| `hotkey` | `ctrl+caps lock` | Push-to-talk key combination (2-3 keys) |

### Auto-Detected Settings

| Hardware | `whisper_device` resolves to | `whisper_compute_type` resolves to |
|---|---|---|
| NVIDIA CUDA GPU detected | `cuda` | `float16` |
| No CUDA GPU | `cpu` | `int8` |

---

## 🗺️ Roadmap

### Planned Features

| Feature | Description | Status |
|---|---|---|
| **Macro Manager UI** | Dashboard section below AI Models where users can register, name, edit, and delete macros — then trigger them by voice | 🔜 Next |
| **Voice Responses** | When a general query is answered, GriffinX speaks the response aloud via Piper TTS (toggle on/off in Dashboard settings) | 🔜 Next |
| **Text Narration** | Select/highlight text anywhere, then click the GriffinX ball — GriffinX reads the selected text aloud | 🔜 Next |

### Improvement Ideas

#### High Impact
- **Conversation Mode** — Multi-turn dialogue for complex queries instead of single-shot intent classification
- **Custom Wake Word** — Always-on listening with a wake word (e.g., "Hey GriffinX") instead of push-to-talk
- **Plugin System** — Let users add custom intents and executors without modifying core code
- **Cross-Platform** — Port to macOS (Core Audio) and Linux (PulseAudio)

#### Medium Impact
- **Streaming TTS** — Stream Piper output as it generates for reduced perceived latency
- **Multiple Voices** — Let users choose from different Piper voice models
- **Command Suggestions** — Auto-suggest likely commands based on history patterns

#### Polish
- **Overlay Themes** — Additional theme presets beyond golden-brown
- **Accessibility** — Screen reader support and keyboard-only navigation
- **Auto-Update** — Check GitHub releases for new versions on startup

---

## 👤 Author

**Felix-au** (Harshit Soni)

- 🔗 GitHub: [github.com/Felix-au](https://github.com/Felix-au)
- 📧 Email: [harshit.soni.23cse@bmu.edu.in](mailto:harshit.soni.23cse@bmu.edu.in)

---

<p align="center">
  <sub>Built for users who want AI desktop control without the cloud.</sub>
</p>
