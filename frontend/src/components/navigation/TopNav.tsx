import { NavLink } from "react-router-dom";

type TopNavProps = {
  accountHref: string;
  bagCount: number;
  wishlistCount?: number;
  isAdmin?: boolean;
};

export function TopNav({ accountHref, bagCount, wishlistCount = 0, isAdmin }: TopNavProps) {
  return (
    <header className="app-top-nav">
      <nav className="catalog-nav">
        [<NavLink to={accountHref}>account</NavLink> / <NavLink to="/bag">bag ({bagCount})</NavLink> /{" "}
        <NavLink to="/wishlist">wishlist ({wishlistCount})</NavLink> / <NavLink to="/" end>search</NavLink>
        {isAdmin ? <> / <NavLink to="/admin">admin</NavLink></> : null}]
      </nav>
    </header>
  );
}
