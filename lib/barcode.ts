/** Equivalent GTIN representations share one key; nonzero GTIN-14 packaging stays distinct. */
export function normalizeBarcode(input: string, format?: string): string | null {
  let code = input.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(code)) return null;
  const valid = (s: string) => {
    let sum = 0;
    for (let i = s.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) sum += Number(s[i]) * weight;
    return (10 - sum % 10) % 10 === Number(s.at(-1));
  };
  // An unlabelled valid EAN-8 remains EAN-8. Explicit UPC-E disambiguates the rare overlap.
  if (code.length === 8 && (format === 'UPC_E' || !valid(code))) {
    if (!/^[01]/.test(code)) return null;
    const [n,a,b,c,d,e,f,check] = code;
    code = Number(f) <= 2 ? `${n}${a}${b}${f}0000${c}${d}${e}${check}` : f === '3' ? `${n}${a}${b}${c}00000${d}${e}${check}` : f === '4' ? `${n}${a}${b}${c}${d}00000${e}${check}` : `${n}${a}${b}${c}${d}${e}0000${f}${check}`;
  }
  if (![8,12,13,14].includes(code.length) || !valid(code) || /^0+$/.test(code)) return null;
  if (code.length === 14 && code[0] === '0') code = code.slice(1);
  if (code.length === 12) code = `0${code}`;
  if (code.length === 13 && code.startsWith('00000')) code = code.slice(5);
  return code;
}

/** Choose the newest exact GTIN match without changing collection order. */
export function existingBarcodeNote<T extends {id:string;barcode?:string;updatedAt:string}>(notes:T[],input:string):T|undefined {
  const code=normalizeBarcode(input);if(!code)return;
  return notes.filter(n=>n.barcode&&normalizeBarcode(n.barcode)===code).sort((a,b)=>(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0)||a.id.localeCompare(b.id))[0];
}
