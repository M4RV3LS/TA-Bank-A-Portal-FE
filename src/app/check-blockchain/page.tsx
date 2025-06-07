"use client";

import React, { useState, useRef } from "react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import jsQR from "jsqr";
import Navbar from "@/components/Navbar";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- Type definitions ---
interface Payload {
  client_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status_request: string;
  home_bank_code: string;
}

interface SuccessResult {
  requestId: number;
  customerName: string;
}

export default function CreateRequestFromQRPage() {
  const [mode, setMode] = useState<"upload" | "scan">("upload");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<SuccessResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The logic for these functions is correct and remains unchanged.
  const processPayload = async (payload: Payload) => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:4000/kyc-requests", {
        // Points to Bank A backend
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || "Failed to create KYC request.");
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        setLoading(false);
        return;
      }
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setLoading(false);
        return;
      }
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, img.width, img.height);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        try {
          const payload = JSON.parse(code.data) as Payload;
          processPayload(payload);
        } catch (err) {
          toast.error("Invalid QR code data.");
          setLoading(false);
        }
      } else {
        toast.error("No QR code found in the image.");
        setLoading(false);
      }
      URL.revokeObjectURL(imageUrl);
    };
    img.onerror = () => {
      toast.error("Could not load image file.");
      setLoading(false);
      URL.revokeObjectURL(imageUrl);
    };
  };

  const handleScan = (detected: IDetectedBarcode[]) => {
    if (!detected || detected.length === 0 || loading) return;
    setLoading(true);
    const text = detected[0].rawValue;
    try {
      const payload = JSON.parse(text) as Payload;
      processPayload(payload);
    } catch (err) {
      toast.error("Scanned QR code is not valid.");
      setLoading(false);
    }
  };

  const resetState = () => {
    setSuccessData(null);
    setLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <ToastContainer position="top-center" theme="colored" />
      <main className="flex flex-col items-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-2xl bg-white p-6 sm:p-8 rounded-xl shadow-lg">
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
                className="mt-8 w-full sm:w-auto bg-amber-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-amber-700 shadow-sm"
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
                Use a customer's QR code to quickly populate a new KYC request.
              </p>

              {/* ✅ FIX: Restored the mode-toggle buttons */}
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
                      onError={(e) =>
                        toast.error(`Camera error: ${e?.message}`)
                      }
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
