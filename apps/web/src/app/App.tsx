import { AppView } from "./layout/AppView";
import { AppProviders } from "./providers/AppProviders";
import "./App.css";

export function App() {
  return (
    <AppProviders>
      <AppView />
    </AppProviders>
  );
}
