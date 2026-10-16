# 🚀 FormPilot — Smart Universal Form & Survey Automation

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-10B981?style=for-the-badge&logo=googlechrome)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![Version](https://img.shields.io/badge/Version-2.1.0-0ea5e9?style=for-the-badge)](./manifest.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**FormPilot** is an intelligent, high-speed form automation and survey-filling Chrome Extension built with **Manifest V3**. Operating seamlessly inside Chrome’s native Side Panel, FormPilot automates repetitive data entry, multi-page questionnaires, complex research surveys, and dynamic web forms using human-like input emulation, randomized distributions, and intelligent anti-trap verification guards.

---

## 🌟 Key Highlights

- **⚡ One-Click Page Fill:** Instantly populate all visible form elements on the current tab without advancing.
- **🔄 Autonomous Continuous Loop:** Automatically fill pages, identify Next / Continue / Submit buttons, advance through multi-step surveys, and cycle with configurable cooldown timers.
- **🛡️ Built-in Verification & Trap Guard:** Scans DOM text and selectors for honeypots, captcha screens, attention checks, and verification keywords. When detected, FormPilot auto-pauses to protect accounts from disqualification or bot bans.
- **🎯 Universal Input Compatibility:** Handles standard inputs, nested matrices, carousels, drag-and-drop matching, and custom ARIA components.
- **🎨 Modern Native Side Panel UI:** Clean, reactive dashboard built with vanilla CSS design tokens, live status indicators, pulse animations, and tag chip controls.
- **☁️ Synced Configuration:** All settings, stop-words, and cooldown timings persist across browser sessions using `chrome.storage.sync`.
- **🔒 Privacy-First & Local:** Zero telemetry, zero external trackers, and no remote code dependencies. 100% client-side execution directly within the browser tab.

---

## 🛠️ Supported Form Elements & Algorithms

FormPilot goes beyond basic script auto-clickers by handling complex, dynamic survey layouts and custom interactive widgets:

| Form Control | Emulation & Handling Strategy |
| :--- | :--- |
| **Text Fields & Textareas** | Injects diverse, grammatically natural sentences with human-like punctuation and length variations. Avoids security-sensitive fields (passwords, tokens, OTPs). |
| **Synthetic Contact Data** | Automatically detects email and phone input contexts, generating valid synthetic placeholders (`userXXXX@example.com`, `555XXXXXXX`). |
| **Radio Button Groups** | Intelligently clusters radio inputs by name/ID, excluding undesirable options (*"None of the above"*, *"N/A"*, *"Prefer not to answer"*), and selects with natural distribution. |
| **Checkboxes** | Applies probabilistic selection (~55% check rate) while filtering out conflicting options and negative statements. |
| **Dropdown Menus (`<select>`)** | Filters out placeholder prompts (*"Select..."*, *"Choose..."*), ignores language selectors, and randomly picks genuine selectable values. |
| **Numeric & Range Inputs** | Parses input boundaries (`min`, `max`, `step`) and generates randomized numeric values within valid bounds. |
| **Survey Matrix Tables** | Resolves single and multi-choice statement tables (`tr[id^='statementrow_']`, `.matrix`, `.answerMatrix`), triggering inline event handlers, graphical SVGs, and hidden radio bindings. |
| **Interactive Carousels** | Steps through paged question sets (`fieldset.carousel`), clicking sequential answers and monitoring page counters until complete. |
| **Drag & Drop Zones** | Moves draggable cards (`.yui3-dd-draggable`) into valid target zones (`.yui3-dd-drop[istarget='true']`) and synchronizes corresponding hidden radio states. |
| **Custom ARIA Widgets** | Interacts with modern front-end design systems (`role="radio"`, `role="option"`, custom list items, and styled label wrappers). |

---

## 🧠 Smart Safety & Anti-Trap Detection

To prevent survey disqualifications, FormPilot inspects both DOM nodes and textual content prior to execution:

### 1. Verification & Honeypot Selectors
The extension actively detects hidden traps and verification containers:
```javascript
'[id*="trap" i], [name*="trap" i], [id*="attention" i], [name*="attention" i], [id*="verify" i], [name*="verify" i], [id*="captcha" i], [class*="captcha" i], img[src*="trap" i], img[src*="captcha" i]'
```

### 2. Intelligent Stop-Word Engine
Pre-loaded with common survey attention checks and verification phrases:
- `"verification"`, `"verify"`, `"captcha"`, `"recaptcha"`
- `"attention check"`, `"security check"`, `"are you a human"`
- `"enter the code"`, `"type the"`, `"select exactly"`
- `"basic math"`, `"trap question"`, `"what is"`, `"how many"`

If any stop word or trap element is detected, the loop immediately pauses, highlights the status banner, and hands control back to the user.

---

## 📂 Repository Structure

```
autoclick/
├── manifest.json       # Manifest V3 configuration & permission declarations
├── background.js       # Background service worker configuring side panel behavior
├── sidepanel.html      # Modern UI layout with embedded CSS & typography
├── sidepanel.js        # Core state machine, settings management & injected DOM scanner
└── README.md           # Project documentation and developer guide
```

---

## 🚀 Installation & Setup

FormPilot is lightweight with zero build steps or npm installations required.

### 1. Clone or Download Repository
```bash
git clone https://github.com/imranbru99/autoclick.git
# or download and extract the ZIP file
```

### 2. Load into Chrome / Chromium Browser
1. Open Google Chrome, Brave, or Microsoft Edge.
2. Navigate to `chrome://extensions/` (or `edge://extensions/`).
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the project directory (`autoclick`).

### 3. Open FormPilot
1. Click the puzzle icon (Extensions) in your browser toolbar and pin **FormPilot**.
2. Click the **FormPilot** action icon — the extension opens directly in the right-side Chrome Side Panel.

---

## 📖 How to Use

1. **Single-Page Quick Fill:**
   - Navigate to any web form or survey page.
   - Click **"Fill this page"**.
   - FormPilot populates all matching fields instantly.
2. **Automated Multi-Page Loop:**
   - Click **"Start loop"**.
   - FormPilot scans and fills the page, locates the Next/Submit button, clicks it, waits for the configured cooldown period, and repeats on the next step.
   - Click **"Stop"** at any time to halt execution.
3. **Customize Settings:**
   - Click **"Show"** next to Settings in the side panel.
   - **Wait after Next:** Adjust the transition delay (default: `4.5 seconds`) to allow slower pages to load.
   - **Stop Words:** Add custom keywords or click `×` on existing chips to remove them.
   - Click **"Reset to defaults"** to restore factory presets.

---

## 🔒 Permissions & Security

| Permission | Justification |
| :--- | :--- |
| `sidePanel` | Provides a persistent, non-intrusive side-by-side UI layout while browsing. |
| `storage` | Synchronizes user preferences, cooldowns, and custom stop-words via `chrome.storage.sync`. |
| `scripting` | Executes page scanning and input simulation inside the active tab. |
| `tabs` | Identifies the currently active tab URL and state for injection. |
| `<all_urls>` | Enables universal form-filling across any target web domain or survey provider. |

FormPilot does not transmit any user data, credentials, or cookies. All actions are executed locally in the browser runtime.

---

## 🤝 Let's Connect & Collaborate

I am open to **Senior Remote Full-Stack Roles**, **AI Platform Architecture Contracts**, and **Enterprise Technical Advisory**.

- **Timezone:** UTC+6 (Dhaka / Rangpur, Bangladesh) — Flexible overlap with US, UK, and European business hours.
- **Delivery Mode:** Async-ready, Slack, Discord, Jira, GitHub, and production-first accountability.

| Channel | Address / Handle | Quick Action |
| :--- | :--- | :--- |
| 🌐 **Primary Portfolio** | [imrandev.bd](https://imrandev.bd/) | [Visit Site ↗](https://imrandev.bd/) |
| 📦 **Packagist Packages** | [packagist.org/packages/imrandevbd/](https://packagist.org/packages/imrandevbd/) | [View Packages ↗](https://packagist.org/packages/imrandevbd/) |
| 💼 **LinkedIn Profile** | [linkedin.com/in/imranbru99](https://linkedin.com/in/imranbru99) | [Connect ↗](https://linkedin.com/in/imranbru99) |
| 🐙 **GitHub Profile** | [github.com/imranbru99](https://github.com/imranbru99) | [Follow ↗](https://github.com/imranbru99) |
| 💬 **WhatsApp Direct** | [+880 1576-918420](http://wa.me/+8801576918420) | [Chat Now ↗](http://wa.me/+8801576918420) |
| 📧 **Direct Email** | [me@imrandev.bd](mailto:me@imrandev.bd) | [Send Email ↗](mailto:me@imrandev.bd) |
| 🐦 **X (Twitter)** | [@imrandev_bd](https://x.com/imrandev_bd) | [Follow ↗](https://x.com/imrandev_bd) |
| 📺 **YouTube Tech** | [@ImranDevBD](https://youtube.com/@ImranDevBD) | [Subscribe ↗](https://youtube.com/@ImranDevBD) |
