export const newIdempotencyKey = () => {
  const cryptoValue = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (cryptoValue?.randomUUID) return cryptoValue.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
};
