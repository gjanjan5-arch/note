# Manual Safe Area Offset Implementation Plan

The objective is to provide a fallback setting for users on devices where the OS reports incorrect safe area insets, causing UI overlap.

## Proposed Changes

### 1. Manual Safe Area Offset Setting
- **Settings Update**: Add a new setting (e.g., "Manual Bottom Offset") in the Settings Modal.
- **Persistent Storage**: Save this user-defined offset value in `localStorage` (via `safeStorage`).
- **Dynamic CSS Injection**: Apply this offset to the global CSS variable `--safe-area-inset-bottom` if the setting is active, ensuring it overrides or adds to system-reported values.

## Implementation Steps

1.  **Modify `src/utils/storeSettings.ts`**:
    - Update `StoreProfile` (or create a dedicated `UserSettings` interface) to hold `manualBottomOffset` (default `0`).
2.  **Update `src/components/settings/DataManagementSection.tsx`** (or relevant settings file):
    - Add a UI slider or input field for the user to adjust the offset in pixels (0-100px range).
3.  **Update `src/index.css`**:
    - Update the CSS variable engine to prioritize this user setting:
      ```css
      --safe-bottom: max(var(--user-manual-offset, 0px), var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
      ```
4.  **Update `App.tsx` (App Initialization)**:
    - Apply the stored `manualBottomOffset` to the root element's style variable `--user-manual-offset` on app load.

## Feedback Request
- Does this manual adjustment approach meet your needs for problematic devices?
- What is a reasonable range for the manual offset (e.g., 0 to 100 pixels)?
