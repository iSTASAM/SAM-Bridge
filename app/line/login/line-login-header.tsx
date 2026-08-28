import type { LineLoginCopy } from "./line-login-copy";

export function LineLoginHeader({ copy }: { copy: LineLoginCopy }) {
  return (
    <header className="line-login-header">
      <p className="line-login-brand">{copy.brand}</p>
      <span className="line-login-line-badge" aria-label={copy.lineBadge}>
        {copy.lineBadge}
      </span>
    </header>
  );
}
