# Android Edge-to-Edge Inset Bridge Plan

The objective is to implement a rock-solid, production-grade fix for the navigation overlap issue on Android, ensuring the app UI never overlaps with the system navigation (buttons/gestures).

## Proposed Changes

### 1. Native Android Edge-to-Edge Bridge
- **Action**: Modify `MainActivity.java` to enable full edge-to-edge mode.
- **Why**: This allows the app to draw *behind* the navigation bar while letting us programmatically calculate the exact system bar height to apply as padding.

### 2. Dynamic Inset Injection
- **Action**: Implement an `OnApplyWindowInsetsListener` in `MainActivity.java`.
- **How**: This listener detects the exact height of the system navigation bar (buttons or gesture pill) in real-time and injects this value as a CSS variable (`--safe-area-inset-bottom`) into the webview.

### 3. CSS Layout Enforcement
- **Action**: Update `index.css` to use the injected variable.
- **Structure**: 
    ```css
    .safe-pb-nav {
      /* Dynamic bridge value from Android, fallback to CSS env() if bridge not ready */
      padding-bottom: max(var(--safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px)) !important;
    }
    ```

## Implementation Steps

1.  **Native Java Bridge**:
    - Update `MainActivity.java` to enable `EdgeToEdge.enable(this)`.
    - Register a WindowInsets listener in `onCreate` that calculates bottom insets and updates the webview via `evaluateJavascript`.
2.  **CSS Hardening**:
    - Ensure `index.css` uses the dynamically injected `--safe-area-inset-bottom` for all bottom-fixed elements (`nav`, cart summary, fab).
3.  **Verification**:
    - Test on devices with both 3-button navigation (static height) and gesture bar (dynamic height).

## Feedback Request
- Does this "Native Bridge" approach feel like the permanent "game-changer" solution you need?
