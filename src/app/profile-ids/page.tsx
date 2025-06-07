//path file: bank-portal/bank-a/frontend/src/app/profile-ids/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
type Row = {
  request_id: number;
  client_id: number;
  customer_name: string;
  profile_id: string;
};

export default function ProfileIdsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    fetch("http://localhost:4000/profile-ids")
      .then((r) => r.json())
      .then(setRows);
  }, []);

  return (
    <div className="p-8 bg-black text-white min-h-screen">
      {/* kembali */}
      <div className="mb-4">
        <Link href="/" className="text-blue-400 hover:underline">
          ← Back to Home
        </Link>
      </div>
      <h1 className="text-2xl mb-4">Profile IDs</h1>
      <table className="w-full table-auto">
        <thead>
          <tr>
            {["Request ID", "Client ID", "Name", "Profile ID"].map((h) => (
              <th key={h} className="border p-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.profile_id}>
              <td className="border p-2">{r.request_id}</td>
              <td className="border p-2">{r.client_id}</td>
              <td className="border p-2">{r.customer_name}</td>
              <td className="border p-2 font-mono">{r.profile_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
