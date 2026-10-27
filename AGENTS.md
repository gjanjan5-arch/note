# TINDA AGENTS & SYSTEM RULES
Refers to AI_Studio_Inspector_Prompt.txt as primary rules.

## AI Studio Inspector (Focus Mode) Strict Execution Rules
Whenever the user uses the AI Studio Inspector (`[AIS_METADATA_SECTION_START]` / Focus Mode):
1. **Target Precision**: Any modifications MUST target only the specific elements indicated by the CSS selectors and their direct component containers. Do NOT make unrequested changes to unrelated screens.
2. **Context & Hierarchy Analysis**:
   - Trace the selector back to its source component.
   - Audit the visual hierarchy, padding math, contrast ratios, and text-wrapping responsiveness across all viewport sizes (mobile, tablet, desktop).
3. **No Unsolicited Pre-Edits**:
   - If the user specifies *"don't change anything yet"* or asks to inspect/redesign, provide a structured visual & architectural diagnosis first and wait for approval before editing.

## Operating Mode Architecture: Eco Mode vs. Full Mode
Whenever designing, restructuring, or modifying components (especially AI tools, modals, and camera/media features):
1. **Always Check and Respect `usePerformance()`**:
   - Component connects to `usePerformance()` (`PerformanceMode: AUTO | ECO | FULL`, `isEco: boolean`).
   - Every AI-powered component (`SukiChatbot`, `ScannerModal`, etc.) MUST dynamically adapt its performance profile according to whether Eco or Full mode is active.
2. **Eco Mode (Battery & Data Saver / Low-Spec Devices)**:
   - Prioritize lightweight, cost-effective models (`gemini-3.1-flash-lite`).
   - Restrict heavy animations and backdrop blurs (`animationLevel: 'fade-only' | 'none'`).
   - Display clear Eco status indicators.
3. **Full Mode (High Performance / Store Workstation)**:
   - Enable full advisory models (`gemini-3.7-flash` / `gemini-3.1-pro-preview`).
   - Enable smooth transitions, rich animations, and maximum fidelity (`animationLevel: 'full'`).
4. **Auto Mode (Algorithmic Hardware Adaptation)**:
   - Dynamic device capability algorithm:
     - If the device can render it (mid/high tier RAM/CPU): use the lightest animations only (`animationLevel: 'fade-only'` - simple opacity fade, no continuous bounce/pulse).
     - If low-tier device (< 3GB RAM, <= 4 cores, or low battery): suppress animations completely (`animationLevel: 'none'`).
5. **Graphical & Animation Control Rules**:
   - Always check `animationLevel`, `canAnimate`, and `isFadeOnly` from `usePerformance()`.
   - In Eco Mode or Auto (Fade-Only), strictly use pure CSS opacity transitions. Do not add bouncing, looping keyframes, or heavy GPU blurs.
   - In Full Mode, full graphical fidelity and animations are permitted.
6. **Adaptability & Direct Control**:
   - Provide fast, accessible toggles or mode badges so users can switch between Eco and Full Mode seamlessly on the fly.
