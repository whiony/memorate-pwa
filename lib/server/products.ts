import { database } from './api';
import { OpenFactsProvider, UPCItemDbProvider } from '../product-lookup';
import { ProductLookupService } from '../product-service';
import { D1ProductStore } from '../product-store';
export function productProvider() { return new ProductLookupService([new OpenFactsProvider(),new UPCItemDbProvider()],new D1ProductStore(database().db),Date.now,event=>{
  // Temporary development diagnostics: no account IDs, credentials, or response bodies.
  if(process.env.NODE_ENV!=='production')console.info('[product-lookup]',JSON.stringify(event));
}); }
