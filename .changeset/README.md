# Changesets

Every change to a published package needs a changeset:

```bash
pnpm changeset        # pick the packages and the bump, describe the change
```

Until `1.0.0`, an incompatible change is a `minor` bump with a migration note. See
`docs/specification.md` for the release rules.
