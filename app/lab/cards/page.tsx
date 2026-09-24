import type { Metadata } from "next";
import CardLab from "./round-two";
export const metadata: Metadata = { title: "Card lab · Memorate", robots: { index: false, follow: false } };
export default function CardLabPage() { return <CardLab />; }
