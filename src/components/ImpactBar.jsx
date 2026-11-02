// Savings bar in the style of the brand's impact section: "savings" label left, % right.
export default function ImpactBar({ value, label, color }) {
  return (
    <div
      className="impact-bar"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={label}
      aria-label={`Savings ${label}%`}
      style={{ '--fill': `${value}%`, '--bar': color }}
    >
      <div className="impact-bar__fill">
        <span>savings</span>
        <span>{Math.round(value)}%</span>
      </div>
    </div>
  );
}
