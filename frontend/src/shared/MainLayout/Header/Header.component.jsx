import { NavLink } from "react-router";
import NavBar from "./NavBar/NavBar.component";
import { useAppName, useInstanceAssets } from "../../../app/instanceAssets";
import ColorModeToggle from "../../ColorModeToggle/ColorModeToggle.component";

function Header(props) {
  const { logo } = useInstanceAssets();
  const appName = useAppName();
  return (
    <header className="relative z-50 flex items-center justify-between border-b border-neutral-200 bg-surface-raised px-4 py-3 sm:px-6 lg:px-8">
      <NavLink
        to="/"
        aria-label={`${appName} home`}
        className="flex min-h-10 items-center font-heading text-xl font-bold"
      >
        {logo ? (
          <img
            src={logo}
            alt={appName}
            className="w-28 object-contain sm:w-32 lg:w-36 dark:hue-rotate-180 dark:invert"
          />
        ) : (
          appName
        )}
      </NavLink>
      <div className="flex items-center gap-2">
        <ColorModeToggle placement="header" />
        <NavBar {...props} />
      </div>
    </header>
  );
}

export default Header;
