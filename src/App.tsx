import { useLumen } from './state/store';
import { WobbleDefs } from './components/Doodles';
import { Welcome } from './screens/Welcome';
import { Hub } from './screens/Hub';
import { GameScreen } from './screens/games/GameScreen';
import { RoundComplete } from './screens/RoundComplete';
import { Closet } from './screens/Closet';
import { Settings } from './screens/Settings';
import { GrownUp } from './screens/GrownUp';

export function App() {
  const { screen, navId } = useLumen();
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <WobbleDefs />
      {(() => {
        switch (screen.name) {
          case 'welcome': return <Welcome />;
          case 'hub': return <Hub />;
          case 'game': return <GameScreen key={navId} game={screen.game} words={screen.words} />;
          case 'complete': return <RoundComplete summary={screen.summary} />;
          case 'closet': return <Closet />;
          case 'settings': return <Settings />;
          case 'grownup': return <GrownUp />;
        }
      })()}
    </>
  );
}
