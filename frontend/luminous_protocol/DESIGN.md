---
name: Luminous Protocol
colors:
  surface: '#121414'
  surface-dim: '#121414'
  surface-bright: '#37393a'
  surface-container-lowest: '#0c0f0f'
  surface-container-low: '#1a1c1c'
  surface-container: '#1e2020'
  surface-container-high: '#282a2b'
  surface-container-highest: '#333535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#bbc9c7'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#2f3131'
  outline: '#869491'
  outline-variant: '#3c4947'
  surface-tint: '#5adace'
  primary: '#6feee1'
  on-primary: '#003733'
  primary-container: '#4fd1c5'
  on-primary-container: '#005750'
  inverse-primary: '#006a63'
  secondary: '#d4bbff'
  on-secondary: '#3e1975'
  secondary-container: '#55338d'
  on-secondary-container: '#c6a5ff'
  tertiary: '#d4dae9'
  on-tertiary: '#2b313c'
  tertiary-container: '#b9becc'
  on-tertiary-container: '#474d59'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#79f7ea'
  primary-fixed-dim: '#5adace'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#ebdcff'
  secondary-fixed-dim: '#d4bbff'
  on-secondary-fixed: '#270058'
  on-secondary-fixed-variant: '#55338d'
  tertiary-fixed: '#dde2f1'
  tertiary-fixed-dim: '#c1c6d5'
  on-tertiary-fixed: '#161c26'
  on-tertiary-fixed-variant: '#414753'
  background: '#121414'
  on-background: '#e2e2e2'
  surface-variant: '#333535'
typography:
  display-lg:
    fontFamily: Source Serif 4
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: 0.05em
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.03em
  headline-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.03em
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
    letterSpacing: 0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0.01em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The design system embodies a "Future-Forward Security" aesthetic, merging the precision of high-fidelity enterprise software with an ethereal, atmospheric layer. It targets a sophisticated audience that values both technical rigor and modern elegance.

The visual style is a refined hybrid of **Minimalism** and **Glassmorphism**. It prioritizes vast, dark space to create a sense of depth, punctuated by translucent surfaces and glowing interactive elements. The interface should feel like a holographic projection—calm, focused, and impeccably organized, yet visually immersive.

## Colors
The palette is rooted in a deep, nocturnal foundation to establish the "Future-Forward" security environment.

- **Base:** The primary background is #050a14 (Deep Space Navy), providing a high-contrast canvas for luminous elements.
- **Accents:** Vibrant Teal (#4fd1c5) is used for primary actions and status indicators. Soft Lavender (#b794f4) provides a sophisticated secondary tone for decorative accents and supplemental data viz.
- **Gradients:** Use subtle linear gradients moving from the primary teal to secondary lavender (at 15% opacity) for glass surfaces.
- **Text:** Primary copy must remain high-contrast white (#ffffff) for maximum legibility against the dark void.

## Typography
The typographic hierarchy balances the traditional authority of Source Serif 4 with the utilitarian precision of Inter.

- **Headings:** Source Serif 4 is used for all headings. Increased letter-spacing is essential to evoke an editorial, premium feel.
- **UI & Body:** Inter handles all functional data, labels, and long-form text. It provides a clean, neutral counterpoint to the more decorative serif.
- **Styling:** Use uppercase styling for `label-sm` to denote categories or metadata tags, reinforcing the "ledger" aspect of the system.

## Layout & Spacing
The layout follows a **Fluid Grid** model with generous margins to preserve the "Ethereal" quality of the brand.

- **Grid:** A 12-column system is used for desktop, collapsing to 4 columns for mobile.
- **Rhythm:** Spacing is strictly based on an 8px scale. Use larger gaps (48px+) between major sections to prevent the UI from feeling cluttered.
- **Responsive:** On mobile, margins reduce to 16px, and glass panels should span the full width to maximize usable space while maintaining backdrop blur effects.

## Elevation & Depth
Depth is communicated through transparency and light rather than shadow.

- **Glassmorphism:** Surfaces utilize a backdrop blur (20px to 40px) with a semi-transparent background color (`rgba(255, 255, 255, 0.03)`).
- **Luminous Borders:** Instead of shadows, define objects with a 1px solid border. Use a low-opacity white or a faint teal glow (`rgba(79, 209, 197, 0.2)`).
- **Outer Glows:** Interactive states (hover/active) should trigger a soft outer glow (`box-shadow: 0 0 15px rgba(79, 209, 197, 0.3)`) rather than a traditional drop shadow.
- **Layering:** High-priority modals should have a more intense blur and a slightly brighter border than background cards.

## Shapes
The shape language is consistently rounded to soften the technical nature of the security focus.

- **Standard Elements:** Buttons and input fields use a 0.5rem (8px) radius.
- **Containers:** Cards and large panels use `rounded-lg` (16px) or `rounded-xl` (24px) to create a friendly, approachable container for complex data.
- **Accents:** Small indicators like notification pips or status dots remain perfectly circular.

## Components

- **Buttons:** Primary buttons feature a solid Teal fill with white text. Secondary buttons use a glass background with a luminous Teal border. All buttons transition with a soft glow on hover.
- **Input Fields:** Fields are ghost-styled with a 1px `rgba(255, 255, 255, 0.1)` border. Upon focus, the border brightens to Teal with a subtle inner glow.
- **Cards:** The hallmark of the design system. Cards must have a backdrop-filter (blur) and a very thin, semi-transparent border. Titles within cards use the Source Serif 4 headline styles.
- **Chips/Badges:** Small, pill-shaped elements with low-opacity Teal or Lavender backgrounds. Text is always Inter `label-sm`.
- **Lists:** Items are separated by thin, luminous dividers (`1px solid rgba(255, 255, 255, 0.05)`).
- **Progress Indicators:** Use thin, glowing lines. The "Future-Forward" vibe is reinforced by animating the glow gradient along the path of the progress bar.
