"use client";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./ui/collapsible";
import type { ProductInfo } from '@/lib/product-info';
const SOURCES:Record<string,string>={'open-food-facts':'Open Food Facts','open-beauty-facts':'Open Beauty Facts','open-pet-food-facts':'Open Pet Food Facts','open-products-facts':'Open Products Facts',upcitemdb:'UPCitemdb','go-upc':'Go-UPC','open-fda':'openFDA'};
export function ProductInformation({info}:{info?:ProductInfo}) {
 if(!info)return null;
 const rows:[string,string|undefined][]=[['Brand',info.brand],['Product type',info.productType],['Variant',info.variant],['Flavor',info.flavor],['Package size',info.quantity],['Ingredients / INCI',info.ingredients],['Allergens',info.allergens],['Active ingredient',info.activeIngredient],['Strength',info.strength],['Pharmaceutical form',info.pharmaceuticalForm],['Expiry date',info.expiryDate],['Batch / lot',info.batchNumber],['Market',info.sourceCountry],['Barcode',info.barcode],['Code type',info.barcodeType],['Original name',info.originalName!==info.displayName?info.originalName:undefined]];
 return <Collapsible className="product-info"><CollapsibleTrigger className="product-info-toggle">Product info<ChevronDown size={17} aria-hidden="true"/></CollapsibleTrigger><CollapsibleContent className="product-info-content"><dl>{rows.filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}{info.nutrition?.map(row=><div key={row.name}><dt>{row.name}</dt><dd>{row.value}</dd></div>)}{info.sources?.length ? <div><dt>Sources</dt><dd>{info.sources.map(s=>SOURCES[s]||s).join(', ')}</dd></div>:null}</dl></CollapsibleContent></Collapsible>;
}
