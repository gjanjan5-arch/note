# Floating Navigation Dock Modernization Plan

The objective is to transform the bottom navigation dock into a modern, floating, capsule-shaped, and translucent UI component.

## Proposed Changes

### 1. Modernize Dock Style
- **Floating Effect**: Remove `left-0` and `right-0`. Use `mx-auto` with `max-w-max` or fixed width to make it a smaller "capsule".
- **Floating Position**: Fix the bottom position with a `bottom-safe` offset.
- **Translucent Styling**: Enhance backdrop blur and adjust background opacity for a floating, glassmorphic look.
- **Capsule Shape**: Update `rounded-*` classes to `rounded-full` (capsule).

## Implementation Steps

1.  **Modify `src/App.tsx`**:
    - Update the `nav` element's `className` to:
        - Remove `left-0 right-0`.
        - Add `fixed bottom-safe left-1/2 -translate-x-1/2 rounded-full backdrop-blur-md bg-white/80 dark:bg-black/60 shadow-lg`.
    - Ensure it still handles the `safe-pb-nav` appropriately.

## Feedback Request
- Does this design align with your goal of a modern, floating "capsule" look?
