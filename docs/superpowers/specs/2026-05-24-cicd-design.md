# CI/CD Design: sop_to_skill

**Date**: 2026-05-24  
**Repo**: a07458666/sop_to_skill  

## Summary

Single GitHub Actions workflow file (`ci-cd.yml`) with two jobs:
1. `lint` — ruff (Python) + html-validate (HTML)
2. `deploy` — GitHub Pages, depends on `lint` passing

Trigger: push to `main`.

## Architecture

```
push to main
     │
     ▼
┌─────────────────┐
│   lint          │
│  ruff check     │
│  html-validate  │
└────────┬────────┘
         │ needs: lint
         ▼
┌─────────────────┐
│   deploy        │
│  GitHub Pages   │
│  index.html     │
└─────────────────┘
```

## Files Changed

- `.github/workflows/ci-cd.yml` — new file

## GitHub Pages URL

`https://a07458666.github.io/sop_to_skill/`

## Manual Step Required

GitHub Repo → Settings → Pages → Source: **GitHub Actions**
