export default function LostTimeLoading() {
  return <div className="dx-page dx-lost-page" aria-busy="true">
    <span className="skeleton" style={{ width: 180, height: 18 }} />
    <span className="skeleton" style={{ width: 280, height: 34, marginTop: 22 }} />
    <div className="dx-lost-skeleton" style={{ marginTop: 32 }}>
      {Array.from({ length: 8 }, (_, index) => <span className="skeleton" key={index} />)}
    </div>
  </div>;
}
