export function ComingSoonPage({ title, step }: { title: string; step: string }) {
  return (
    <>
      <h1>{title}</h1>
      <div className="card">
        <p>This section is being built in {step} of the plan.</p>
      </div>
    </>
  );
}
