/** Canonical EAN-13 identity: UPC-A and UPC-E resolve to the same product. */
export function normalizeBarcode(input: string, format?: string): string | null {
  let code = input.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(code)) return null;
  const valid = (s: string) => {
    let sum=0; for(let i=s.length-2,weight=3;i>=0;i--,weight=4-weight)sum+=Number(s[i])*weight;
    return (10-sum%10)%10===Number(s.at(-1));
  };
  if(code.length===8 && (format==='UPC_E' || !valid(code))) {
    if(!/^[01]/.test(code))return null;
    const [n,a,b,c,d,e,f,check]=code;
    code = Number(f)<=2 ? `${n}${a}${b}${f}0000${c}${d}${e}${check}` : f==='3' ? `${n}${a}${b}${c}00000${d}${e}${check}` : f==='4' ? `${n}${a}${b}${c}${d}00000${e}${check}` : `${n}${a}${b}${c}${d}${e}0000${f}${check}`;
  }
  if(![8,12,13].includes(code.length)||!valid(code)||/^0+$/.test(code))return null;
  return code.length===12 ? `0${code}` : code;
}
