"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";

// --- Type definitions are unchanged ---
type OnChainRecord = {
  version: number;
  hashKtp: string;
  hashKyc: string;
  status: string;
  timestamp: number;
  issuer: string;
  revoked: boolean;
};
interface KycHistoryData {
  totalBill: number;
  versions: OnChainRecord[];
  participatingBanks: string[];
}
interface KycHistoryProps {
  clientId: number;
  onClose: () => void;
}

export default function KycHistory({ clientId, onClose }: KycHistoryProps) {
  const [historyData, setHistoryData] = useState<KycHistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // --- Data fetching logic is unchanged ---
  useEffect(() => {
    if (!clientId || clientId <= 0) {
      setLoading(false);
      setError("Invalid Client ID provided.");
      return;
    }
    setLoading(true);
    async function fetchOnChainHistory() {
      try {
        const currentBankApiPort = 4000;
        const resp = await fetch(
          `http://localhost:${currentBankApiPort}/kyc-requests/${clientId}/onchain-history`
        );
        if (!resp.ok) {
          const errJson = await resp
            .json()
            .catch(() => ({ detail: resp.statusText }));
          throw new Error(errJson.detail || `HTTP ${resp.status}`);
        }
        const data: KycHistoryData = await resp.json();
        setHistoryData(data);
        setError(null);
      } catch (e: any) {
        console.error("Error fetching on-chain history:", e);
        setHistoryData(null);
        setError(e.message || "Unknown error fetching history.");
      } finally {
        setLoading(false);
      }
    }
    fetchOnChainHistory();
  }, [clientId]);

  // ==================================================================
  // ✅ SOLUTION: Add Guard Clauses for Loading, Error, and No Data states
  // ==================================================================

  if (loading) {
    // Render a skeleton loader while fetching data
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-stone-200 rounded w-3/4 mb-6"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-stone-200 p-4 rounded-lg h-20"></div>
          <div className="bg-stone-200 p-4 rounded-lg h-20"></div>
          <div className="bg-stone-200 p-4 rounded-lg h-20"></div>
        </div>
        <div className="h-6 bg-stone-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-4">
          <div className="h-24 bg-stone-200 rounded-lg"></div>
          <div className="h-24 bg-stone-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    // Render a dedicated error message
    return (
      <div
        className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md shadow-md"
        role="alert"
      >
        <h3 className="font-bold">Error Loading History</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!historyData) {
    // Render this after loading is false and there's no error, but data is still null
    return (
      <p className="text-stone-500">
        No history data available for this client.
      </p>
    );
  }

  // --- Calculation logic is now safe because `historyData` is guaranteed to exist ---
  let effectiveSharePerBankFormatted = "N/A";
  if (historyData.participatingBanks?.length > 0) {
    console.log("total bill", historyData.totalBill);
    console.log("participating banks", historyData.participatingBanks.length);
    const shareInWei =
      BigInt(historyData.totalBill) /
      (BigInt(historyData.participatingBanks.length) + 1n);
    effectiveSharePerBankFormatted = `${ethers.formatEther(shareInWei)} ETH`;
  } else if (historyData.totalBill > 0) {
    effectiveSharePerBankFormatted = `${ethers.formatEther(
      BigInt(historyData.totalBill)
    )} ETH`;
  }

  // --- Main Render (only runs when data is successfully loaded) ---
  return (
    <div className="text-stone-800 animate-fade-in">
      <h3 className="font-bold text-2xl text-amber-800 mb-4">
        On-Chain KYC History: Client #{clientId}
      </h3>

      {/* Summary Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
          <p className="text-sm text-amber-800 font-semibold">
            Total On-Chain Bill
          </p>
          <p className="text-2xl font-bold">
            {ethers.formatEther(BigInt(historyData.totalBill))} ETH
          </p>
        </div>
        <div className="bg-sky-50 border border-sky-200 p-4 rounded-lg">
          <p className="text-sm text-sky-800 font-semibold">
            Participating Banks
          </p>
          <p className="text-2xl font-bold">
            {historyData.participatingBanks?.length || 0}
          </p>
        </div>
        <div className="bg-teal-50 border border-teal-200 p-4 rounded-lg">
          <p className="text-sm text-teal-800 font-semibold">Effective Share</p>
          <p className="text-2xl font-bold">{effectiveSharePerBankFormatted}</p>
        </div>
      </div>

      {/* Version History Timeline */}
      <h4 className="font-semibold text-xl text-stone-700 mb-4 border-t pt-4">
        Version History
      </h4>
      <div className="relative border-l-2 border-stone-200 pl-6 space-y-6">
        {historyData.versions.length > 0 ? (
          historyData.versions.map((r) => (
            <div key={r.version} className="relative">
              <div
                className={`absolute -left-[34px] h-4 w-4 rounded-full ${
                  r.revoked ? "bg-red-500" : "bg-amber-500"
                }`}
              ></div>
              <div className="p-4 bg-white border border-stone-200 rounded-lg shadow-sm">
                <div className="flex justify-between items-start">
                  <p className="font-bold text-lg">Version {r.version}</p>
                  {r.revoked && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                      REVOKED
                    </span>
                  )}
                </div>
                <p className="text-sm text-stone-500 mb-2">
                  Recorded: {new Date(r.timestamp * 1000).toLocaleString()}
                </p>
                <div className="text-xs space-y-1 bg-stone-50 p-2 rounded break-words">
                  <p>
                    <strong>Status:</strong> {r.status}
                  </p>
                  <p>
                    <strong>Issuer:</strong> {r.issuer}
                  </p>
                  <p>
                    <strong>KTP Hash:</strong> {r.hashKtp}
                  </p>
                  <p>
                    <strong>KYC Hash:</strong> {r.hashKyc}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-stone-500 pl-2">
            No on-chain versions found for this client.
          </p>
        )}
      </div>

      <div className="flex justify-end mt-8 border-t pt-4">
        <button
          className="bg-stone-600 text-white px-4 py-2 rounded-md hover:bg-stone-700 font-semibold text-sm transition-colors"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
