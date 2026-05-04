# TalkwebSour Chrome Extension V3.5
> ⚡ Semi-transparent tech-style sidebar + global AI rewrite layer

---

## 🌍 Languages

- 🇬🇧 [English]（current）
- 🇨🇳 [中文](./README_CN.md)

---

## 🚀 V3.5 Highlights

- 🔖 Version and UI labels unified as **V3.5** (manifest `3.5.0`)
- 🧩 One-click install scripts located in the **project root**:
  - `SourMac.command` (Mac)
  - `SourWins.bat` (Windows)
- ⚡ In Quick Mode, **selecting a script counts as usage** (for “frequently used scripts” ranking), no longer dependent on clicking “Copy”
- 🧠 In the standalone Mermaid editor, **AI Fix** sends both source code and Mermaid parsing/rendering errors to the model
- 📚 Documentation simplified: this README is the **single source of truth**; legacy `.md` files removed

---

## ✨ Feature Overview

### ⚡ Global AI Command Palette

- **Trigger**: “⚡” button next to sidebar search, or shortcut **⌘K (Mac) / Alt+Shift+A (Windows)**
- **Modes**:
  - 💤 No API Key: script search and insertion only
  - 🧠 With API Key: AI actions such as polish, summarize, translate selected text

---

### 🧱 Three-Layer Architecture

- 🎯 Trigger — shortcuts, selection tracking, focus memory  
- 💬 Command — slash commands, prompts, multi-provider  
- 🖼 Render — palette / preview / diff  

---

### 🔌 Text Injection Compatibility

- `<textarea>` / `<input>` (including React/Vue controlled components)
- `contenteditable`
- ChatGPT / Claude / ProseMirror-based editors

---

### 🤖 Supported AI Services (configurable)

- OpenAI (GPT-4o / 4o-mini, etc.)
- Google Gemini
- Alibaba Qwen (OpenAI-compatible endpoint)
- DeepSeek
- Ollama (local)

---

## 📁 Project Structure (Excerpt)


```
TalkWebSour_V3.5/
├── manifest.json              # Extension config (version 3.5.0)
├── SourMac.command            # Mac one-click setup (root)
├── SourWins.bat               # Windows one-click setup (root)
├── popup.html / popup.js
├── src/
│   ├── content.js             # Sidebar core logic
│   ├── background.js        # Background service
│   ├── ai_rewrite/          # AI rewrite layer
│   ├── components/          # Mermaid editor, etc.
│   └── utils/               # Bundled utilities
├── icons/
└── scripts/                   # Build & tooling scripts
```

---

## 🧩 One-Click Setup (Mac / Windows)

No Node / Python required beforehand. Double-click to auto-detect and install missing dependencies (**Homebrew / Node / npm / Python**) and run `npm install`.

| Platform | Script |
|----------|--------|
| 🍎 Mac | `./SourMac.command` |
| 🪟 Windows | `SourWins.bat` |

---

### ⚠️ Permissions & Issues

