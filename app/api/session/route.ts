import { getChatGPTUser } from "../../chatgpt-auth";
import { boundary, json } from "@/lib/server/api";
export const dynamic = "force-dynamic";
export const GET = () => boundary(async()=>{const user=await getChatGPTUser(); return json({user:user?{id:user.userId,name:user.displayName}:null});});
