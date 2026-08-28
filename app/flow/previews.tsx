import type { OutputPreview, ProcessedPreview, RawPreview } from "./demo-data";

export function RawDataPreview({ data }: { data: RawPreview }) {
  if (data.kind === "ixacs") {
    return (
      <article className="flow-preview is-raw is-ixacs">
        <header>
          <span>{data.kicker}</span>
          <em>LIVE</em>
        </header>
        <p className="flow-preview-status">{data.status}</p>
        <strong>{data.product}</strong>
        <dl>
          {data.rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </article>
    );
  }

  if (data.kind === "csv") {
    return (
      <article className="flow-preview is-raw is-csv">
        <header>
          <span>{data.kicker}</span>
        </header>
        <strong>{data.file}</strong>
        <table>
          <thead>
            <tr>
              {data.headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.join("-")}>
                {row.map((cell) => (
                  <td key={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    );
  }

  if (data.kind === "mqtt") {
    return (
      <article className="flow-preview is-raw is-mqtt">
        <header>
          <span>{data.kicker}</span>
        </header>
        <p className="flow-preview-topic">{data.topic}</p>
        <dl>
          {data.rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </article>
    );
  }

  if (data.kind === "db") {
    return (
      <article className="flow-preview is-raw is-db">
        <header>
          <span>{data.kicker}</span>
        </header>
        <strong>{data.table}</strong>
        <dl>
          {data.rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </article>
    );
  }

  return (
    <article className="flow-preview is-raw is-webhook">
      <header>
        <span>{data.kicker}</span>
      </header>
      <strong>{data.title}</strong>
      <p className="flow-preview-status">{data.status}</p>
      <dl>
        {data.rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export function ProcessedDataPreview({ data }: { data: ProcessedPreview }) {
  return (
    <article className="flow-preview is-processed">
      <header>
        <span>{data.kicker}</span>
      </header>
      <strong>{data.title}</strong>
      <p className="flow-preview-status is-ready">{data.status}</p>
      <dl>
        {data.rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="flow-preview-insight">{data.insight}</p>
    </article>
  );
}

export function OutputDataPreview({ data }: { data: OutputPreview }) {
  if (data.kind === "kpi") {
    return (
      <article className="flow-preview is-output is-kpi">
        <header>
          <span>{data.title}</span>
        </header>
        <strong>{data.line}</strong>
        <dl>
          {data.rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </article>
    );
  }

  if (data.kind === "record") {
    return (
      <article className="flow-preview is-output is-record">
        <header>
          <span>{data.title}</span>
        </header>
        <dl>
          {data.rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </article>
    );
  }

  return (
    <article className="flow-preview is-output is-message">
      <header>
        <span>{data.title}</span>
      </header>
      {data.body.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </article>
  );
}
