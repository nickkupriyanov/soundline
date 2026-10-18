# Consumer templates

Each directory is a manifest for one consumer environment; the application sources
are shared, because the two legs only differ in the React version they pin:

```
react/       the React application (Vite + TypeScript), its `scripts/ssr-check.mjs`
             and `scripts/prerender.mjs`
react-18/    its manifest, pinned to React 18
react-19/    its manifest, pinned to React 19
```

`tools/verify-install.mjs` packs the libraries once, then builds one scratch copy
per leg in `.verify/`, each with its own npm cache, build output and `package.json`
(the template plus the `file:` references to the tarballs that were just packed):

```
.verify/react-18/   tsc --noEmit, vite build, SSR + hydration check, browser hydration
.verify/react-19/   the same
```

The versions are exact rather than ranged, and each copy resolves its own
`package-lock.json`: a consumer's environment is not the workspace's.
