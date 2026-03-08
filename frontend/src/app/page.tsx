import { AdminPanel } from "@/components/MarketCreator";
import { MarketFeed } from "@/components/MarketFeed";
import { PlayerHistory } from "@/components/PlayerHistory";
import { ResolvedNotifier } from "@/components/ResolvedNotifier";

export default function Home() {
  return (
    <>
      <div className="py-8">
        <div className="max-w-3xl mb-12">
          <h2 className="text-5xl font-black mb-4 leading-tight">
            Can you spot the <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500">deepfake?</span>
          </h2>
          <p className="text-xl text-gray-400 font-light">
            A decentralized prediction market settled by Chainlink CRE and open-source AI models.
          </p>
        </div>

        <AdminPanel />
        <PlayerHistory />
        <MarketFeed />
        <ResolvedNotifier />
      </div>
    </>
  );
}
