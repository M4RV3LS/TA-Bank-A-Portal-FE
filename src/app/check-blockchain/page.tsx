// bank-portal/bank-a/frontend/src/app/check-blockchain/page.tsx
"use client";

import React, { useState, useRef } from "react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import jsQR from "jsqr";
// Make sure to import your Navbar
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- Type definitions are unchanged ---
interface Payload {
  client_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status_request: string;
  home_bank_code: string;
}

// ✅ ADDED: Interface for the success state
interface SuccessResult {
  requestId: number;
  customerName: string;
}

export default function CreateRequestFromQRPage() {
  const [mode, setMode] = useState<"upload" | "scan">("upload");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<SuccessResult | null>(null); // ✅ ADDED: State for the success screen
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processPayload = async (payload: Payload) => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:4000/kyc-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create KYC request.");
      }

      // ✅ MODIFIED: Set success data instead of just showing a toast and resetting
      setSuccessData({
        requestId: json.request_id,
        customerName: payload.customer_name,
      });
      toast.success("KYC Request created successfully!");
    } catch (e: any) {
      console.error(e);
      toast.error(`Processing error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- handleFile and handleScan logic remains the same ---
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLoading(true);
    const dataUrl = await new Promise<string>((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(f);
    });
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // ... (canvas logic is the same)
      const code = jsQR(/* ... */);
      if (!code) {
        /* ... */
      }
      try {
        const payload = JSON.parse(code.data) as Payload;
        processPayload(payload);
      } catch {
        /* ... */
      }
    };
    img.onerror = () => {
      /* ... */
    };
  };

  const handleScan = (detected: IDetectedBarcode[]) => {
    if (!detected || detected.length === 0 || loading) return;
    setLoading(true);
    const text = detected[0].rawValue;
    try {
      const payload = JSON.parse(text) as Payload;
      processPayload(payload);
    } catch {
      /* ... */
    }
  };

  // ✅ MODIFIED: The reset function now also clears the success data
  const resetState = () => {
    setSuccessData(null);
    setLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-orange-50">
      <ToastContainer position="top-center" theme="colored" />

      <main className="flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 animate-fade-in">
        <div className="w-full max-w-2xl bg-white p-6 sm:p-8 rounded-xl shadow-lg">
          {/* ✅ MODIFIED: Conditionally render success screen or input UI */}
          {successData ? (
            <div className="text-center animate-fade-in">
              <div className="p-6 rounded-lg bg-green-50">
                <span className="text-6xl text-green-500">✓</span>
                <h2 className="mt-4 text-3xl font-bold text-green-700">
                  KYC Request Created
                </h2>
                <p className="mt-2 text-stone-600">
                  A new KYC request for{" "}
                  <strong>{successData.customerName}</strong> has been
                  successfully created with Request ID:{" "}
                  <strong>#{successData.requestId}</strong>.
                </p>
              </div>

              <button
                onClick={resetState}
                className="mt-8 w-full sm:w-auto bg-amber-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-amber-700 shadow-sm transition-colors duration-150"
              >
                Create Another Request
              </button>
            </div>
          ) : (
            <div className="animate-fade-in">
              <h1 className="text-2xl sm:text-3xl font-bold text-amber-800 text-center">
                Create New KYC Request via QR
              </h1>
              <p className="mt-2 text-stone-600 text-center">
                Use a customers QR code to quickly populate a new KYC request.
              </p>

              {/* Mode Toggle */}
              <div className="mt-6 p-1 bg-stone-100 rounded-lg flex space-x-1">
                <button
                  onClick={() => setMode("upload")}
                  className={`w-1/2 py-2 rounded-md font-semibold transition-colors ${
                    mode === "upload"
                      ? "bg-amber-600 text-white shadow"
                      : "text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  Upload File
                </button>
                <button
                  onClick={() => setMode("scan")}
                  className={`w-1/2 py-2 rounded-md font-semibold transition-colors ${
                    mode === "scan"
                      ? "bg-amber-600 text-white shadow"
                      : "text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  Use Camera
                </button>
              </div>

              {/* Input UI */}
              <div className="mt-6">
                {mode === "upload" && (
                  <label
                    htmlFor="qr-upload"
                    className="relative block w-full h-48 border-2 border-dashed border-stone-300 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-colors"
                  >
                    <span className="text-4xl text-stone-400">📤</span>
                    <span className="mt-2 block font-semibold text-stone-600">
                      Click to upload or drag & drop
                    </span>
                    <input
                      id="qr-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFile}
                      ref={fileInputRef}
                      className="opacity-0 absolute inset-0 w-full h-full"
                    />
                  </label>
                )}
                {mode === "scan" && (
                  <div className="w-full max-w-sm mx-auto p-2 border-4 border-stone-200 rounded-lg shadow-inner">
                    <Scanner
                      onScan={handleScan}
                      onError={() => toast.error("Camera error.")}
                      constraints={{ facingMode: "environment" }}
                      styles={{ container: { width: "100%" } }}
                    />
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
