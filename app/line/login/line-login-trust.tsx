import type { LineLoginCopy } from "./line-login-copy";

export function LineLoginTrust({ copy }: { copy: LineLoginCopy }) {
  return (
    <aside className="line-login-trust" aria-label={copy.connectLabel}>
      <p>{copy.trust1}</p>
      <p>{copy.trust2}</p>
    </aside>
  );
}
