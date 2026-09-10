import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/getSession';
import { creditWallet } from '@/lib/wallet/credit';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (session?.user?.role !== 'ADMIN') return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get('walletId');
    const userId = searchParams.get('userId');

    // If specific wallet or user transaction history is requested
    if (walletId || userId) {
      const wallet = await prisma.userWallet.findFirst({
        where: walletId ? { id: walletId } : { userId: userId! },
        include: {
          user: { select: { id: true, name: true, email: true } },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 100,
          },
        },
      });

      if (!wallet) return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: wallet });
    }

    const wallets = await prisma.userWallet.findMany({
      orderBy: { balance: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      take: 50,
    });

    return NextResponse.json({ success: true, data: wallets });
  } catch (error: any) {
    console.error('Wallets GET Error:', error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (session?.user?.role !== 'ADMIN') return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { userId, amount, action = 'CREDIT', description } = await request.json();

    if (!userId || !amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
    }

    const netAmount = action === 'DEBIT' ? -Math.abs(amount) : Math.abs(amount);
    const result = await creditWallet(
      userId,
      netAmount,
      'ADMIN_ADJUSTMENT' as any,
      description || `Admin manual ${action.toLowerCase()}`
    );

    if (!result) {
      return NextResponse.json({ success: false, error: 'Failed to adjust wallet balance' }, { status: 400 });
    }

    const updatedWallet = await prisma.userWallet.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    return NextResponse.json({ success: true, data: updatedWallet });
  } catch (error: any) {
    console.error('Admin Wallet Adjustment Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server Error' }, { status: 500 });
  }
}
