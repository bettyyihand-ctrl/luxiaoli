<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# LuXiaoLi Project Architecture & AI Agent Guidelines

## 📁 Project Structure

This project is a Next.js (App Router) application migrated from a legacy Vanilla JS/HTML/CSS project. It utilizes **React 19**, **Next.js 16**, **Tailwind CSS v4**, and **TypeScript**.

- `app/` - The main Next.js App Router directory.
  - `page.tsx`: The primary interactive client component (`"use client"`). Handles state management, UI rendering, and streaming fetch requests.
  - `layout.tsx`: Root layout configuration including Google Fonts (`next/font/google`).
  - `globals.css`: Contains Tailwind `@theme` mappings for legacy CSS variables and specific custom animations.
- `lib/` - Shared utilities and TypeScript definitions.
  - `config.ts`: Environment variables and API endpoints (Tencent Yuanqi API).
  - `types.ts`: Core TypeScript definitions matching state and payload shapes.
  - `markdown.ts`: Utilities for custom markdown parsing and `<data>` payload extraction.
- `components/` - React components directory (available for future extraction to reduce `page.tsx` complexity).
- `_legacy_static/` - **DO NOT MODIFY**. Contains the original vanilla HTML/JS/CSS files. Use this directory as the source of truth for design patterns, UI mechanics, and class structure replication.

## 🤖 AI Agent Guidelines

When modifying or extending this codebase, adhere to the following rules:

### 1. Styling & Tailwind CSS (v4)
- exclusively use **Tailwind CSS utilities** for layout, spacing, and colors.
- Use the predefined variables mapped in `@theme` within `globals.css` (e.g., `text-[var(--color-accent)]` or `bg-[var(--color-primary)]`).
- Retain the premium look and feel of the application. Maintain glassmorphism (`backdrop-blur`), subtle shadows (`shadow-[var(--shadow-card)]`), and custom layout structures mapped from the legacy design.

### 2. TypeScript & Next.js
- Use **TypeScript** strictly. **Never use `any`**; prefer `unknown` or exact types.
- Ensure all interactive components that rely on React hooks (`useState`, `useEffect`, `useRef`) are marked with `"use client"` at the top.
- Next.js 16 App Router prefers Server Components by default. If creating new sub-components purely for display, keep them as Server Components where possible, though the main Chat UI will be Client-side.

### 3. State Management & Interaction
- `app/page.tsx` is currently monolithic to orchestrate streaming AI API calls and synchronize local UI state. When extending it, try not to break the `chatHistory` iteration.
- Event handlers and `API payload logic` must align with the AI workflow identifiers provided in `lib/config.ts`.
- The model's stream exposes serialized `userContext` inside `<data></data>` tags. Ensure `parseUserContext` in `lib/markdown.ts` smoothly parses and merges it back into the application state map. 

### 4. Code Quality
- Add comprehensive error handling directly in UI blocks when fetching data logic fails.
- Do NOT re-introduce `.js` files or vanilla DOM manipulation. Use React refs (`useRef`) when viewport scrolling is needed.
