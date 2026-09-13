import CheckoutForm from "@/components/manager/CheckOutForm";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription/plans";

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ instituteId: string, planId: string }>; searchParams: Promise<{ billingCycle?: string }>; }) {
    const { instituteId, planId } = await params;
    const resolvedSearchParams = await searchParams;
    const billingCycle = resolvedSearchParams.billingCycle === "ANNUAL" ? "ANNUAL" : "MONTHLY";

    const selectedPlan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);

    if (!selectedPlan) return <div>Invalid Plan</div>;
    const upiId = process.env.PAYMENT_UPI_ID || "";
    const bankDetails = {
        bankName: process.env.PAYMENT_BANK_NAME || "",
        accountName: process.env.PAYMENT_ACCOUNT_NAME || "",
        accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || "",
        ifscCode: process.env.PAYMENT_IFSC_CODE || ""
    };

    return <CheckoutForm instituteId={instituteId} plan={selectedPlan} BillingCycle={billingCycle} upiId={upiId} bankDetails={bankDetails} />;
}