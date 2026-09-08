import { NextRequest } from 'next/server';
import { GET as getBlogs, POST as postBlog, PUT as putBlog, DELETE as deleteBlog } from '../../blogs/route';

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
  return getBlogs(modifiedReq);
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
  return postBlog(modifiedReq);
}

export async function PUT(request: NextRequest, _context: RouteContext) {
  return putBlog(request);
}

export async function DELETE(request: NextRequest, _context: RouteContext) {
  return deleteBlog(request);
}
