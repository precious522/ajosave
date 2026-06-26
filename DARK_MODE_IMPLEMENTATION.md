# Dark Mode Implementation — Issue #54

## Status: ✅ Complete

Dark mode support has been fully implemented in Ajosave with all acceptance criteria met.

---

## Implementation Details

### 1. CSS Custom Properties (tokens.css)

The design system defines separate color tokens for light and dark themes:

**Light Theme Variables:**
- `--color-bg-light`: #ffffff
- `--color-bg-surface-light`: #f8fafc
- `--color-text-primary-light`: #0f172a
- `--color-text-secondary-light`: #475569
- `--color-border-light`: #e2e8f0

**Dark Theme Variables:**
- `--color-bg-dark`: #080f0b
- `--color-bg-surface-dark`: #0e1a12
- `--color-text-primary-dark`: #eef5f0
- `--color-text-secondary-dark`: #8aab94
- `--color-border-dark`: #1e3028

**Active Theme Variables (defaults to light):**
- `--color-bg`, `--color-bg-surface`, `--color-text-primary`, etc.

### 2. Media Query Support

`src/styles/tokens.css` includes a `@media (prefers-color-scheme: dark)` query that automatically switches to dark theme colors when the user's system preference is set to dark mode.

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: var(--color-bg-dark);
    --color-text-primary: var(--color-text-primary-dark);
    /* ... other dark theme variables ... */
  }
}
```

### 3. Manual Theme Toggle

**Component:** `src/components/ui/ThemeToggle.tsx`

The `ThemeToggle` component provides a manual toggle button in the navbar that allows users to override system preferences:

- Displays 🌙 in light mode, ☀️ in dark mode
- Located in the navbar (`src/components/layout/Navbar.tsx`)
- Accessible with proper ARIA labels

### 4. localStorage Persistence

Theme preference is persisted in localStorage with the key `"theme"`:

```typescript
// On mount: read stored preference or fall back to system preference
const stored = localStorage.getItem("theme") as "light" | "dark" | null;
const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
const initial = stored || system;

// On toggle: save new preference
localStorage.setItem("theme", newTheme);
```

### 5. DOM Integration

The theme is applied via the `data-theme` attribute on the `<html>` element:

```typescript
document.documentElement.setAttribute("data-theme", theme);
```

CSS selectors in `tokens.css` respond to this attribute:

```css
[data-theme="dark"] {
  --color-bg: var(--color-bg-dark);
  /* ... */
}

[data-theme="light"] {
  --color-bg: var(--color-bg-light);
  /* ... */
}
```

---

## How It Works

1. **On Page Load:**
   - ThemeToggle component checks localStorage for saved preference
   - Falls back to system preference via `prefers-color-scheme` media query
   - Sets `data-theme` attribute on `<html>` element
   - CSS custom properties update automatically

2. **On Toggle Click:**
   - User clicks theme toggle button
   - New theme is saved to localStorage
   - `data-theme` attribute is updated
   - All CSS variables switch to new theme colors

3. **System Preference Change:**
   - If no localStorage preference exists, system preference is respected
   - User can override by clicking the toggle button

---

## Files Modified/Created

- ✅ `src/styles/tokens.css` — Dark theme color variables + media query + data-theme selectors
- ✅ `src/components/ui/ThemeToggle.tsx` — Theme toggle component with localStorage persistence
- ✅ `src/components/ui/ThemeToggle.module.css` — Toggle button styling
- ✅ `src/components/layout/Navbar.tsx` — Integrated ThemeToggle component

---

## Acceptance Criteria Met

- ✅ CSS custom properties defined for dark theme
- ✅ `prefers-color-scheme: dark` media query applied
- ✅ Manual toggle in navbar (ThemeToggle component)
- ✅ Preference persisted in localStorage

---

## Testing

To test dark mode:

1. **System Preference:**
   - Set your OS to dark mode
   - Visit the app — it should automatically use dark theme

2. **Manual Toggle:**
   - Click the theme toggle button (🌙/☀️) in the navbar
   - Theme should switch immediately
   - Refresh the page — preference should persist

3. **localStorage:**
   - Open DevTools → Application → localStorage
   - Look for key `"theme"` with value `"light"` or `"dark"`

---

## Color Palette

The dark theme uses a nature-inspired palette that complements the brand:

| Element | Light | Dark |
|---------|-------|------|
| Background | #ffffff | #080f0b |
| Surface | #f8fafc | #0e1a12 |
| Text Primary | #0f172a | #eef5f0 |
| Text Secondary | #475569 | #8aab94 |
| Border | #e2e8f0 | #1e3028 |
| Brand Primary | #0f7a4a | #0f7a4a (unchanged) |

---

## Browser Support

Dark mode is supported in all modern browsers:
- Chrome/Edge 76+
- Firefox 67+
- Safari 12.1+
- Mobile browsers (iOS Safari 13+, Chrome Android)

The `prefers-color-scheme` media query is widely supported, and the manual toggle provides a fallback for older browsers.
