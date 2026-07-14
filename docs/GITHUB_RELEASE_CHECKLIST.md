# GitHub Release Checklist

- Create a feature branch.
- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Confirm `/api/health` returns `ready` or understood mock status.
- Confirm browser flows: login, chat, knowledge search, workflow approval, observability, settings.
- Open a pull request with screenshots and the verification output.
- Keep secrets out of source control. Use GitHub Actions secrets and Vercel environment variables.
