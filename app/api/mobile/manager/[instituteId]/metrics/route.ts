import { NextRequest } from 'next/server';
import { GET as getMetrics } from '../../metrics/route';

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
  return getMetrics(modifiedReq);
}
