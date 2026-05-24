# GriffinX: Your Local AI Assistant — Quick Guide

A voice-controlled Windows desktop assistant that runs entirely on your machine. Hold a hotkey, speak naturally, and GriffinX transcribes, classifies, executes, and speaks back — all offline.

> [!IMPORTANT]
> **Unlike cloud AI assistants** that require browser tabs, API keys, and internet access, GriffinX runs **three local AI models** on your hardware: Faster-Whisper for speech recognition, Qwen 3 4B for intent classification, and Piper for text-to-speech. Your voice never leaves your machine.

## 🚀 How to Run

### Option A — From Source (Development)

**Prerequisites:** Windows 10/11, Python 3.10+, [`uv`](https://docs.astral.sh/uv/), 16 GB RAM recommended, GPU optional

```powershell
uv sync
uv run python main.py
```

On first launch, the **Dashboard** opens immediately showing system gauges and model status cards. Runtime models (~4 GB total) auto-download from HuggingFace in the background with live progress bars. Subsequent launches load from the local `models/` folder.

### Option B — Standalone EXE

Download `GriffinX.exe` from [Releases](https://github.com/Felix-au/GriffinX-Your-Local-AI-Assistant/releases) — no Python installation needed.

```
Just double-click GriffinX.exe
```

> [!NOTE]
> The EXE bundles all Python dependencies inside a single file. It runs on **both CPU-only and NVIDIA GPU** environments — GPU monitoring gracefully shows N/A on systems without an NVIDIA GPU. AI models (~4 GB) are **not** bundled — they download automatically on first use and are cached locally in `models/`.

## 🔧 GPU Acceleration (Optional)

By default GriffinX runs on CPU. For GPU-accelerated LLM inference:

```powershell
python install.py
```

This auto-detects your GPU (NVIDIA → CUDA, AMD/Intel → Vulkan) and rebuilds `llama-cpp-python` with the appropriate backend. Requires Visual Studio C++ Build Tools.

## 📦 Pre-Download Models

```powershell
uv run python download_models.py
```

Downloads all three runtime models before launching, so the first command isn't slow:

| Model | Size | Purpose |
|---|---|---|
| Faster-Whisper Medium English | ~1.5 GB | Speech-to-text |
| Qwen 3 4B (Q4_K_M GGUF) | ~2.5 GB | Intent classification & chat |
| Piper Lessac Medium | ~15 MB | Text-to-speech |

## 📦 Build the EXE

```powershell
uv sync --extra build
uv run python build.py
```

Output: `dist/GriffinX.exe` — a fully self-contained executable that works on both CPU-only and NVIDIA GPU environments.

**What's bundled:** All Python runtime + dependencies (llama-cpp-python, faster-whisper, PySide6, piper-tts, etc.) + all core/ui modules.

**What's NOT bundled (downloads on first run):** The ~4 GB of AI model files — cached at `models/` next to the executable. For offline distribution, ship the `models/` folder beside the EXE.

## 🎯 How to Use

1. **Launch GriffinX** — the Dashboard opens showing system stats and model download progress. The floating ball appears bottom-right. A system tray icon appears in the taskbar.
2. **Hold your push-to-talk hotkey** (default: `Ctrl + CapsLock`) — GriffinX starts listening (green pulse animation on the ball).
3. **Speak a command** — keep it short and direct.
4. **Release the hotkey** — GriffinX transcribes → classifies intent → executes the action.
5. **Confirm with 👍/👎** — positive feedback caches the command for instant future use.
6. **Hear the response** — GriffinX speaks the result back via neural TTS.

> [!NOTE]
> GriffinX auto-classifies your command into an intent (open app, type text, hotkey, macro, or question). You don't need to use any special syntax — just speak naturally.

## 🗣️ Example Commands

```text
Open Chrome
Open Notepad
Close Chrome
Type hello world
Press ctrl s
Press alt f4
Create a macro called morning setup
Run the macro morning setup
What is the capital of France?
Hello
```

## ⌨️ Typing Instead of Speaking

**Ball mode:** Left-click the ball to open a text input field. Type a command and press `Enter`. This bypasses speech-to-text but uses the same intent engine and cache.

**Expanded overlay:** Use the text box at the bottom of the translucent window.

## 🔵 Minimal Ball Mode (Default)

GriffinX launches in Ball Mode by default — a branded floating circular avatar.

| Action | Effect |
|---|---|
| **Single-click** the ball | Open/close the text command input |
| **Double-click** the ball | Expand to the full translucent overlay |
| **Right-click** the ball | Context menu — Open Dashboard or Quit |
| **Drag** the ball | Reposition anywhere on screen |

Responses appear as a speech bubble above the ball, auto-hiding after a duration based on word count (5–15 seconds).

### Expanded Overlay

When you double-click the ball, the full translucent overlay appears showing status, transcript, and response text.

| Element | Description |
|---|---|
| **Header bar** | Warm golden-brown gradient with GriffinX logo — click to open Dashboard |
| **× button** | Collapses back to Ball Mode |
| **Status dot** | Green = listening, yellow = thinking, red = error |
| **Text input** | Type commands at the bottom — press Enter to execute |
| **👍/👎 buttons** | Appear after intent execution for feedback (larger, centred) |

## 🏠 Dashboard

The Dashboard is the command centre that opens at launch (80% of screen size, centred).

| Section | Description |
|---|---|
| **System Resources** | Real-time CPU, RAM, GPU, and VRAM gauges (GPU shows N/A without NVIDIA) |
| **AI Models** | Status cards for STT, LLM, and TTS — show download progress bars with percentage |
| **Recent Activity** | Timestamped activity log — downloads, engine init, commands, errors |
| **Settings** | Start at startup toggle, customisable push-to-talk hotkey (2-3 key combos) |

**Opening the Dashboard:**
- Click the logo/header in the expanded overlay
- Right-click the ball → "Open Dashboard"
- Double-click the system tray icon

**Closing the Dashboard:** Always minimises silently to the system tray — never fully exits.

## ⚡ Intent Cache (How GriffinX Gets Faster)

When you confirm a command with 👍, GriffinX caches the mapping:

```
"Open Chrome" → open_app:chrome
```

Next time you say anything similar (≥80% fuzzy match), the LLM is **completely skipped** — execution is instant. This is why GriffinX gets faster the more you use it.

## ⚙️ Configuration

### Dashboard Settings (persisted to `%LOCALAPPDATA%/GriffinX/settings.json`)

| Setting | Description |
|---|---|
| **Start at system startup** | Toggle to add/remove Windows Registry startup entry |
| **Push-to-talk hotkey** | Click the field, press a 2-3 key combo (e.g., `Ctrl+Shift+T`) — saves immediately |

> [!TIP]
> The hotkey doesn't suppress the trigger key — if your hotkey is `Ctrl+CapsLock`, CapsLock still toggles normally. Push-to-talk only activates when the full combo is pressed together.

### Runtime config in [`config.json`](config.json)

| Setting | Default | Description |
|---|---|---|
| `model_paths.whisper` | `models/faster-whisper-medium.en` | Path to Whisper model |
| `model_paths.llm` | `models/Qwen_Qwen3-4B-Q4_K_M.gguf` | Path to GGUF model |
| `whisper_device` | `auto` | `auto`, `cuda`, or `cpu` |
| `whisper_compute_type` | `default` | `default`, `float16`, or `int8` |
| `cache_threshold` | `0.80` | Fuzzy match threshold for cache hits |

## ⚠️ Important Notes

- **Windows-only** — keyboard hooks and app resolution use Windows-specific APIs.
- **CPU-first design** — no GPU required. CUDA accelerates inference but is never mandatory.
- **Cross-environment EXE** — the built executable runs on both CPU-only and NVIDIA GPU systems.
- **First launch is slow** — models (~4 GB) download from HuggingFace. Subsequent launches load from disk.
- **First voice command is slow** — the Whisper model loads lazily on the first voice command (~5–10s on CPU).
- **Microphone** — GriffinX uses the Windows default input device via `sounddevice`. Check Sound Settings if no audio is captured.
- **App resolution** — GriffinX scans Start Menu and Desktop shortcuts on startup. Any installed app with a shortcut is discoverable.
- **Safety** — Script execution is restricted to `.py` files. Delays are capped at 30 seconds. PyAutoGUI failsafe is enabled.
- **Privacy** — All processing is local after model download. History stored in SQLite at `logs/history.db`.

## 📁 Important Files

| File | Purpose |
|---|---|
| `main.py` | App entry point and orchestrator |
| `config.json` | Runtime model and device settings |
| `build.py` | PyInstaller build script (CPU + GPU compatible) |
| `download_models.py` | Pre-downloads all runtime models |
| `install.py` | GPU-aware dependency installer |
| `core/audio.py` | Microphone capture + Whisper STT |
| `core/llm_engine.py` | Qwen 3 4B intent classifier |
| `core/executor.py` | Desktop action execution + app resolution |
| `core/tts_engine.py` | Piper neural TTS |
| `core/db.py` | SQLite history, cache, and macros |
| `core/macro_manager.py` | Macro creation, storage, and replay |
| `core/model_manager.py` | Model download with Qt progress signals |
| `core/settings.py` | Persistent settings (JSON, atomic writes) |
| `core/system_monitor.py` | Real-time CPU/RAM/GPU gauges |
| `ui/app.py` | PySide6 floating overlay + system tray |
| `ui/dashboard.py` | Dashboard window + hotkey editor |
| `ui/theme.py` | Golden-brown design system tokens + QSS |
| `ui/widgets/` | GaugeWidget, ModelCard, StatCard components |
