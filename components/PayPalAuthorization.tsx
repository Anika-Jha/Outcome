"use client";

import { useState } from "react";
import {
  PayPalProvider,
  PayPalOneTimePaymentButton,
} from "@paypal/react-paypal-js/sdk-v6";

type Props = {
  outcomeId: string;
  amount: number;
  onAuthorized?: () => void;
};

type CreateOrderResponse = {
  id?: string;
  orderId?: string;
  message?: string;
};

type AuthorizeResponse = {
  status?: string;
  authorized?: boolean;
  message?: string;
};

export default function PayPalAuthorization({ outcomeId, amount, onAuthorized }: Props) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const environment = process.env.NEXT_PUBLIC_PAYPAL_ENVIRONMENT || "sandbox";

  if (!clientId) {
    return (
      <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-slate-300">
        <p className="font-medium text-amber-200">PayPal setup pending</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          Configure NEXT_PUBLIC_PAYPAL_CLIENT_ID. The backend uses server-side
          PayPal credentials; never expose the PayPal client secret in the browser.
        </p>
      </div>
    );
  }

  async function createOrder(): Promise<{ orderId: string }> {
    setMessage("Creating PayPal order…");
    const response = await fetch(`/api/paypal/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcomeId, amount, intent: "AUTHORIZE" }),
    });

    const data = (await response.json()) as CreateOrderResponse;
    if (!response.ok) throw new Error(data.message || "Could not create PayPal order.");
    const orderId = data.orderId || data.id;
    if (!orderId) throw new Error("The backend did not return an order ID.");
    return { orderId };
  }

  async function authorizeOrder(data: { orderId: string }) {
    setBusy(true);
    setMessage("Buyer approved. Confirming authorization with the backend…");
    try {
      const response = await fetch(
        `/api/paypal/orders/${encodeURIComponent(data.orderId)}/authorize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcomeId }),
        }
      );
      const result = (await response.json()) as AuthorizeResponse;
      if (!response.ok) throw new Error(result.message || "Authorization failed.");
      if (result.status !== "AUTHORIZED" && result.authorized !== true) {
        throw new Error("The backend did not confirm an authorized payment.");
      }
      setMessage("PayPal authorization confirmed. Funds have not been captured.");
      onAuthorized?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not confirm authorization.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-[#080d0e] p-4">
      <div className="mb-3">
        <p className="text-sm font-medium text-white">PayPal Sandbox authorization</p>
        <p className="mt-1 text-xs text-slate-400">
          Outcome {outcomeId} · Amount: ${amount.toFixed(2)}
        </p>
      </div>
      <PayPalProvider clientId={clientId} environment={environment as "sandbox" | "production"} pageType="checkout">
        <PayPalOneTimePaymentButton
          createOrder={createOrder}
          onApprove={authorizeOrder}
          onCancel={() => setMessage("PayPal checkout was cancelled.")}
          onError={() => setMessage("PayPal checkout encountered an error.")}
          presentationMode="auto"
          disabled={busy}
        />
      </PayPalProvider>
      {message && <p role="status" className="mt-3 text-xs leading-5 text-slate-300">{message}</p>}
    </div>
  );
}
