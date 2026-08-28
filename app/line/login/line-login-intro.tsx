import { FiLink2 } from "react-icons/fi";
import type { LineLoginCopy } from "./line-login-copy";

export function LineLoginIntro({ copy }: { copy: LineLoginCopy }) {
  return (
    <section className="line-login-intro" aria-labelledby="line-login-title">
      <div className="line-login-connect" aria-hidden>
        <span className="line-login-connect-node">{copy.bridgeLabel}</span>
        <span className="line-login-connect-link">
          <FiLink2 size={16} />
        </span>
        <span className="line-login-connect-node is-line">{copy.lineBadge}</span>
      </div>

      <h1 id="line-login-title" className="line-login-title">
        {copy.title}
      </h1>
      <p className="line-login-lead">{copy.lead}</p>
    </section>
  );
}
