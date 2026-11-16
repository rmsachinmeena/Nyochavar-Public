---
name: Petals & Poetry
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#574048'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#8b7079'
  outline-variant: '#debec8'
  surface-tint: '#b4136d'
  primary: '#b10e6b'
  on-primary: '#ffffff'
  primary-container: '#d23284'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb0cd'
  secondary: '#765469'
  on-secondary: '#ffffff'
  secondary-container: '#fdd0ea'
  on-secondary-container: '#79576c'
  tertiary: '#605b54'
  on-tertiary: '#ffffff'
  tertiary-container: '#79746c'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9e4'
  primary-fixed-dim: '#ffb0cd'
  on-primary-fixed: '#3e0022'
  on-primary-fixed-variant: '#8c0053'
  secondary-fixed: '#ffd8ed'
  secondary-fixed-dim: '#e5bad3'
  on-secondary-fixed: '#2c1325'
  on-secondary-fixed-variant: '#5c3d51'
  tertiary-fixed: '#e9e1d8'
  tertiary-fixed-dim: '#ccc5bc'
  on-tertiary-fixed: '#1e1b15'
  on-tertiary-fixed-variant: '#4a463f'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 30px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base-unit: 4px
  container-padding-mobile: 20px
  container-padding-desktop: 80px
  stack-gap-sm: 12px
  stack-gap-md: 24px
  stack-gap-lg: 48px
---

## Brand & Style

The brand personality is intimate, celebratory, and deeply empathetic. This design system facilitates the act of giving by blending a **Modern Romantic** aesthetic with high-end editorial clarity. It moves away from the transactional nature of e-commerce toward a "gifting concierge" experience.

The visual style is a hybrid of **Minimalism** and **Tactile Softness**. It utilizes expansive white space to allow product photography to serve as the emotional anchor, supported by a sophisticated palette and delicate transitions. The goal is to evoke a sense of "breathe-easy" luxury—premium but accessible, warm but professional.

Key Brand Pillars:
- **Intimacy:** Using soft colors and graceful typography to mirror the sentiment of a handwritten note.
- **Trust:** Precision in alignment and clear information hierarchy to ensure the user feels their gift is in safe hands.
- **Celebration:** Subtle use of motion and vibrant accents to elevate the user journey from a chore to an occasion.

## Colors

The palette is inspired by the natural gradient of a blooming flower. 

- **Primary Rose (#EC4899):** Reserved for high-intent actions like "Send Now" and key brand markers.
- **Blush & Petal Layering:** Used for surface backgrounds and decorative elements to create a soft, non-intimidating environment.
- **Warm Neutrals:** The use of `#FFF7ED` (Warm Sand) instead of pure grays prevents the UI from feeling "techy" or cold, maintaining the organic feel of artisanal paper.
- **Interactive States:** Use a deeper Rose (#9D174D) for hover and active states to provide clear feedback while maintaining the monochromatic elegance.

## Typography

This design system employs a "Serif-Hero" strategy. **Playfair Display** is the emotional voice, used for storytelling, product names, and section headers. **Inter** provides the functional backbone, ensuring that logistics, pricing, and delivery details are instantly legible.

- **Contrast:** Pair large Serif headlines with smaller Sans-Serif sub-headers to create an editorial layout feel.
- **Letter Spacing:** Use slightly wider tracking for labels (10%) to enhance the premium, airy aesthetic.
- **Hierarchy:** Reserve the largest display sizes for landing pages and emotional hooks; use standard headline sizes for functional views like the checkout or cart.

## Layout & Spacing

The layout philosophy follows a **Fluid Content** model with generous safe areas. 

- **Rhythm:** Use an 8px grid system, but prioritize "optical breathing room." Elements should never feel cramped; if in doubt, increase the margin.
- **Mobile-First:** On mobile devices, use a single-column stack with 20px side margins. Cards should span the full width minus margins to maximize image real estate.
- **Desktop:** Transition to a 12-column grid. Utilize offset layouts (e.g., text occupying columns 2-6 and imagery occupying 7-12) to create a more dynamic, "magazine-style" flow.
- **White Space:** Treat white space as a functional element that separates different gift categories and emotional beats.

## Elevation & Depth

Depth is achieved through **Tonal Layers** and **Ambient Shadows** rather than harsh borders.

- **The "Floating" Card:** Use a very diffused shadow (`y: 8px, blur: 24px, color: rgba(236, 72, 153, 0.08)`) to give cards a weightless, premium feel. The slight pink tint in the shadow anchors the element to the brand palette.
- **Surfaces:** Use `petal-mist` (#FDF2F8) as a secondary background layer to differentiate between the global background and specific content sections.
- **Transitions:** Elements should appear to "lift" slightly on hover by increasing the shadow spread and shifting 2px upward, mimicking the physical act of picking up a gift.

## Shapes

The shape language is defined by extreme softness. There are no sharp corners in this design system.

- **Cards & Containers:** Use a 24px (1.5rem) radius to mimic the organic curves of petals.
- **Interactive Elements:** Buttons utilize a full pill-shape (100px) to maximize the "friendly" and "tappable" appearance.
- **Inputs:** A slightly tighter 12px radius provides enough structure for form alignment while remaining cohesive with the overall softness.

## Components

### Buttons
- **Primary:** Pill-shaped, Primary Rose background, white text. No border.
- **Secondary:** Pill-shaped, Blush Soft background, Primary Rose text.
- **Ghost:** No background, Primary Rose text, underline on hover. Use for low-priority actions like "View More Details."

### Cards
- **Product Card:** 24px rounded corners, ambient pink-tinted shadow. The image should occupy the top 70% of the card with a slight zoom-in effect on hover.
- **Sentiment Card:** A smaller, text-focused card using the `warm-sand` background and `Playfair Display` typography to simulate a physical gift tag.

### Input Fields
- **Styling:** Soft gray border (1px) that turns to Primary Rose on focus. 
- **Personalization:** Include a "Message Preview" component that shows the user's gift note in a "handwritten-style" serif font as they type.

### Chips & Tags
- **Status Tags:** Small, fully rounded chips (e.g., "Hand-Delivered," "Eco-Friendly") using low-saturation versions of the primary colors.

### Icons
- **Style:** 1.5px stroke weight, rounded caps, and joins. Icons should be "Open-path" where possible to feel airy. 
- **Context:** Use icons primarily for functional utility (Cart, Search, Delivery Status) to avoid cluttering the emotional imagery.