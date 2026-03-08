"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Header() {
    return (
        <header className="flex justify-between items-center p-4 border-b border-gray-800 bg-black">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
                DeepFake<span className="text-white">Market</span>
            </h1>
            <ConnectButton />
        </header>
    );
}
