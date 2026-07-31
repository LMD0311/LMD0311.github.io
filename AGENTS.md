# AGENTS.md

This file provides guidance to the AI agent when working with code in this repository.

## Overview

Static personal academic homepage (GitHub Pages, no build system, no Jekyll despite theme origins). Everything is hand-edited HTML/CSS/JS — edit `index.html` directly. Pushing to `main` publishes the live site at lmd0311.github.io, so confirm before pushing.

Preview locally with `python3 -m http.server` (needed because favicon/JS use relative paths and iframes).

## Gotchas

- Publications and news are hand-maintained `<li>` blocks in `index.html`. When adding a publication, copy an existing `pub-row` block (teaser image in `assets/img/`, `abbr.badge` venue tag, links row with optional ghbtns star-count iframe) and keep the existing inline-style conventions rather than refactoring them.
- The site uses non-standard custom HTML tags (`<lightonly>`, `<autocolor>`, `<position>`, `<email>`) styled by the CSS — they are intentional, not typos.
- `assets/css/` contains paired dark-mode and `-no-dark-mode` variants; `index.html` links the dark-mode-aware ones (`style.css`, `publications.css`). Edit the linked variant.
- Work only on the personal homepage (`index.html` + `assets/`); leave `projects/` untouched.
- The site was checked and fixed for mobile layout; verify changes at narrow viewport widths.
