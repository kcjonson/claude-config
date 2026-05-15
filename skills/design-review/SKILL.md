---
description: Review the UI for visual design quality against universal principles — spacing, hierarchy, color, typography, interaction states, accessibility, forms, and layout responsiveness. Use when the user asks for a design review, UI audit, visual quality check, or shares a screenshot/page for design feedback.
---

# Design Review

Review the UI for visual design quality. Evaluate against these principles and report issues with specific, actionable fixes. Focus on what's visible: layout, spacing, color, typography, interaction states, and accessibility.

---

## A. Spatial Design & Layout

**Proximity** — Related elements must be closer together than unrelated ones. This is how users perceive grouping without explicit borders or backgrounds. If two elements are related, reduce the gap between them. If they're unrelated, increase it.

**Association through spacing** — Enforce a clear spacing hierarchy:
- Gap within a group < gap between groups < gap between sections
- Example: label-to-field gap < field-to-field gap < section-to-section gap
- When everything is equally spaced, nothing feels grouped

**Alignment** — Elements sharing an edge feel related. Maintain consistent alignment axes throughout a view. Break alignment only intentionally to draw attention (e.g., an indented sub-item, a centered call-to-action).

**Visual hierarchy** — The most important element on screen should be instantly identifiable. Hierarchy is established through size, weight, color, contrast, and whitespace, not just one of these. Check: can a user identify the primary action and key content within 2 seconds?

**Figure-ground** — Interactive content must feel distinct from background chrome. Active areas (forms, content, controls) should stand apart from passive areas (sidebars, headers, empty states). If everything feels the same "depth," the UI lacks structure.

**Rhythm & repetition** — Consistent spacing patterns create scannable, predictable layouts. Repeated elements (list items, cards, table rows) should share identical spacing, sizing, and alignment. Break rhythm intentionally for emphasis, never accidentally.

**Content density** — Match density to the product type. Tool and dashboard UIs can be dense. Consumer, marketing, and reading-focused UIs should breathe. If a tool UI feels sparse, users will feel it's wasting their time. If a reading UI feels cramped, users won't read it.

---

## B. Color & Contrast

- Never rely on color alone to convey meaning. Pair with shape, icon, text, or position.
- Text-to-background contrast: minimum 4.5:1 for body text, 3:1 for large text (18px+ or 14px bold)
- Use semantic color naming (primary, danger, success) not raw values. This enables theming and dark mode.
- Limit the palette: 1 primary action color, 1-2 accent colors, a neutral scale for everything else
- Dark/light mode: colors need per-mode tuning, not mechanical inversion. Dark backgrounds need lighter, slightly desaturated foregrounds.
- Status colors must be distinguishable from each other, not just from the background

---

## C. Typography

- Establish clear hierarchy: headings must differ from body through both size AND weight
- Body text line height: 1.4-1.75 for comfortable reading
- Limit line length to 65-75 characters. Longer lines cause tracking errors.
- Use a consistent modular scale for font sizes. Don't introduce arbitrary sizes.
- Limit font families: 1-2 maximum. More families = less cohesion.
- Muted/secondary text should be clearly subordinate but still legible (check contrast)
- Avoid using font size alone for hierarchy. Combine with weight and color.

---

## D. Interaction & Feedback

- Every interactive element must look interactive, visually distinct from static content
- Provide immediate visual feedback on hover, press, and focus
- Show loading indicators for async operations taking longer than ~300ms
- Confirm destructive actions before executing them
- Disabled elements: reduced opacity/contrast, non-interactive cursor, no hover effects
- State transitions: 150-300ms feels responsive. Under 100ms feels instant (good for micro-interactions). Over 500ms feels sluggish.
- Interactive elements should have consistent behavior. If one button has a hover state, all buttons should.

---

## E. Accessibility

- All interactive elements reachable and operable via keyboard (Tab, Enter, Space, Escape, arrow keys as appropriate)
- Visible focus indicators on the currently focused element. Never remove focus outlines without replacement.
- Labels on all form controls (not placeholder-only)
- Screen reader support: semantic structure, announced state changes, descriptive labels
- Touch targets: minimum 44x44 points with adequate spacing between targets to prevent mis-taps
- Respect `prefers-reduced-motion`. Disable or reduce animations for users who request it.
- Color is never the sole indicator of state (see Color section)

---

## F. Forms & Data Entry

- Labels always visible. Never use placeholder text as the only label.
- Error messages positioned near the field with the problem, not only at form top/bottom
- Show validation state clearly: error styling on the field + descriptive message
- Group related fields visually (address fields together, separate from payment fields)
- Provide clear feedback on form submission: loading state → success/error result
- Pre-fill and preserve user input where possible. Don't clear fields on validation failure.

---

## G. Layout Responsiveness

- Layouts adapt to available space without content being clipped or overflowing
- No horizontal scrollbars unless displaying inherently wide content (tables, code)
- Reserve space for dynamic/async content to prevent layout shifts (skeleton screens, fixed-height containers)
- Test at representative sizes for the target platform. Don't assume a single viewport.
- Flexible layouts should have sensible min/max constraints. Don't let content stretch infinitely or collapse to nothing.

---

## Review Process

1. **Scan for hierarchy** — Can you identify the primary content and primary action within 2 seconds?
2. **Check spacing** — Does proximity correctly signal grouping? Is spacing consistent?
3. **Verify contrast** — Is all text legible? Do interactive elements stand out?
4. **Test states** — Hover, focus, disabled, loading, error, empty: are they all handled?
5. **Check accessibility** — Keyboard navigation, focus indicators, labels, color independence
6. **Assess density** — Does the density match the product type and user task?

Report each issue with:
- **What's wrong** (the specific problem)
- **Why it matters** (the principle being violated)
- **How to fix it** (concrete, actionable change)
