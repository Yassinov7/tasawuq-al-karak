/** Keep useful Arabic domain explanations; never expose raw SQL/SDK failures to users. */
export function userErrorMessage(error:unknown,fallback:string){
 const text=error&&typeof error==="object"&&"message" in error&&typeof error.message==="string"?error.message:"";
 if(!/[\u0600-\u06ff]/.test(text)||/\b(SQL|RPC|PGRST\w*|relation|column|JWT|TypeError|migration|undefined)\b|ترحيل|قاعدة البيانات|\b[A-Z][A-Z0-9]+_[A-Z0-9_]+\b/i.test(text))return fallback;
 return text;
}
