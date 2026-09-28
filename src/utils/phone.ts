const WESTERN_DIGITS = "0123456789";

export function toWesternDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) =>
      String(WESTERN_DIGITS["٠١٢٣٤٥٦٧٨٩".indexOf(digit)]),
    )
    .replace(/[۰-۹]/g, (digit) =>
      String(WESTERN_DIGITS["۰۱۲۳۴۵۶۷۸۹".indexOf(digit)]),
    );
}

export function normalizePhoneNumber(value: string) {
  let phone = toWesternDigits(value).replace(/[\s().-]/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;

  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}
