# Floating Capsule Navigation Dock Plan

The objective is to transform the bottom navigation dock into a modern, floating, capsule-shaped, and translucent UI component, inspired by the requested "Ask Gemini" style interface.

## Proposed Changes

### 1. Modernize Dock Style
- **Capsule Geometry**: Transform the container from a full-width dock to a smaller, centered, capsule-shaped element.
- **Floating Effect**: Position it above the bottom safe area using fixed positioning (`fixed bottom-safe left-1/2 -translate-x-1/2`).
- **Glassmorphism**: Apply backdrop blur (`backdrop-blur-md`) and a semi-transparent background (`bg-white/70` / `bg-black/60`) for a modern, immersive look.

## Implementation Steps

1.  **Modify `src/App.tsx`**:
    - Update the `nav` element's `className`:
        - Remove full-width properties (`bottom-0 left-0 right-0`).
        - Add floating capsule properties: `fixed bottom-safe left-1/2 -translate-x-1/2 w-max max-w-[90vw] rounded-full backdrop-blur-md border theme-border shadow-lg`.
    - Ensure the internal grid layout fits within the new, tighter constraints.
2.  **Adjust Layout**:
    - Validate that the new position correctly sits above the system gesture bar on both Android and in standalone mode.

## Feedback Request
- Does this floating capsule approach match the design you have in mind?
- Is there any specific spacing (how high it floats) you would like me to adjust after the first implementation?
