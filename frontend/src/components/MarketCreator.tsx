"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseAbi } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";

export function AdminPanel() {
    const [mediaUrl, setMediaUrl] = useState("");
    const [isUploading, setIsUploading] = useState(false);

    const { data: hash, isPending, writeContract } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const { data: resetHash, isPending: isResetting, writeContract: writeReset } = useWriteContract();
    const { isLoading: isResetConfirming } = useWaitForTransactionReceipt({ hash: resetHash });

    const handleCreate = () => {
        if (!mediaUrl) return;
        writeContract({
            address: CONTRACT_ADDRESS,
            abi: parseAbi(CONTRACT_ABI),
            functionName: "createMarket",
            args: [mediaUrl],
        });
    };

    const handleReset = () => {
        if (!confirm("Are you sure you want to clear ALL markets and transactions? This cannot be undone.")) return;
        writeReset({
            address: CONTRACT_ADDRESS,
            abi: parseAbi(CONTRACT_ABI),
            functionName: "resetAll",
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                // Use full URL so the CRE workflow can fetch the file
                const fullUrl = `${window.location.origin}${data.url}`;
                setMediaUrl(fullUrl);
            } else {
                const errorData = await response.json().catch(() => ({}));
                alert("Upload failed: " + (errorData.error || "Unknown error"));
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("Upload failed");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-xl mt-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl rounded-full translate-x-12 -translate-y-12 pointer-events-none"></div>

            <h2 className="text-2xl font-black tracking-widest text-white uppercase mb-6 flex items-center space-x-3">
                <span className="bg-blue-600 text-white w-8 h-8 flex items-center justify-center rounded-lg text-sm mr-2 shadow-[0_0_15px_rgba(37,99,235,0.5)]">⚙</span>
                MARKET CREATOR
            </h2>

            <div className="space-y-4">
                <div>
                    <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">Media URL or Upload</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="https://example.com/video.mp4"
                            value={mediaUrl}
                            onChange={(e) => setMediaUrl(e.target.value)}
                            className="flex-1 bg-black border border-gray-800 focus:border-blue-500 rounded-lg px-4 py-3 text-white transition-colors font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="relative">
                            <input
                                type="file"
                                accept="image/*,video/*"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={isUploading}
                            />
                            <button
                                disabled={isUploading}
                                className="w-full h-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg cursor-pointer whitespace-nowrap"
                            >
                                {isUploading ? "UPLOADING..." : "📂 UPLOAD"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        onClick={handleCreate}
                        disabled={isPending || isConfirming || !mediaUrl}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.6)] cursor-pointer tracking-wider "
                    >
                        {isPending || isConfirming ? "MINING TRANSACTION..." : "INITIALIZE MARKET"}
                    </button>
                </div>

                {isSuccess && (
                    <div className="mt-4 bg-green-900/40 border border-green-500/50 p-4 rounded-lg">
                        <p className="text-green-400 text-sm font-bold text-center">✓ Market created successfully! It will appear on the feed shortly.</p>
                    </div>
                )}

                <div className="mt-6 pt-4 border-t border-gray-800/50">
                    <button
                        onClick={handleReset}
                        disabled={isResetting || isResetConfirming}
                        className="w-full bg-red-950/30 hover:bg-red-900/40 border border-red-800/50 hover:border-red-600/50 text-red-400 font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed tracking-wider text-sm"
                    >
                        {isResetting || isResetConfirming ? "RESETTING..." : "🗑 RESET ALL MARKETS & TRANSACTIONS"}
                    </button>
                </div>
            </div>
        </div>
    );
}
