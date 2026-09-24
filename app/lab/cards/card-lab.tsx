"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { INITIAL_CATEGORIES } from "@/lib/models";
import styles from "./cards.module.css";

function BrandStar({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><path d="M47.57,10.57 Q50,6 52.43,10.57 L61.63,27.84 Q63.52,31.39 67.48,32.09 L86.75,35.50 Q91.85,36.40 88.25,40.13 L74.67,54.21 Q71.87,57.11 72.43,61.10 L75.14,80.47 Q75.86,85.60 71.21,83.33 L53.62,74.76 Q50,73 46.38,74.76 L28.79,83.33 Q24.14,85.60 24.86,80.47 L27.57,61.10 Q28.13,57.11 25.33,54.21 L11.75,40.13 Q8.15,36.40 13.25,35.50 L32.52,32.09 Q36.48,31.39 38.37,27.84 Z" /></svg>;
}


type Sample = { title: string; category: string; rating: number; comment: string; date: string; price: string; photos: string[] };
const everyday: Sample[] = [
  { title: "Morning ritual", category: "food", rating: 4.5, comment: "Still warm. Worth taking the long way home.", date: "Sep 24, 2026", price: "€2.40", photos: ["bread"] },
  { title: "Место, куда хочется вернуться", category: "places", rating: 5, comment: "Море, тихий ветер и ни одного плана на день.", date: "May 1, 2026", price: "€48.00", photos: ["sea", "bread", "knit"] },
  { title: "The everyday serum", category: "beauty", rating: 3, comment: "A little too fragrant.", date: "Nov 18, 2025", price: "€36.90", photos: ["beauty"] },
  { title: "A very good knit", category: "clothes", rating: 4, comment: "", date: "Jan 3, 2026", price: "€129.00", photos: ["knit"] },
];
const edgeCases: Sample[] = [
  { title: "Bun", category: "food", rating: 2, comment: "Okay.", date: "Jun 1, 2026", price: "€0.80", photos: ["bread"] },
  { title: "The impossibly soft oversized cardigan I kept thinking about all winter", category: "clothes", rating: 4.5, comment: "Beautiful texture, but the sleeves need a little patience.", date: "September 24, 2026", price: "€1,249.00", photos: ["knit"] },
  { title: "Маленькая радость", category: "other", rating: 3.5, comment: "Без фотографии — просто заметка на память.", date: "December 31, 2026", price: "€12,450.99", photos: [] },
  { title: "Three days by the sea", category: "places", rating: 5, comment: "", date: "Feb 28, 2026", price: "€2,840.00", photos: ["sea", "bread", "beauty"] },
];
const concepts = [
  { id: "a", label: "A", name: "Compact Editorial", description: "A closer crop of everyday life. Compact spacing, a generous photo, quiet metadata." },
  { id: "b1", label: "B1", name: "Bottom Bar — Straight", description: "A clean dividing line gives date and price a place of their own." },
  { id: "b2", label: "B2", name: "Bottom Bar — Wave", description: "The same structure, softened with a small, flowing wave." },
  { id: "b3", label: "B3", name: "Bottom Bar — Zigzag", description: "A fine receipt-like edge, with just a little more character." },
  { id: "c", label: "C", name: "Rating Beside Title", description: "Title and rating share a line when there is room; longer titles let the rating settle below." },
  { id: "d", label: "D", name: "Photo on Edge", description: "A photograph that belongs to the edge, rather than sitting inside a frame." },
  { id: "e", label: "E", name: "Circular Photo", description: "A generous round portrait gives each memory a softer silhouette." },
  { id: "f", label: "F", name: "Minimal Editorial", description: "Less framing, more breathing room. An entry in a personal journal." },
] as const;
type Variant = typeof concepts[number]["id"];

function PhotoArea({ photos }: { photos: string[] }) {
  if (!photos.length) return null;
  return <div className={`${styles.photos} ${photos.length > 1 ? styles.collage : ""}`} aria-label={`${photos.length} sample photos`}>
    {photos.map((photo, i) => <Image unoptimized key={photo} src={`/card-lab/${photo}.jpg`} alt={{ bread: "Fresh bread", sea: "Sea waves", beauty: "Skincare still life", knit: "Soft knitwear" }[photo] ?? "Sample photograph"} width={480} height={480} loading="lazy" className={i === 0 ? styles.firstPhoto : ""} />)}
  </div>;
}

function Divider({ variant }: { variant: Variant }) {
  const id = useId();
  if (variant === "b1") return <div className={styles.straight} />;
  if (variant !== "b2" && variant !== "b3") return null;
  const path = variant === "b2" ? "M0 5 Q5 0 10 5 T20 5 T30 5 T40 5" : "M0 7 L5 3 L10 7 L15 3 L20 7 L25 3 L30 7 L35 3 L40 7";
  return <svg className={styles.divider} aria-hidden="true"><rect width="100%" height="10" fill={`url(#${id})`} /><defs><pattern id={id} width="40" height="10" patternUnits="userSpaceOnUse"><path d={path} fill="none" stroke="currentColor" strokeWidth="1" /></pattern></defs></svg>;
}

function LabCard({ note, variant }: { note: Sample; variant: Variant }) {
  const category = INITIAL_CATEGORIES.find(c => c.id === note.category)!;
  return <article className={`${styles.card} ${styles[variant]} ${!note.photos.length ? styles.noPhoto : ""}`}>
    <div className={styles.main}>
      <div className={styles.copy}>
        <div className={styles.category}><span style={{ background: category.color }} />{category.name}</div>
        <div className={styles.titleGroup}><h3>{note.title}</h3><span className={styles.rating} aria-label={`${note.rating} out of 5`}>{note.rating.toFixed(1)}<BrandStar /></span></div>
        {note.comment && <p className={styles.comment}>{note.comment}</p>}
      </div>
      <PhotoArea photos={note.photos} />
    </div>
    <Divider variant={variant} />
    <div className={styles.metadata}><span>{note.date}</span><span>{note.price}</span></div>
  </article>;
}

export default function CardLab() {
  const [width, setWidth] = useState("desktop");
  const [samples, setSamples] = useState("everyday");
  return <main className={styles.lab}>
    <header className={styles.header}><Link href="/" className={styles.brand}><BrandStar />memorate.</Link><Link href="/lab/cards">Round two →</Link></header>
    <div className={styles.intro}><p className={styles.eyebrow}>SMALL DETAILS, DIFFERENT FEELINGS</p><h1>A place for every memory.</h1><p>Eight ways to frame the same little moments.<br />Compare the rhythm, the photos, the space in between.</p></div>
    <div className={styles.toolbar}>
      <fieldset><legend>Preview width</legend>{["desktop", "mobile"].map(value => <button key={value} aria-pressed={width === value} onClick={() => setWidth(value)}>{value === "desktop" ? "Responsive" : "Mobile · 390"}</button>)}</fieldset>
      <fieldset><legend>Sample notes</legend>{["everyday", "edge"].map(value => <button key={value} aria-pressed={samples === value} onClick={() => setSamples(value)}>{value === "everyday" ? "Everyday" : "Long & unusual"}</button>)}</fieldset>
      <span className={styles.mockLabel}>Mock notes only</span>
    </div>
    <nav className={styles.jump} aria-label="Card concepts">{concepts.map(c => <a key={c.id} href={`#${c.id}`}>{c.label}<span>{c.name.replace("Bottom Bar — ", "")}</span></a>)}</nav>
    <div className={width === "mobile" ? styles.mobile : ""}>
      {concepts.map(concept => <section key={concept.id} id={concept.id} className={styles.section} aria-labelledby={`heading-${concept.id}`}>
        <div className={styles.sectionHeading}><span className={styles.letter}>{concept.label}</span><div><h2 id={`heading-${concept.id}`}>{concept.name}</h2><p>{concept.description}</p></div></div>
        <div className={styles.grid}>{(samples === "everyday" ? everyday : edgeCases).map(note => <LabCard key={note.title} note={note} variant={concept.id} />)}</div>
      </section>)}
    </div>
    <footer className={styles.footer}>An exploration, not a new collection. Your notes stay as they are.<br /><a href="https://unsplash.com">Sample photography from Unsplash</a> · <Link href="/">Back to Memorate</Link></footer>
  </main>;
}