**Mac**
- May be blocked initially: Right-click → Open / System Settings → Privacy → Allow
- Fix permission:
```bash
chmod +x SourMac.command

**Windows**

- Run CMD as Administrator if winget fails
- Restart after Node installation if node not found

**Optional Build Commands：

```bash
npm run build:quick-chat-history
npm run build:mermaid-editor
npm run build:mermaid
npm run build:parse-ai
```

---

🌐 Load Extension in Chrome (Dev Mode)

1.Open chrome://extensions/
2.Enable Developer Mode
3.Click Load unpacked
4.Select project root folder
5.Reload after changes (⌘R / F5)

---

🧭 Usage Guide (Simplified)

📌 Sidebar
1.Click toolbar icon → toggle sidebar
2.Drag header → move window
3.Drag edge → resize
4.Alt + / → focus search

🧠 AI Panel (with Key)

1.Select text on page
2.Press ⌘K or click “⚡”
3.Choose action → preview → apply

##⚡ Quick Mode & Script Ranking

1.Clicking a script counts usage (for ranking)
2.Even without API Key, search + UI features still work

---

##🆚 Examples (Core Value)

👉 Comparison: Generic AI vs TalkWeb

---
🧾 Example 1: SOP Generation
Input

Now we need to design a procurement process...

❌ Generic AI (e.g. Gemini)
1.Simple step descriptions
2.No role structure
3.No formal format
4.Not executable in enterprise context

📸 Example screenshots:
<img width="700" height="400" alt="image" src="https://github.com/user-attachments/assets/ecd60333-a74c-46a9-b03c-16cb9c6049ef" />

<img width="700" height="400" alt="image" src="https://github.com/user-attachments/assets/8e204346-ddaf-4a79-8795-1c2211804c4e" /> <img width="700" height="400" alt="image" src="https://github.com/user-attachments/assets/8a3d7375-f2ba-483d-ad68-9d979973dfde" />


✅ TalkWeb (Standard SOP Prompt)
1.Auto-detect business domain (procurement / finance)
2.Auto-generate roles (requester / buyer / approver)
3.Full SOP structure output
4.Includes process + risk control + audit trail
5.Ready for enterprise execution

📸 Example screenshots:
<img width="700" height="400" alt="image" src="https://github.com/user-attachments/assets/ef47b4b2-b13c-4176-b4f8-4645fb2b524d" />
<img width="700" height="400" alt="image" src="https://github.com/user-attachments/assets/5f012aee-8a59-4cae-90d8-f6dfdac49189" />
<img width="700" height="400" alt="image" src="https://github.com/user-attachments/assets/998a1932-2a00-45d5-bb66-2772add5202e" />
<img width="700" height="400" alt="image" src="https://github.com/user-attachments/assets/3afb4b2e-6254-4baf-b1af-bb10c2a48b80" />

##🧭 Example 2: Mermaid Flowchart
Input

##Draw a procurement flowchart

❌ Generic AI
1.Incomplete or messy logic
2.Missing roles
3.Weak structure

📸 Screenshot:
<img width="700" height="400" alt="image" src="https://github.com/user-attachments/assets/6e998bd8-be72-4954-a3c4-c1ff5c73f93a" />

✅ TalkWeb
1.🧩 Auto process detection
2.👥 Role-based flow
3.📊 Standard Mermaid output

📸 Screenshots:
<img width="905" height="759" alt="image" src="https://github.com/user-attachments/assets/8a889b0d-7bba-485a-90b2-0291b625eff0" />
<img width="1466" height="833" alt="image" src="https://github.com/user-attachments/assets/90956c08-4cc7-41b5-aa54-68ea5bec73c6" />

🤖 Example 3: AI Persona
Request

Use a funny Iron Man-style IT engineer to fix my computer

✅ TalkWeb Persona System
1.🎭 Custom persona support
2.😂 Humor + technical balance
3.🛠 Practical solution + entertainment

📸 Screenshot:
<img width="1031" height="767" alt="image" src="https://github.com/user-attachments/assets/815c21bc-4d96-439f-8ecc-df71f83ce1b3" />
<img width="1030" height="773" alt="image" src="https://github.com/user-attachments/assets/9e77b6e7-b097-458b-95ac-4541189d43a8" />



🔥 Key Differences

| Capability        | Generic AI | TalkWeb |
| ----------------- | ---------- | ------- |
| SOP Structuring   | ❌          | ✅       |
| Role Detection    | ❌          | ✅       |
| Executable Output | ❌          | ✅       |
| Flowchart Quality | ⚠️         | ✅       |
| Persona Stability | ❌          | ✅       |
| Prompt Management | ❌          | ✅       |

---

👉 Core difference:

Generic AI = answers questions
TalkWeb = builds systems

---

##🧾 CHANGELOG (V3.5)
🔖 Version updated to 3.5.0
⚡ Quick Mode usage tracking improved
🧠 Mermaid AI Fix enhanced (error-aware)
🧩 One-click setup scripts standardized
📚 README unified as single documentation

---

👤 License / Author

Author: ErickLiu (see manifest.json)
Use subject to local laws and AI service terms.
