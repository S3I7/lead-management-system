import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Payment } from '../../api/client';
import { CreditCard, CheckCircle2, ShieldCheck, Lock, Sparkles, Smartphone, Landmark, AlertCircle } from 'lucide-react';

export const PaymentCheckoutPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [payment, setPayment] = useState<Payment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [method, setMethod] = useState<'UPI' | 'CARD' | 'NETBANKING'>('UPI');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaidSuccess, setIsPaidSuccess] = useState(false);

  useEffect(() => {
    const fetchPayment = async () => {
      if (!token) return;
      setIsLoading(true);
      try {
        const res = await api.get<Payment>(`/payments/by-token/${token}`);
        setPayment(res.data);
        if (res.data.status === 'PAID') {
          setIsPaidSuccess(true);
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Invalid or expired payment link.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchPayment();
  }, [token]);

  const handlePay = async () => {
    if (!token) return;
    setIsProcessing(true);
    try {
      const res = await api.post<Payment>(`/payments/process-checkout/${token}`, {
        payment_method: method,
        mock_success: true,
      });
      setPayment(res.data);
      setIsPaidSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Payment processing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-muted">Loading secure checkout...</p>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg px-4">
        <div className="max-w-md w-full bg-white rounded-card p-8 text-center shadow-subtle border border-app-border">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-heading font-bold text-text-dark">Payment Unavailable</h2>
          <p className="text-sm text-text-muted mt-2">{error || 'Could not find payment records.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg py-12 px-4">
      <div className="max-w-xl mx-auto">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 bg-primary-soft text-primary px-3 py-1 rounded-pill text-xs font-bold uppercase tracking-wider mb-2">
            <Lock className="w-3.5 h-3.5" />
            256-Bit SSL Encrypted Checkout
          </div>
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-text-dark">
            Publication Fee Checkout
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Gateway: <strong>{payment.gateway} (Secured)</strong>
          </p>
        </div>

        {isPaidSuccess ? (
          <div className="bg-white rounded-card p-8 md:p-10 shadow-elevated border-2 border-emerald-400 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-heading font-bold text-text-dark">
              Payment Successful! 🎉
            </h2>
            <p className="text-sm text-text-muted mt-1">
              Transaction ID: <strong>{payment.gateway_payment_id || 'TXN-SUCCESS'}</strong>
            </p>

            <div className="my-6 p-4 bg-emerald-50 rounded-xl text-left text-xs text-emerald-900 border border-emerald-200 space-y-1.5">
              <p>✓ <strong>Payment Status:</strong> PAID ({payment.amount} {payment.currency})</p>
              <p>✓ <strong>Lead Journey Status:</strong> COMPLETED</p>
              <p>✓ <strong>Story Status:</strong> APPROVED</p>
              <p>✓ <strong>Publication Status:</strong> READY</p>
              <p>✓ Payment Confirmation & Final Confirmation emails dispatched!</p>
            </div>

            <button
              onClick={() => navigate(`/status/${payment.lead_id}`)}
              className="btn-primary w-full py-3"
            >
              View Publication Timeline
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-card p-6 md:p-8 shadow-subtle border border-app-border space-y-6">
            {/* Amount Summary */}
            <div className="p-4 bg-primary-soft/50 rounded-2xl border border-primary/20 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-text-muted uppercase">Total Payable</span>
                <div className="text-3xl font-heading font-extrabold text-primary">
                  {payment.amount} <span className="text-lg font-semibold">{payment.currency}</span>
                </div>
              </div>
              <div className="text-right text-xs text-text-muted">
                <p>Includes typeset, ISBN &</p>
                <p>anthology volume publishing</p>
              </div>
            </div>

            {/* Payment Methods */}
            <div>
              <label className="block text-xs font-bold text-text-dark mb-3">
                Select Payment Method
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod('UPI')}
                  className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                    method === 'UPI'
                      ? 'border-primary bg-primary-soft text-primary font-bold'
                      : 'border-app-border hover:bg-gray-50 text-text-main'
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                  <span className="text-xs">UPI / QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('CARD')}
                  className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                    method === 'CARD'
                      ? 'border-primary bg-primary-soft text-primary font-bold'
                      : 'border-app-border hover:bg-gray-50 text-text-main'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-xs">Cards</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('NETBANKING')}
                  className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                    method === 'NETBANKING'
                      ? 'border-primary bg-primary-soft text-primary font-bold'
                      : 'border-app-border hover:bg-gray-50 text-text-main'
                  }`}
                >
                  <Landmark className="w-5 h-5" />
                  <span className="text-xs">NetBanking</span>
                </button>
              </div>
            </div>

            {/* Method mock inputs */}
            {method === 'UPI' && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-2">
                <p className="font-semibold text-text-dark">Instant UPI Apps supported:</p>
                <div className="flex gap-2">
                  <span className="px-2.5 py-1 bg-white rounded-lg border text-gray-700 font-medium">Google Pay</span>
                  <span className="px-2.5 py-1 bg-white rounded-lg border text-gray-700 font-medium">PhonePe</span>
                  <span className="px-2.5 py-1 bg-white rounded-lg border text-gray-700 font-medium">Paytm</span>
                </div>
                <input
                  type="text"
                  placeholder="parent@upi or mobile number"
                  defaultValue="parent@oksbi"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white outline-none mt-2"
                />
              </div>
            )}

            {method === 'CARD' && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-3">
                <input
                  type="text"
                  placeholder="Card Number (4111 2222 3333 4444)"
                  defaultValue="4242 •••• •••• 4242"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="MM/YY"
                    defaultValue="12/28"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white outline-none"
                  />
                  <input
                    type="password"
                    placeholder="CVV"
                    defaultValue="123"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white outline-none"
                  />
                </div>
              </div>
            )}

            {method === 'NETBANKING' && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                <select className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs bg-white outline-none">
                  <option>HDFC Bank</option>
                  <option>ICICI Bank</option>
                  <option>State Bank of India</option>
                  <option>Axis Bank</option>
                </select>
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={isProcessing}
              className="btn-primary w-full py-3 text-base"
            >
              {isProcessing ? (
                'Verifying Gateway Payment...'
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Pay {payment.amount} {payment.currency} via Gateway
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-text-muted">
              Server-side webhook verifies payment automatically. Status updates in real-time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
