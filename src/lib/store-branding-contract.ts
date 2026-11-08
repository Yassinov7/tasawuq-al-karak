/** Owner reports 20261102000100 applied. Branding-only provisional contract; remote regeneration still required. */
export type BrandingKind = 'logo' | 'promo_video';
export type BrandingAsset = {
 id: string; store_id: string; kind: BrandingKind; storage_path: string;
 mime_type: string; byte_size: number;
 state: 'registered' | 'current' | 'retired';
 is_current: boolean; storage_object_id: string | null; storage_updated_at: string | null; created_at: string;
 retired_at: string | null;
};
export type BrandingAttempt = {
 owner: string; id: string; store: string; kind: BrandingKind; mime: string; size: number;
 expectedCurrent: string | null;
};
export function validateBrandingInput(kind: BrandingKind, mime: string, size: number) {
 if(!['logo','promo_video'].includes(kind)) throw new Error('Unsupported branding kind');
 const allowed = kind === 'logo' ? ['image/jpeg','image/png','image/webp'] : ['video/mp4'];
 if (!allowed.includes(mime) || !Number.isSafeInteger(size) || size < 1 || size > (kind === 'logo' ? 4194304 : 52428800)) throw new Error('Unsupported branding file');
}
export function checkBrandingSignature(mime: string, buffer: ArrayBuffer) {
 const b = new Uint8Array(buffer);
 const ascii = (start: number, end: number) => String.fromCharCode(...b.slice(start,end));
 const matches = mime === 'image/png' ? [137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)
  : mime === 'image/jpeg' ? b[0]===255 && b[1]===216 && b[2]===255
  : mime === 'image/webp' ? ascii(0,4)==='RIFF' && ascii(8,12)==='WEBP'
  : mime === 'video/mp4' && ascii(4,8)==='ftyp' && ['isom','iso2','mp41','mp42','avc1'].includes(ascii(8,12));
 if(!matches) throw new Error('File content does not match its declared type');
 // Client-only early rejection. Storage does not decode or attest media content.
}
