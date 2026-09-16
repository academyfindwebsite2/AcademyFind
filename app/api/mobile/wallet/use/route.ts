import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { debitWallet } from '@/lib/wallet/credit';
import { WalletTransactionSource } from '@/app/generated/prisma/client';
import { recordInstituteUnlock } from '@/lib/unlocks/unlock-service';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const sessionObj = await prisma.session.findFirst({
        where: { token, expiresAt: { gt: new Date() } },
      });
      if (sessionObj) userId = sessionObj.userId;
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Please login first' }, { status: 401 });
    }

    const { amount = 1, source, description, referenceId, unlockType, instituteId } = await req.json();

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
    }

    const result = await debitWallet(userId, amount, source as WalletTransactionSource, description, referenceId);

    if (result && 'success' in result && result.success === false) {
      return NextResponse.json({ success: false, error: result.error || 'Insufficient AF Coins' }, { status: 400 });
    }

    if (!result) {
      return NextResponse.json({ success: false, error: 'Failed to process coin transaction' }, { status: 500 });
    }

    // Record Institute Unlock and dispatch notifications if applicable
    const targetInstituteId = instituteId || referenceId;
    const isInstituteUnlock =
      source === "SEE_CONTACT_BASIC_INSTITUTE" ||
      source === "SEE_COMMUNITY_BASIC_INSTITUTE" ||
      Boolean(targetInstituteId && (unlockType || description?.toLowerCase().includes("institute")));

    if (isInstituteUnlock && targetInstituteId) {
      recordInstituteUnlock({
        userId,
        instituteId: targetInstituteId,
        unlockType: unlockType || (source === "SEE_COMMUNITY_BASIC_INSTITUTE" ? "COMMUNITY" : undefined),
        coinsSpent: amount,
        description,
      }).catch((err) => console.error("Mobile error recording institute unlock:", err));
    }

    // Get current wallet balance
    const userWallet = await prisma.userWallet.findUnique({ where: { userId } });

    return NextResponse.json({
      success: true,
      balance: userWallet?.balance || 0,
      transaction: result,
    });
  } catch (error: any) {
    console.error('Mobile Wallet Use Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Transaction failed' }, { status: 500 });
  }
}
