# DeltaWatch Feature Implementation Plan

## Overview
This document outlines the implementation plan for 4 new features:
1. **Dashboard Widgets** - Customizable dashboard layout with widgets
2. **Target Price Alert** - Alert when price drops below target
3. **Back-in-Stock Alert** - Detect "Sold Out" → "In Stock" transitions
4. **Digest E-mail** - Daily/weekly summary of all changes

---

## 1. Target Price Alert

### Current State
- Already has `price_threshold_min` and `price_threshold_max` in the database
- Threshold alerts work but only for fixed min/max values

### Changes Needed

#### Database (db.ts)
- Add column: `price_target` (REAL) - The specific target price user wants to reach
- Add column: `price_target_notified` (INTEGER DEFAULT 0) - Prevent repeat notifications

#### Backend (scheduler.ts)
- After price detection, check if `detected_price <= price_target`
- If true AND `price_target_notified = 0`:
  - Send notification: "🎯 Target Price Reached! {product} is now {price} (target was {target})"
  - Set `price_target_notified = 1`
- If price goes back above target, reset `price_target_notified = 0`

#### Frontend (Editor.tsx)
- Add "Target Price" input field in the Price Detection section
- Below the min/max thresholds, add:
  - Input: "Alert me when price drops to or below €___"
  - Toggle: "One-time alert" vs "Alert every time"

#### UI/UX
- Show target price as a badge on dashboard if set
- Show progress bar: "Current: €1749 | Target: €1500 (83% there)"

---

## 2. Back-in-Stock Alert

### Concept
Automatically detect when text like "Out of Stock", "Sold Out", "Uitverkocht" changes to "In Stock", "Available", "Add to Cart".

### Changes Needed

#### Database (db.ts)
- Add column: `stock_alert_enabled` (INTEGER DEFAULT 0)
- Add column: `last_stock_status` ('in_stock' | 'out_of_stock' | 'unknown')

#### Backend (scheduler.ts)
- List of stock patterns:
  ```typescript
  const OUT_OF_STOCK = ['out of stock', 'sold out', 'uitverkocht', 'niet beschikbaar', 'unavailable', 'not available'];
  const IN_STOCK = ['in stock', 'add to cart', 'buy now', 'in winkelwagen', 'beschikbaar', 'available'];
  ```
- After text extraction, scan for these patterns
- If transition from OUT → IN:
  - Send notification: "🎉 Back in Stock! {product} is now available!"
- Update `last_stock_status`

#### Frontend (Editor.tsx)
- Add toggle: "Stock Alert" (enabled/disabled)
- Show current detected status: "Currently: In Stock ✓" or "Currently: Out of Stock ✗"

#### Dashboard
- Show stock status badge on monitor card (green "IN STOCK" / red "SOLD OUT")

---

## 3. Digest E-mail

### Concept
Send a scheduled summary email with all changes from the past day/week.

### Changes Needed

#### Database (db.ts)
- Add to settings table:
  - `digest_enabled` (INTEGER DEFAULT 0)
  - `digest_frequency` ('daily' | 'weekly' | 'off')
  - `digest_time` (TEXT, e.g., '09:00')
  - `digest_last_sent` (TEXT, ISO timestamp)

#### Backend - New file: digestScheduler.ts
```typescript
// Runs on a cron schedule (e.g., every hour)
// Checks if it's time to send digest based on digest_time and digest_frequency
// Collects all changes since last digest
// Generates HTML email with:
//   - Summary stats (X monitors, Y changes, Z errors)
//   - List of all changes with timestamps
//   - Price changes with graphs?
//   - Direct links to each monitor
```

#### Backend (notifications.ts)
- Add new function: `sendDigestEmail(changes: ChangeItem[], stats: DigestStats)`
- Beautiful HTML template with:
  - Header with DeltaWatch logo
  - Stats cards
  - Change list grouped by monitor
  - "View in Dashboard" buttons

#### Frontend (Settings.tsx)
- New section: "Email Digest"
  - Toggle: Enable digest emails
  - Dropdown: Frequency (Daily / Weekly / Off)
  - Time picker: "Send at" (09:00, 18:00, etc.)
  
---

## 4. Dashboard Widgets

### Concept
Allow users to customize their dashboard with draggable widgets:
- Stats Overview (current)
- Recent Changes
- Price Trackers (sparklines)
- Error Summary
- Quick Actions

### Changes Needed

#### Database (db.ts)
- Add to users table or new table:
  - `dashboard_layout` (TEXT) - JSON blob with widget positions
  
```typescript
interface DashboardLayout {
  widgets: {
    id: string;
    type: 'stats' | 'recent_changes' | 'price_trackers' | 'errors' | 'quick_actions';
    position: { x: number; y: number; w: number; h: number };
    visible: boolean;
  }[];
}
```

#### Frontend - New components
1. `DashboardWidget.tsx` - Base widget component with header, collapse, remove
2. `WidgetStatsOverview.tsx` - Current stats (refactored)
3. `WidgetRecentChanges.tsx` - Last 5-10 changes across all monitors
4. `WidgetPriceTrackers.tsx` - Grid of sparklines for price monitors
5. `WidgetErrors.tsx` - List of monitors with errors
6. `WidgetQuickActions.tsx` - Quick buttons (New Monitor, Run All Checks, etc.)

#### Grid Library
- Use `react-grid-layout` for drag & drop grid
- Responsive: desktop (3 columns), tablet (2), mobile (1)

#### Dashboard.tsx Changes
- Add "Customize" button to toggle edit mode
- In edit mode:
  - Widgets become draggable/resizable
  - "Add Widget" panel slides in
  - Save button persists layout
- Default layout for new users

---

## Implementation Order

### Phase 1: Target Price Alert (Simplest, builds on existing)
1. Add database column
2. Update scheduler logic
3. Add UI in Editor
4. Add badge in Dashboard

### Phase 2: Back-in-Stock Alert (Similar pattern)
1. Add database columns
2. Add stock pattern detection
3. Add toggle in Editor
4. Add status badge

### Phase 3: Digest Email (Backend-heavy)
1. Create digest scheduler
2. Create email template
3. Add settings UI
4. Test with cron

### Phase 4: Dashboard Widgets (Most complex)
1. Install react-grid-layout
2. Create widget components
3. Add layout persistence
4. Build customization UI

---

## Time Estimates
- Target Price Alert: 2-3 hours
- Back-in-Stock Alert: 3-4 hours  
- Digest Email: 4-5 hours
- Dashboard Widgets: 6-8 hours

**Total: ~16-20 hours of development**

---

## Next Steps
Ready to start with **Target Price Alert**? It's the fastest win!
