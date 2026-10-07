import { useEffect } from "react";
import { useLocation } from "react-router";
import AppRouter from "./app/router/AppRouter";
import { getRouteTitle } from "./app/router/routes";
import { useAppName } from "./app/instanceAssets";

function App() {
  const { pathname } = useLocation();
  const appName = useAppName();

  useEffect(() => {
    document.title = getRouteTitle(pathname, appName);
  }, [pathname, appName]);

  return <AppRouter />;
}

export default App;
