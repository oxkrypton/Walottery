import { ConnectButton } from "@mysten/dapp-kit";

function App() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b bg-background/80 backdrop-blur">
                <div className="container flex h-16 items-center justify-between">
                    <p className="text-lg font-semibold">Walottery</p>
                    <ConnectButton />
                </div>
            </header>
            <main className="container flex flex-col items-center justify-center gap-6 py-24 text-center">
                <h1 className="text-3xl font-semibold">Frontend scaffold</h1>
                <p className="max-w-xl text-muted-foreground">
                    All previous UI components have been removed. Start building your experience here when you are ready to hook
                    into the Move contracts and wallet interactions.
                </p>
                <div className="rounded-lg border px-6 py-4 text-sm text-muted-foreground">
                    Add sections, routes, or components as needed. This placeholder keeps the provider stack intact so hooks from
                    @mysten/dapp-kit will continue to work once you re-introduce them.
                </div>
            </main>
        </div>
    );
}

export default App;
