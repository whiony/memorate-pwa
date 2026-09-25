import { env } from 'cloudflare:workers';
import { database } from './api';
import { OpenFactsProvider, UPCItemDbProvider, GoUPCProvider, OpenFDAProvider } from '../product-lookup';
import { ProductLookupService } from '../product-service';
import { D1ProductStore } from '../product-store';
export function productProvider() { return new ProductLookupService([new OpenFDAProvider(),new OpenFactsProvider(),new UPCItemDbProvider(),...(env.GO_UPC_API_KEY ? [new GoUPCProvider(env.GO_UPC_API_KEY)] : [])],new D1ProductStore(database().db),Date.now,event=>{
  // Temporary development diagnostics: no account IDs, credentials, or response bodies.
  if(process.env.NODE_ENV!=='production')console.info('[product-lookup]',JSON.stringify(event));
}); }
