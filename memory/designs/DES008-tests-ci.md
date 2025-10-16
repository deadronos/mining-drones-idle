# DES008 — Tests & CI

**Status:** Draft
**Created:** 2025-10-16

## Summary

Consolidate Vitest unit tests and Playwright e2e scenarios, add coverage, and wire GitHub Actions to run lint/test/e2e on PRs.

## Notes

- Ensure deterministic seeds in e2e fixtures; store artifacts (screenshots/videos) on failures.
