// bank-portal/bank-a/frontend/src/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import KycHistory from "@/components/KycHistory";
import Modal from "@/components/Modal";
import { ethers } from "ethers";
import { toast, ToastContainer } from "react-toastify"; // <-- IMPORT THESE
import "react-toastify/dist/ReactToastify.css";

type KycRequest = {
  request_id: number;
  client_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_ktp: string;
  customer_kyc: string;
  profile_id: string | null;
  status_kyc:
    | "submitted"
    | "in review"
    | "verified"
    | "failed"
    | "success"
    | "paid";
  status_request: "new" | "update" | "reuse_kyc";
  note: string | null;
};

export default function HomePage() {
  const [requests, setRequests] = useState<KycRequest[]>([]);
  const [historyClient, setHistoryClient] = useState<{
    clientId: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Helper to fetch and sync any “in-review” statuses
  const loadAndSync = async () => {
    setLoading(true);

    // 1) Load from Bank A’s DB
    const resp = await fetch("http://localhost:4000/kyc-requests");
    const data: KycRequest[] = await resp.json();
    setRequests(data);

    // 2) For any “in review” → pull Dukcapil status
    const inReview = data.filter(
      (r) =>
        (r.status_kyc === "in review" && r.status_request === "new") ||
        (r.status_kyc === "in review" && r.status_request === "update")
    );
    await Promise.all(
      inReview.map((r) =>
        fetch(`http://localhost:4000/dukcapil-status/${r.request_id}`)
      )
    );

    // 3) Reload final statuses
    const finalResp = await fetch("http://localhost:4000/kyc-requests");
    setRequests(await finalResp.json());
    setLoading(false);
  };

  useEffect(() => {
    loadAndSync();
  }, []);

  /**
   * “Send to Blockchain” handler for new/update
   *
   * Now accepts both request_id and client_id.
   * After on-chain success, we call Customer-Portal’s POST /account/rotate-key
   * to rotate that user’s decrypt key.
   */
  const toChain = async (requestId: number, clientId: number) => {
    try {
      const resp = await fetch(
        `http://localhost:4000/kyc-requests/${requestId}/send-to-chain`,
        { method: "POST" }
      );
      const json = await resp.json();

      if (!resp.ok) {
        alert(`Send-to-chain failed:\n${JSON.stringify(json, null, 2)}`);
        return;
      }

      const version = json.version;
      const txHash = json.txHash;

      if (typeof txHash === "string" && txHash.length > 0) {
        alert(`Success! Version ${version}. Tx Hash: ${txHash.slice(0, 8)}…`);
      } else {
        alert(
          `Success! Version ${version}, but no txHash returned.\nServer response:\n${JSON.stringify(
            json,
            null,
            2
          )}`
        );
      }

      // (Optional) You could also re-fetch /account/profile here if needed,
      // but the key rotation logic lives entirely in customer-portal.

      // ─────────── Refresh Bank A’s table ───────────
      await loadAndSync();
    } catch (e: any) {
      console.error("Error calling /send-to-chain:", e);
      alert(`Blockchain call failed:\n${e.message || e}`);
    }
  };

  // “Pay” handler (for reuse_kyc scenario)
  const handlePay = async (row: KycRequest) => {
    let amountToPayInWei: string | undefined;

    if (row.status_request === "reuse_kyc") {
      // For reuse_kyc, the backend calculates the amount.
      // We can optionally confirm with the user before proceeding without specifying amount.
      if (
        !confirm(
          `Proceed to pay the calculated share for client ${row.client_id} (request ${row.request_id})? The amount will be determined by the backend.`
        )
      ) {
        return;
      }
      // No amount is prompted from the user; backend will calculate.
      // We will send an empty or no 'amount' field, relying on backend logic.
      amountToPayInWei = undefined; // Or an empty string, depending on how backend handles it
    } else {
      // For other types (e.g. if 'pay' was for something else, though 'toChain' handles new/update payments)
      // This part might be legacy or for a different flow.
      // For safety, if this is reached for new/update, it might indicate a flow issue.
      const amountInEth = prompt(
        `Enter amount in ETH for request ${row.request_id} (client ${row.client_id}):`,
        "0.01" // Default or example amount for non-reuse scenarios
      );
      if (
        !amountInEth ||
        isNaN(parseFloat(amountInEth)) ||
        parseFloat(amountInEth) <= 0
      ) {
        alert("Invalid or no amount entered.");
        return;
      }
      try {
        amountToPayInWei = ethers.parseEther(amountInEth).toString();
      } catch (e) {
        alert("Invalid ETH amount format.");
        return;
      }
    }

    setLoading(true);
    try {
      const payload: { amount?: string } = {};
      if (amountToPayInWei !== undefined) {
        // Only include amount if it was set (e.g., for non-reuse)
        payload.amount = amountToPayInWei;
      }

      const resp = await fetch(
        `http://localhost:4000/kyc-requests/${row.request_id}/pay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload), // Send payload (amount might be undefined)
        }
      );

      const json = await resp.json();
      if (!resp.ok) {
        alert(
          `Payment failed:\n${
            json.error || JSON.stringify(json.detail) || "Unknown error"
          }`
        );
      } else {
        alert(
          `Payment submission successful. Amount processed: ${ethers.formatEther(
            json.amountPaid || "0"
          )} ETH. Tx: ${json.txHash ? json.txHash.slice(0, 10) : "N/A"}...`
        );
      }
    } catch (e: any) {
      console.error("Error calling /pay endpoint:", e);
      alert(`On-chain pay failed: ${e.message || "See console."}`);
    } finally {
      await loadAndSync(); // Refresh data
      setLoading(false);
    }
  };

  // “Verify” handler
  const verify = async (id: number) => {
    await fetch(`http://localhost:4000/kyc-requests/${id}/send-to-dukcapil`, {
      method: "POST",
    });
    loadAndSync();
  };

  // “Check” handler (pull files from Home Bank’s vault + verify on-chain)
  // const handleCheck = async (row: KycRequest) => {
  //   const bankAddress = prompt("Enter your bank’s Ethereum address (0x…):");
  //   if (!bankAddress) {
  //     return alert("Must provide your bank address to verify on-chain.");
  //   }

  //   try {
  //     // 1) Pull from Home Bank’s vault
  //     const vaultResp = await fetch(
  //       `http://localhost:4000/kyc-files/${row.client_id}?bankAddress=${bankAddress}`
  //     );
  //     if (!vaultResp.ok) {
  //       const err = await vaultResp.json();
  //       return alert(`Access Denied:\n${JSON.stringify(err)}`);
  //     }
  //     const { dataUri } = await vaultResp.json();

  //     // 2) Base64 decode to raw bytes
  //     const base64Part = dataUri.split(",")[1];
  //     const rawBytes = atob(base64Part);
  //     const byteArray = new Uint8Array(
  //       rawBytes.split("").map((c) => c.charCodeAt(0))
  //     );

  //     // 3) Compute on-chain hash
  //     const localHash = ethers.keccak256(byteArray);

  //     // 4) Fetch on-chain “latest” hash
  //     const browserProvider = new ethers.JsonRpcProvider(
  //       "http://127.0.0.1:8546"
  //     );
  //     const readOnlyContract = new ethers.Contract(
  //       process.env.NEXT_PUBLIC_KYC_REGISTRY_ADDRESS!,
  //       [
  //         // Only need the ABI fragment for getLatestKyc():
  //         "function getLatestKyc(uint256) view returns (uint32 version, string hashKtp, string hashKyc, string status, uint64 timestamp, address issuer, bool revoked)",
  //       ],
  //       browserProvider
  //     );

  //     const latestRecord: any = await readOnlyContract.getLatestKyc(
  //       row.client_id
  //     );
  //     const onChainHash = latestRecord.hashKtp;

  //     // 5) Compare
  //     if (localHash === onChainHash) {
  //       return alert("✅ Hashes match! KYC bundle integrity confirmed.");
  //     } else {
  //       return alert("⚠️ Hash mismatch! Trigger audit / re-onboarding.");
  //     }
  //   } catch (e) {
  //     console.error("Error during ‘Check’ flow:", e);
  //     return alert(`Error verifying on.chain: ${e}`);
  //   }
  // };

  // Example of handleCheckReuse where toast is used
  const handleCheckReuse = async (request: KycRequest) => {
    if (
      !confirm(
        `Proceed to check and verify KYC data for client ${request.client_id} (request ${request.request_id})?`
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const currentBankApiPort = 4000;
      const resp = await fetch(
        `http://localhost:${currentBankApiPort}/kyc-requests/${request.request_id}/fetch-and-verify-reuse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const json = await resp.json();
      if (!resp.ok) {
        toast.error(
          `Check & Verify Data failed: ${
            json.error || JSON.stringify(json.detail) || "Unknown error"
          }`
        );
      } else {
        toast.success(
          json.message || "Check & Verify Data process completed successfully."
        );
      }
    } catch (e: any) {
      console.error("Error calling /fetch-and-verify-reuse:", e);
      toast.error(`Check & Verify Data call failed: ${e.message || e}`);
    } finally {
      await loadAndSync();
      setLoading(false);
    }
  };

  const handleDelete = async (requestId: number) => {
    if (!confirm("Delete this KYC request?")) return;
    setLoading(true);
    try {
      const resp = await fetch(
        `http://localhost:4000/kyc-requests/${requestId}`,
        { method: "DELETE" }
      );
      if (resp.ok) {
        toast.success("Deleted successfully");
        loadAndSync(); // Reloads and sets loading to false
      } else {
        const errData = await resp
          .json()
          .catch(() => ({ error: "Delete failed" }));
        toast.error(errData.error || "Delete failed");
        setLoading(false);
      }
    } catch (e: any) {
      console.error("Error deleting request:", e);
      toast.error(`Delete failed: ${e.message || e}`);
      setLoading(false);
    }
  };

  const headers = [
    "Request ID",
    "Client ID",
    "Name",
    "Email",
    "Phone",
    "KTP",
    "KYC",
    "Status KYC",
    "Status Request",
    "Note",
    "History",
  ];

  return (
    <>
      {" "}
      {/* Using Fragment to include Navbar outside the main div if needed, or move Navbar inside */}
      <div className="p-6 sm:p-8 bg-orange-50 min-h-screen text-stone-800">
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
        />
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-amber-800">
            KYC Requests (Bank A Portal)
          </h1>
          {loading && (
            <div className="mt-2 text-amber-600 font-semibold">
              Loading data, please wait…
            </div>
          )}
        </header>

        <div className="shadow-xl rounded-lg overflow-x-auto bg-white">
          <table className="w-full min-w-max">
            <thead className="bg-amber-600 text-white">
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    className="p-3 text-left text-sm font-semibold uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
                <th className="p-3 text-left text-sm font-semibold uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200">
              {requests.map((r, index) => {
                // const isReuse = r.status_request === "reuse_kyc"; // Not directly used for styling anymore
                const rowClass = index % 2 === 0 ? "bg-orange-50" : "bg-white"; // Zebra striping
                return (
                  <tr
                    key={r.request_id}
                    className={`${rowClass} hover:bg-amber-100 transition-colors duration-150`}
                  >
                    <td className="p-3 text-sm text-stone-700 whitespace-nowrap">
                      {r.request_id}
                    </td>
                    <td className="p-3 text-sm text-stone-700 whitespace-nowrap">
                      {r.client_id}
                    </td>
                    <td className="p-3 text-sm text-stone-700 whitespace-nowrap">
                      {r.customer_name}
                    </td>
                    <td className="p-3 text-sm text-stone-700 whitespace-nowrap">
                      {r.customer_email}
                    </td>
                    <td className="p-3 text-sm text-stone-700 whitespace-nowrap">
                      {r.customer_phone}
                    </td>
                    <td className="p-3 text-sm whitespace-nowrap">
                      <button
                        onClick={() =>
                          window.open(
                            `http://localhost:4000/kyc-requests/${r.request_id}/ktp`,
                            "_blank"
                          )
                        }
                        className="text-amber-600 hover:text-amber-700 font-semibold hover:underline"
                      >
                        View KTP
                      </button>
                    </td>
                    <td className="p-3 text-sm whitespace-nowrap">
                      <button
                        onClick={() =>
                          window.open(
                            `http://localhost:4000/kyc-requests/${r.request_id}/view`,
                            "_blank"
                          )
                        }
                        className="text-amber-600 hover:text-amber-700 font-semibold hover:underline"
                      >
                        View Docs
                      </button>
                    </td>
                    <td className="p-3 text-sm text-stone-700 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          r.status_kyc === "verified"
                            ? "bg-green-100 text-green-700"
                            : r.status_kyc === "submitted"
                            ? "bg-yellow-100 text-yellow-700"
                            : r.status_kyc === "in review"
                            ? "bg-blue-100 text-blue-700"
                            : r.status_kyc === "paid"
                            ? "bg-purple-100 text-purple-700"
                            : r.status_kyc === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-700" // for success or other statuses
                        }`}
                      >
                        {r.status_kyc}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-stone-700 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          r.status_request === "new"
                            ? "bg-sky-100 text-sky-700"
                            : r.status_request === "update"
                            ? "bg-indigo-100 text-indigo-700"
                            : r.status_request === "reuse_kyc"
                            ? "bg-fuchsia-100 text-fuchsia-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {r.status_request}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-stone-700 whitespace-nowrap">
                      {r.note ?? "N/A"}
                    </td>
                    <td className="p-3 text-sm text-center whitespace-nowrap">
                      <button
                        className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-colors duration-150"
                        onClick={() =>
                          setHistoryClient({ clientId: r.client_id })
                        }
                      >
                        History
                      </button>
                    </td>
                    <td className="p-3 text-sm space-x-2 whitespace-nowrap">
                      {/* Action Buttons */}
                      {(r.status_request === "new" ||
                        r.status_request === "update") && (
                        <>
                          {r.status_kyc === "submitted" && (
                            <button
                              className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-colors duration-150"
                              onClick={() => verify(r.request_id)}
                            >
                              Verify (Dukcapil)
                            </button>
                          )}
                          {r.status_kyc === "verified" && (
                            <button
                              className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-colors duration-150"
                              onClick={() => toChain(r.request_id, r.client_id)}
                            >
                              {r.status_request === "new"
                                ? "Send to Chain (1 ETH)"
                                : "Update Chain (0.1 ETH)"}
                            </button>
                          )}
                        </>
                      )}
                      {r.status_request === "reuse_kyc" && (
                        <>
                          {r.status_kyc === "submitted" && (
                            <button
                              className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-colors duration-150"
                              onClick={() => handlePay(r)}
                            >
                              Pay Share
                            </button>
                          )}
                          {r.status_kyc === "paid" && (
                            <button
                              className="bg-sky-500 hover:bg-sky-600 text-white px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-colors duration-150"
                              onClick={() => handleCheckReuse(r)}
                            >
                              Check & Verify Data
                            </button>
                          )}
                        </>
                      )}
                      <button
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-colors duration-150"
                        onClick={() => handleDelete(r.request_id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {requests.length === 0 && !loading && (
            <p className="text-center p-10 text-stone-500">
              No KYC requests found.
            </p>
          )}
        </div>

        {historyClient && (
          <Modal onClose={() => setHistoryClient(null)}>
            <KycHistory
              clientId={historyClient.clientId}
              onClose={() => setHistoryClient(null)}
            />
          </Modal>
        )}
      </div>
    </>
  );
}
