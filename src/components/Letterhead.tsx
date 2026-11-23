import { asset } from '../lib/paths';
export function Letterhead() {
  return <img className="letterhead" src={asset("letterhead.jpg")} alt="Patience Suppliers (Z) Ltd" />;
}
