import { z } from 'zod';
const short=z.string().trim().min(1).max(300);
export const productInfoSchema=z.object({
 barcode:z.string().regex(/^(?:\d{8}|\d{13}|\d{14})$/), barcodeType:short.optional(),
 originalName:short.optional(),displayName:short.optional(),brand:short.optional(),productType:short.optional(),
 variant:short.optional(),flavor:short.optional(),quantity:short.optional(),
 ingredients:z.string().max(6000).optional(),allergens:z.string().max(1000).optional(),
 nutrition:z.array(z.object({name:short,value:short}).strict()).max(12).optional(),
 sourceCountry:short.optional(),activeIngredient:short.optional(),pharmaceuticalForm:short.optional(),strength:short.optional(),
 expiryDate:z.string().regex(/^\d{4}-\d{2}(?:-\d{2})?$/).optional(),batchNumber:z.string().max(20).optional(),
 sources:z.array(z.string().max(80)).max(8).optional(),
}).strict();
export type ProductInfo=z.infer<typeof productInfoSchema>;
export type PriceObservation={amount:number;currency:string;observedAt:number;source:string;country?:string};
export const priceObservationSchema=z.object({amount:z.number().finite().positive().max(1e12),currency:z.string().regex(/^[A-Z]{3}$/),observedAt:z.number().finite(),source:short,country:short.optional()});
export function relevantPrice(prices:PriceObservation[]|undefined,currency:string,now=Date.now(),country?:string):PriceObservation|undefined {
 return prices?.filter(p=>p.currency===currency&&p.amount>0&&Number.isFinite(p.amount)&&p.observedAt<=now&&p.observedAt>=now-14*86400000&&(!country||p.country===country)).sort((a,b)=>b.observedAt-a.observedAt)[0];
}
