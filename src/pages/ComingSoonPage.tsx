import { Icon } from '../components/Icon';

export function ComingSoonPage({
  title,
  step,
  icon,
  features,
}: {
  title: string;
  step: string;
  icon: string;
  features: string[];
}) {
  return (
    <>
      <h1>{title}</h1>
      <div className="card preview">
        <div className="preview-badge">
          <Icon name={icon} size={36} />
        </div>
        <div>
          <span className="pill brand">Arriving in {step}</span>
          <ul className="feature-list">
            {features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
