# Navigation Improvement Plan (Final)

The objective is to fix the navigation overlap issue for both Buyer and Seller modes and refine the `SideDrawer` navigation.

## Proposed Changes

### 1. Fix: Navigation/System Bar Overlap
- **Issue**: The bottom navigation (Seller) and checkout summary (Buyer) elements overlap with the system gesture bar on modern devices.
- **Solution**:
    - Update CSS in `index.css` to refine the `safe-pb-nav` and ensure it handles `env(safe-area-inset-bottom, 0px)`.
    - Apply the semantic class `safe-pb-nav` to:
        - The bottom navigation `nav` element in `App.tsx` (Seller Mode).
        - The bottom cart summary `div` container in `BuyerMode.tsx` (Buyer Mode).

### 2. Enhanced SideDrawer Layout
- **Quick Actions Section**: Add a new section at the top of the menu containing direct access to frequently used actions:
  - Quick Note
  - Scan (Product/Catalog)
  - Daily Remit / Voice Log
- **Reorganized Menu**: Group existing menu items logically (e.g., Tools, Account/Settings, App Mode).
- **Visual Dividers**: Add subtle separators to clearly delineate these groups.
- **Improved Mode Selector**: Increase the visual prominence of the Seller/Buyer mode switcher.

## Implementation Steps

1.  **Fix Overlap (Both Modes)**:
    - Apply `safe-pb-nav` class to bottom container in `BuyerMode.tsx`.
    - Ensure `App.tsx` navigation dock correctly utilizes `safe-pb-nav`.
2.  **Modify `src/components/SideDrawer.tsx`**:
    - Update menu structure to incorporate `QuickActions` grid.
    - Implement visual separators between sections.
    - Refine App Mode selector styling.
3.  **Update `src/App.tsx`**:
    - Pass necessary handlers to `SideDrawer`.

## Feedback Request
- Everything is set to proceed. I will now start implementing these fixes.
