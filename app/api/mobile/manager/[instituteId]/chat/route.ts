import { NextRequest, NextResponse } from 'next/server';
import { GET as getChat, POST as postChat, PUT as putChat, DELETE as deleteChat } from '../../chat/route';

type RouteContext = { params: Promise<{ instituteId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { instituteId } = await context.params;
  const url = new URL(request.url);
  if (!url.searchParams.get('instituteId')) {
    url.searchParams.set('instituteId', instituteId);
  }
  const modifiedReq = new NextRequest(url.toString(), {
    headers: request.headers,
    method: request.method,
  });
  return getChat(modifiedReq);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { instituteId } = await context.params;
  const body = await request.json();
  body.instituteId = body.instituteId || instituteId;
  const modifiedReq = new NextRequest(request.url, {
    headers: request.headers,
    method: request.method,
    body: JSON.stringify(body),
  });
  return postChat(modifiedReq);
}

export async function PUT(request: NextRequest, _context: RouteContext) {
  return putChat(request);
}

export async function DELETE(request: NextRequest, _context: RouteContext) {
  return deleteChat(request);
}
