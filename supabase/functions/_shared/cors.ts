// CORS headers shared by every Edge Function. The dev-client + future
// web pair page hit these endpoints from RN and from a browser; the
// permissive origin is fine for non-cookie auth (we use Bearer JWTs).

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
